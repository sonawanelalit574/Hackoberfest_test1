import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createPlan } from "./plan.js";
import { expandRules, scanRecipe } from "./safety.js";
import { generate, resetGenerator, runtime } from "./model.js";
import {
  addHistory,
  getHistory,
  getProfile,
  getPrompt,
  getSettings,
  paths,
  resetProfile,
  saveProfile,
  savePrompt,
  saveSettings,
} from "./store.js";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function profilePayload(profile = getProfile()) {
  return { profile, rules: expandRules(profile.allergies, profile.avoids) };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 100_000) {
        reject(Object.assign(new Error("That request is too large."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("The request was not valid JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function clampMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return 30;
  return Math.min(120, Math.max(10, Math.round(minutes)));
}

async function planMeal(fridge, minutes) {
  const profile = getProfile();
  const result = await createPlan({
    fridge,
    minutes,
    profile,
    rules: expandRules(profile.allergies, profile.avoids),
    behavior: getPrompt(),
    settings: getSettings(),
    generate,
  });
  if (result.ok) {
    addHistory({
      at: new Date().toISOString(),
      title: result.meal.title || "Untitled draft",
      because: result.meal.because || "",
      fridge,
      minutes,
    });
  }
  return result;
}

function serveStatic(req, res, url) {
  let requested;
  try {
    requested = decodeURIComponent(url.pathname);
  } catch {
    send(res, 400, { error: "That address is not valid." });
    return;
  }
  requested = requested === "/" ? "index.html" : requested.replace(/^[/\\]+/, "");
  if (!requested || requested.includes("\0") || requested.split(/[/\\]/).includes("..")) {
    send(res, 403, { error: "That file is outside the app." });
    return;
  }
  const filePath = path.normalize(path.join(paths.publicDir, requested));
  const relative = path.relative(paths.publicDir, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    send(res, 403, { error: "That file is outside the app." });
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    send(res, 404, { error: "Not found." });
    return;
  }
  const type = MIME[path.extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
  createReadStream(filePath).pipe(res);
}

export function createApp() {
  runtime.model = getSettings().model;
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    try {
      if (req.method === "GET" && url.pathname === "/api/profile") {
        send(res, 200, profilePayload());
        return;
      }
      if (req.method === "PUT" && url.pathname === "/api/profile") {
        const body = await readBody(req);
        send(res, 200, profilePayload(saveProfile(body)));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/profile/reset") {
        send(res, 200, profilePayload(resetProfile()));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/settings") {
        send(res, 200, getSettings());
        return;
      }
      if (req.method === "PUT" && url.pathname === "/api/settings") {
        const body = await readBody(req);
        const settings = saveSettings(body);
        resetGenerator();
        runtime.model = settings.model;
        send(res, 200, settings);
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/prompt") {
        send(res, 200, { text: getPrompt() });
        return;
      }
      if (req.method === "PUT" && url.pathname === "/api/prompt") {
        const body = await readBody(req);
        send(res, 200, { text: savePrompt(body.text) });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/status") {
        send(res, 200, runtime);
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/history") {
        send(res, 200, { history: getHistory() });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/check") {
        const body = await readBody(req);
        const recipe = String(body.recipe ?? "").trim();
        if (!recipe) {
          send(res, 400, { error: "Paste a recipe to check." });
          return;
        }
        const profile = getProfile();
        const rules = expandRules(profile.allergies, profile.avoids);
        send(res, 200, { name: profile.name, ...scanRecipe(recipe, rules) });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/plan") {
        const body = await readBody(req);
        const fridge = String(body.fridge ?? "").trim();
        if (!fridge) {
          send(res, 400, { error: "List what is in the kitchen first." });
          return;
        }
        const result = await planMeal(fridge.slice(0, 800), clampMinutes(body.minutes));
        send(res, result.ok ? 200 : 422, result);
        return;
      }
      if (req.method === "GET") {
        serveStatic(req, res, url);
        return;
      }
      send(res, 405, { error: "That action is not available." });
    } catch (error) {
      const status = error.status || 500;
      send(res, status, { error: error.message || "Something went wrong on this machine." });
    }
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT) || 4317;
  createApp().listen(port, "127.0.0.1", () => {
    console.log(`Second Plate is on http://127.0.0.1:${port}`);
  });
}
