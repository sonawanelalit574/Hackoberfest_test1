import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const paths = {
  root,
  profile: path.join(root, "data", "profile.json"),
  settings: path.join(root, "data", "settings.json"),
  history: path.join(root, "data", "history.json"),
  prompt: path.join(root, "prompts", "cook.txt"),
  publicDir: path.join(root, "public"),
  cache: path.join(root, ".cache"),
};

export const SAMPLE_PROFILE = {
  sample: true,
  name: "Sample roommate",
  allergies: "peanuts, shellfish, lactose",
  avoids: "cilantro, mushrooms",
  loves: "dal, eggs, rice, tomatoes, lemon, chili",
  notes: "Exam month. Dinner has to reheat, one pan, about 30 minutes. Peanut oil counts as peanuts.",
};

const DEFAULT_SETTINGS = {
  model: "onnx-community/Qwen2.5-1.5B-Instruct",
  dtype: "q4",
  maxNewTokens: 180,
};

const DTYPES = new Set(["q4", "q4f16", "q8", "fp16", "fp32"]);

function ensureDataDir() {
  mkdirSync(path.dirname(paths.profile), { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDataDir();
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cleanText(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function getProfile() {
  const profile = readJson(paths.profile, SAMPLE_PROFILE);
  return {
    sample: Boolean(profile.sample),
    name: cleanText(profile.name || "Someone you cook for", 80),
    allergies: cleanText(profile.allergies, 400),
    avoids: cleanText(profile.avoids, 400),
    loves: cleanText(profile.loves, 400),
    notes: cleanText(profile.notes, 600),
  };
}

export function saveProfile(input) {
  const profile = {
    sample: Boolean(input?.sample) && cleanText(input?.name, 80) === SAMPLE_PROFILE.name,
    name: cleanText(input?.name, 80) || "Someone you cook for",
    allergies: cleanText(input?.allergies, 400),
    avoids: cleanText(input?.avoids, 400),
    loves: cleanText(input?.loves, 400),
    notes: cleanText(input?.notes, 600),
  };
  writeJson(paths.profile, profile);
  return profile;
}

export function resetProfile() {
  writeJson(paths.profile, SAMPLE_PROFILE);
  return { ...SAMPLE_PROFILE };
}

export function getSettings() {
  const settings = readJson(paths.settings, DEFAULT_SETTINGS);
  const dtype = DTYPES.has(settings.dtype) ? settings.dtype : "q4";
  const maxNewTokens = Number(settings.maxNewTokens);
  return {
    model: cleanText(settings.model || DEFAULT_SETTINGS.model, 160),
    dtype,
    maxNewTokens: Number.isFinite(maxNewTokens) ? Math.min(400, Math.max(32, maxNewTokens)) : 180,
  };
}

export function saveSettings(input) {
  const current = getSettings();
  const dtype = DTYPES.has(input?.dtype) ? input.dtype : current.dtype;
  const maxNewTokens = Number(input?.maxNewTokens);
  const settings = {
    model: cleanText(input?.model || current.model, 160),
    dtype,
    maxNewTokens: Number.isFinite(maxNewTokens) ? Math.min(400, Math.max(32, maxNewTokens)) : current.maxNewTokens,
  };
  if (!settings.model) settings.model = DEFAULT_SETTINGS.model;
  writeJson(paths.settings, settings);
  return settings;
}

export function getPrompt() {
  try {
    return readFileSync(paths.prompt, "utf8");
  } catch {
    return "You cook one dinner for one person and you follow their food rules.";
  }
}

export function savePrompt(text) {
  const next = String(text ?? "").trim().slice(0, 4000);
  if (!next) {
    throw new Error("The cook's instructions can't be empty.");
  }
  mkdirSync(path.dirname(paths.prompt), { recursive: true });
  writeFileSync(paths.prompt, `${next}\n`, "utf8");
  return `${next}\n`;
}

export function getHistory() {
  const history = readJson(paths.history, []);
  return Array.isArray(history) ? history.slice(0, 20) : [];
}

export function addHistory(entry) {
  const history = [entry, ...getHistory()].slice(0, 20);
  writeJson(paths.history, history);
  return history;
}

export function dataFilesExist() {
  return existsSync(paths.profile);
}
