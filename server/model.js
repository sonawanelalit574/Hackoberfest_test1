import path from "node:path";
import { paths } from "./store.js";

export const runtime = {
  state: "idle",
  progress: 0,
  file: "",
  message: "Downloads once, then plans stay on this machine.",
  error: null,
  model: "",
  startedAt: null,
};

let generator = null;
let loadedKey = "";
let queue = Promise.resolve();
let transformersModule = null;

async function loadTransformers() {
  if (!transformersModule) {
    transformersModule = await import("@huggingface/transformers");
  }
  return transformersModule;
}

function configure(env) {
  env.cacheDir = paths.cache;
  env.allowLocalModels = true;
  if (process.env.SECOND_PLATE_OFFLINE === "1") {
    env.allowRemoteModels = false;
  }
}

function onProgress(update) {
  if (!update) return;
  runtime.file = update.file || runtime.file;
  if (update.status === "progress") {
    runtime.state = "downloading";
    const value = Number(update.progress ?? 0);
    runtime.progress = value > 1 ? Math.round(value) : Math.round(value * 100);
    runtime.message = `Downloading ${update.file || "model files"}`;
  } else if (update.status === "done") {
    runtime.message = `Saved ${update.file || "a model file"}`;
  } else if (update.status === "initiate") {
    runtime.state = "downloading";
    runtime.message = `Fetching ${update.file || "model files"}`;
  }
}

async function loadGenerator(settings) {
  const key = `${settings.model}::${settings.dtype}`;
  if (generator && loadedKey === key) return generator;

  const { pipeline, env } = await loadTransformers();
  configure(env);
  runtime.state = "downloading";
  runtime.progress = 0;
  runtime.error = null;
  runtime.model = settings.model;
  runtime.startedAt = Date.now();
  runtime.message = "Bringing the open model onto this laptop. The first download is a few hundred megabytes.";

  generator = await pipeline("text-generation", settings.model, {
    dtype: settings.dtype,
    device: "cpu",
    progress_callback: onProgress,
  });
  if (generator.tokenizer) {
    generator.tokenizer.add_bos_token = false;
    generator.tokenizer.add_eos_token = false;
  }
  loadedKey = key;
  runtime.state = "ready";
  runtime.progress = 100;
  runtime.file = "";
  runtime.message = "The model is on this laptop.";
  return generator;
}

function extractText(output) {
  const first = Array.isArray(output) ? output[0] : output;
  if (!first) return "";
  if (typeof first.generated_text === "string") return first.generated_text;
  if (Array.isArray(first.generated_text)) {
    const last = first.generated_text.at(-1);
    if (typeof last === "string") return last;
    return last?.content || "";
  }
  if (typeof first.generated_text?.content === "string") return first.generated_text.content;
  return "";
}

function cleanup(text) {
  return String(text)
    .replace(/<\|im_end\|>[\s\S]*$/g, "")
    .replace(/<\|im_start\|>[\s\S]*$/g, "")
    .trim();
}

async function run(prompt, settings, overrides = {}) {
  runtime.error = null;
  runtime.startedAt = Date.now();
  const pipe = await loadGenerator(settings);
  runtime.state = "generating";
  runtime.message = overrides.message || "Writing a dinner on this CPU.";
  try {
    const output = await pipe(prompt, {
      max_new_tokens: overrides.maxNewTokens || settings.maxNewTokens,
      do_sample: false,
      repetition_penalty: 1.35,
      return_full_text: false,
      add_special_tokens: false,
    });
    const text = cleanup(extractText(output));
    if (!text) throw new Error("The model returned an empty recipe.");
    runtime.state = "ready";
    runtime.message = "The model is on this laptop.";
    return text;
  } catch (error) {
    runtime.state = "error";
    runtime.error = error.message || "The model stopped.";
    runtime.message = runtime.error;
    throw error;
  }
}

export function generate(prompt, settings, overrides) {
  const job = queue.then(() => run(prompt, settings, overrides));
  queue = job.then(() => {}, () => {});
  return job;
}

export function resetGenerator() {
  generator = null;
  loadedKey = "";
  if (runtime.state !== "generating" && runtime.state !== "downloading") {
    runtime.state = "idle";
    runtime.progress = 0;
    runtime.message = "The next plan will load this model.";
  }
}

export function cachePath() {
  return path.resolve(paths.cache);
}
