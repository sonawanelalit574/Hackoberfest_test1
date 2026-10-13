function pick(text, labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`^${label}:[ \\t]*(.*)$`, "im"));
    if (match && match[1].trim()) return match[1].trim();
  }
  return "";
}

export function clipToCard(raw) {
  const text = String(raw ?? "").replace(/\r/g, "").trim();
  const start = text.search(/^TITLE:/im);
  return start >= 0 ? text.slice(start).trim() : text;
}

export function withTitle(raw) {
  const body = String(raw ?? "").replace(/\r/g, "").trim().replace(/^(TITLE:\s*)+/i, "");
  return body ? `TITLE: ${body}` : "";
}

const PLACEHOLDER = /short dish name|one sentence about why|separated by commas|first step|second step|third step|one missing item|write the dinner/i;

export function isUsableMeal(meal) {
  if (!meal?.ok) return false;
  const blob = `${meal.title} ${meal.because} ${meal.steps.join(" ")} ${meal.shop}`;
  if (PLACEHOLDER.test(blob)) return false;
  return meal.title.length >= 3 && meal.title.length <= 80;
}

export function cutRepeats(text) {
  const lines = String(text ?? "").split("\n");
  const seen = new Map();
  const kept = [];
  for (const line of lines) {
    const key = line.trim().toLowerCase();
    if (key) {
      const count = (seen.get(key) || 0) + 1;
      seen.set(key, count);
      if (count > 1) break;
    }
    kept.push(line);
  }
  return kept.join("\n").trim();
}

export function readOpening(raw) {
  const lines = cutRepeats(raw).split("\n").map((line) => line.trim()).filter(Boolean);
  const title = (lines[0] || "").replace(/^TITLE:\s*/i, "").replace(/^["']+|["']+$/g, "").trim();
  let because = "";
  for (const line of lines.slice(1)) {
    const match = line.match(/^BECAUSE:\s*(.+)$/i);
    if (match) because = match[1].trim().replace(/^["']+|["']+$/g, "");
  }
  return { title: title.slice(0, 80), because: because.slice(0, 200) };
}

function tidyStep(sentence) {
  let next = sentence.replace(/\([^)]*step[^)]*\)/ig, "").replace(/\s+/g, " ").trim();
  if (!/[.!?]$/.test(next)) {
    const cut = next.split(/[;:]/)[0].trim();
    if (cut.length > 8) next = cut;
  }
  next = next.replace(/[,;:\s]+$/, "");
  if (!/[.!?]$/.test(next)) next = `${next}.`;
  return next.charAt(0).toUpperCase() + next.slice(1);
}

function firstSentence(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(.{8,150}?[.!?])(?:\s|$)/);
  return (match ? match[1] : cleaned.slice(0, 150)).trim();
}

export function parseSteps(raw) {
  let text = cutRepeats(String(raw ?? ""))
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "");
  text = text.replace(/(?:^|\n)\s*[-*]?\s*step\s*(\d+)\s*[,.:)\-]?\s*/gi, "\n$1. ");
  const steps = [];
  for (const chunk of text.split(/(?:^|\n)\s*(?=\d+[.)]\s)/)) {
    if (!/^\d+[.)]\s/.test(chunk.trim())) continue;
    const sentence = tidyStep(firstSentence(chunk.replace(/^\d+[.)]\s*/, "")));
    if (sentence.length > 8 && !PLACEHOLDER.test(sentence) && !/^(use|uses|title|because)\b/i.test(sentence)) {
      steps.push(sentence);
    }
  }
  return steps.slice(0, 3);
}

const STAPLES = /^(oil|salt|water|pepper|sugar|turmeric|cumin|spice|spices)$/i;
const INVENTED = ["chicken", "mutton", "beef", "pork", "lamb", "goat", "prawn", "shrimp", "fish", "paneer", "cheese"];
const OUTSIDE = [
  ...INVENTED,
  "noodle", "noodles", "pasta", "coconut", "milk", "garlic", "ginger", "olive",
  "spinach", "seaweed", "potato", "potatoes", "bean", "beans", "lentil", "lentils", "dal",
  "bread", "flour", "butter", "cream", "yogurt", "curd", "ghee", "peanut", "groundnut",
  "almond", "cashew", "walnut", "cilantro", "mushroom", "mushrooms", "soy", "tofu",
];

function mentioned(blob, word) {
  if (blob.includes(word)) return true;
  if (word.endsWith("s") && word.length > 3 && blob.includes(word.slice(0, -1))) return true;
  if (!word.endsWith("s") && blob.includes(`${word}s`)) return true;
  return false;
}

export function kitchenWords(fridge) {
  const words = [];
  for (const food of String(fridge ?? "").split(/[,;\n]|\band\b/i)) {
    const word = food.trim().toLowerCase().split(/\s+/).at(-1);
    if (!word || word.length < 3 || STAPLES.test(word)) continue;
    words.push(word);
  }
  return [...new Set(words)];
}

export function wordsUsed(text, fridge) {
  const blob = String(text ?? "").toLowerCase();
  return kitchenWords(fridge).filter((word) => mentioned(blob, word));
}

export function inventedFoods(text, fridge) {
  const blob = String(text ?? "").toLowerCase();
  const kitchen = String(fridge ?? "").toLowerCase();
  return [...new Set(OUTSIDE.filter((food) => mentioned(blob, food) && !mentioned(kitchen, food)))];
}

export function groundedInKitchen(meal, fridge) {
  const blob = `${meal.title}\n${meal.uses}\n${meal.steps.join("\n")}`;
  return wordsUsed(blob, fridge).length >= 2;
}

export function parseMeal(raw) {
  const text = clipToCard(raw);
  const title = pick(text, ["TITLE", "DISH"]);
  const because = pick(text, ["BECAUSE", "WHY"]);
  const uses = pick(text, ["USES"]);
  const shop = pick(text, ["SHOP", "MISSING"]);
  const steps = [];
  let inSteps = false;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (/^STEPS:\s*$/i.test(trimmed)) {
      inSteps = true;
      continue;
    }
    if (/^(SHOP|MISSING|TITLE|DISH|BECAUSE|WHY|USES):/i.test(trimmed)) {
      if (inSteps && /^(SHOP|MISSING):/i.test(trimmed)) break;
      continue;
    }
    const numbered = trimmed.match(/^(?:\d+[.)\]]|[-*])\s+(.+)/);
    if (numbered && (inSteps || steps.length > 0)) {
      steps.push(numbered[1].trim());
      inSteps = true;
    }
  }

  const shopClean = /^(none|nothing|n\/a|no|nil|-)$/i.test(shop) ? "" : shop;
  return {
    title,
    because,
    uses,
    shop: shopClean,
    steps,
    ok: Boolean(title && steps.length),
  };
}
