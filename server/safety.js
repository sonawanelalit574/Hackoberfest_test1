const FILLER = new Set([
  "allergic", "allergy", "allergies", "to", "the", "a", "an", "of", "my", "severe",
  "intolerant", "intolerance", "intolerances", "avoid", "avoids", "avoiding",
  "no", "not", "without", "food", "foods", "and", "or", "plus", "extra", "please",
  "thanks", "only", "just", "very", "really", "hate", "hates", "hated", "dislike",
  "dislikes", "disliked", "skip", "skipped", "with", "from", "into", "them",
]);

const ALIASES = {
  cilantro: ["cilantro", "dhaniya", "coriander leaves", "fresh coriander", "coriander"],
  coriander: ["coriander", "cilantro", "dhaniya", "coriander leaves", "fresh coriander"],
  dhaniya: ["dhaniya", "cilantro", "coriander", "coriander leaves"],
  mushroom: ["mushroom", "mushrooms"],
  mushrooms: ["mushroom", "mushrooms"],
  onion: ["onion", "onions"],
  onions: ["onion", "onions"],
  garlic: ["garlic"],
  eggplant: ["eggplant", "aubergine", "brinjal"],
  brinjal: ["brinjal", "eggplant", "aubergine"],
};

const HINTS = {
  peanut: ["peanut", "peanut oil", "groundnut", "satay"],
  "tree nut": ["almond", "cashew", "walnut"],
  shellfish: ["shrimp", "prawn", "crab", "lobster"],
  fish: ["fish", "salmon", "tuna"],
  dairy: ["milk", "paneer", "ghee", "butter", "curd", "cheese"],
  egg: ["egg", "omelette"],
  soy: ["soy", "tofu", "soy sauce"],
  gluten: ["wheat", "atta", "bread"],
  sesame: ["sesame", "tahini"],
  mustard: ["mustard", "mustard oil"],
};

const CATEGORIES = [
  {
    id: "peanut",
    label: "Peanuts",
    triggers: ["peanut", "peanuts", "groundnut", "groundnuts", "moongphali", "satay"],
    phrases: ["peanut", "peanuts", "groundnut", "groundnuts", "groundnut oil", "peanut oil", "peanut sauce", "satay", "satay sauce", "moongphali", "arachis", "monkey nut", "monkey nuts"],
  },
  {
    id: "tree nut",
    label: "Tree nuts",
    triggers: ["tree nut", "tree nuts", "almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pistachio", "pistachios", "hazelnut", "hazelnuts", "pecan", "pecans", "badam", "kaju"],
    phrases: ["almond", "almonds", "badam", "cashew", "cashews", "kaju", "walnut", "walnuts", "akhrot", "pistachio", "pistachios", "pista", "hazelnut", "hazelnuts", "pecan", "pecans", "macadamia", "brazil nut", "pine nut", "praline", "marzipan", "nutella", "nuts", "nut"],
  },
  {
    id: "shellfish",
    label: "Shellfish",
    triggers: ["shellfish", "crustacean", "crustaceans", "shrimp", "prawn", "prawns", "jhinga", "crab", "lobster"],
    phrases: ["shellfish", "crustacean", "shrimp", "prawn", "prawns", "jhinga", "crab", "lobster", "crayfish", "crawfish", "mussel", "mussels", "clam", "clams", "oyster", "oysters", "scallop", "scallops", "squid", "calamari", "octopus"],
  },
  {
    id: "fish",
    label: "Fish",
    triggers: ["fish", "seafood"],
    phrases: ["fish", "fish sauce", "salmon", "tuna", "cod", "anchovy", "anchovies", "sardine", "sardines", "mackerel", "hilsa", "rohu", "surmai", "bangda", "machli"],
  },
  {
    id: "dairy",
    label: "Dairy",
    triggers: ["dairy", "lactose", "milk", "cheese", "paneer", "ghee", "butter", "curd", "dahi", "yogurt", "yoghurt"],
    phrases: ["milk", "dairy", "lactose", "cheese", "paneer", "cheddar", "mozzarella", "parmesan", "butter", "ghee", "cream", "yogurt", "yoghurt", "curd", "dahi", "whey", "casein", "khoya", "khoa", "mawa", "condensed milk", "evaporated milk", "milk powder", "malai", "buttermilk", "lassi", "kheer", "ice cream", "white sauce", "bechamel", "cream cheese", "sour cream"],
  },
  {
    id: "egg",
    label: "Eggs",
    triggers: ["egg", "eggs"],
    phrases: ["egg", "eggs", "omelette", "omelet", "mayonnaise", "mayo", "egg wash", "anda"],
  },
  {
    id: "soy",
    label: "Soy",
    triggers: ["soy", "soya", "tofu"],
    phrases: ["soy", "soya", "soybean", "soybeans", "tofu", "edamame", "miso", "tempeh", "soy sauce"],
  },
  {
    id: "gluten",
    label: "Gluten",
    triggers: ["gluten", "wheat", "celiac", "coeliac"],
    phrases: ["gluten", "wheat", "atta", "maida", "bread", "pasta", "seitan", "barley", "rye", "semolina", "sooji", "rava", "naan", "kulcha", "roti", "chapati", "paratha", "poori", "bhatura", "soy sauce", "refined flour", "all purpose flour", "all-purpose flour"],
  },
  {
    id: "sesame",
    label: "Sesame",
    triggers: ["sesame", "tahini", "til"],
    phrases: ["sesame", "sesame oil", "sesame seed", "sesame seeds", "til", "tahini"],
  },
  {
    id: "mustard",
    label: "Mustard",
    triggers: ["mustard"],
    phrases: ["mustard", "mustard oil", "mustard seed", "mustard seeds", "rai", "sarson"],
  },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wholeWord(phrase) {
  const body = escapeRegExp(phrase.trim().toLowerCase()).replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${body}(?=$|[^a-z0-9])`, "i");
}

export function mentions(text, phrase) {
  return wholeWord(phrase).test(String(text ?? "").toLowerCase());
}

export function tokenize(input) {
  return String(input ?? "")
    .toLowerCase()
    .split(/[,;|\n]|\band\b/g)
    .map((part) => part.replace(/\./g, "").trim())
    .filter(Boolean);
}

export function prepare(text) {
  let next = String(text ?? "").toLowerCase();
  next = next.replace(/\begg\s*-?\s*plants?\b/g, " ");
  next = next.replace(/\baubergines?\b/g, " ");
  next = next.replace(/\b(coconut|oat|soy|almond|rice|hemp|cashew)\s+milk\b/g, "$1");
  next = next.replace(/\b(coconut|oat|soy)\s+cream\b/g, "$1");
  next = next.replace(/\bcream\s+of\s+coconut\b/g, "coconut");
  next = next.replace(/\b(peanut|almond|cashew|cocoa|apple|shea|sunflower(?:\s+seed)?)\s+butter\b/g, "$1 spread");
  next = next.replace(/\b(ground\s+coriander|coriander\s+powder|coriander\s+seeds?)\b/g, " ");
  next = next.replace(/\b(peanut|dairy|nut|gluten|soy|egg|lactose|shellfish|fish)[-\s]?free\b/g, " ");
  next = next.replace(/\b(no|not|without|never)\s+([a-z]+(?:\s+[a-z]+){0,2})\b/g, " ");
  return next;
}

function variants(phrase) {
  const key = phrase.toLowerCase().trim();
  if (ALIASES[key]) return [...ALIASES[key]];
  const parts = key.split(/\s+/);
  const last = parts[parts.length - 1];
  const stems = new Set([key]);
  if (last.length > 3 && last.endsWith("s") && !last.endsWith("ss")) {
    const singular = [...parts];
    singular[singular.length - 1] = last.slice(0, -1);
    stems.add(singular.join(" "));
  } else if (last.length > 3) {
    const plural = [...parts];
    plural[plural.length - 1] = `${last}s`;
    stems.add(plural.join(" "));
  }
  return [...stems];
}

function expandList(input) {
  const raw = String(input ?? "").toLowerCase();
  if (!raw.trim()) return [];

  const treeNuts = mentions(raw, "tree nut") || mentions(raw, "tree nuts");
  const bareNuts = (mentions(raw, "nut") || mentions(raw, "nuts")) && !treeNuts;
  const seafood = mentions(raw, "seafood");
  const active = [];

  for (const category of CATEGORIES) {
    let on = category.triggers.some((trigger) => mentions(raw, trigger));
    if (category.id === "peanut" && bareNuts) on = true;
    if (category.id === "tree nut" && (bareNuts || treeNuts)) on = true;
    if ((category.id === "fish" || category.id === "shellfish") && seafood) on = true;
    if (on) active.push(category);
  }

  const rules = active.map((category) => ({
    id: category.id,
    label: category.label,
    phrases: [...category.phrases],
    hints: HINTS[category.id] ?? category.phrases.slice(0, 4),
  }));

  const triggers = new Set(active.flatMap((category) => category.triggers));
  if (bareNuts) {
    triggers.add("nut");
    triggers.add("nuts");
  }
  if (seafood) triggers.add("seafood");

  const customs = [];
  for (const token of tokenize(raw)) {
    if (mentionsToken(token, triggers)) continue;
    const words = token.split(/\s+/).filter((word) => word && !FILLER.has(word) && word.length > 2);
    if (!words.length) continue;
    customs.push(words.join(" "));
  }

  for (const phrase of [...new Set(customs)]) {
    rules.push({
      id: `custom:${phrase}`,
      label: phrase.replace(/\b[a-z]/g, (letter) => letter.toUpperCase()),
      phrases: variants(phrase),
      hints: variants(phrase).slice(0, 4),
    });
  }

  return rules;
}

function mentionsToken(token, triggers) {
  for (const trigger of triggers) {
    if (mentions(token, trigger)) return true;
  }
  return false;
}

export function expandRules(allergies, avoids) {
  return {
    hard: expandList(allergies),
    soft: expandList(avoids),
  };
}

export function bannedPhrases(rules) {
  const all = [...(rules?.hard ?? []), ...(rules?.soft ?? [])].flatMap((rule) => rule.phrases);
  return [...new Set(all)].sort((a, b) => b.length - a.length).slice(0, 80);
}

function findHits(prepared, phrases) {
  let haystack = prepared;
  const hits = [];
  const ordered = [...new Set(phrases.map((phrase) => phrase.toLowerCase()))].sort((a, b) => b.length - a.length);
  for (const phrase of ordered) {
    const pattern = wholeWord(phrase);
    if (pattern.test(haystack)) {
      hits.push(phrase);
      haystack = haystack.replace(pattern, " ");
    }
  }
  return hits;
}

export function scanRecipe(recipe, rules) {
  const prepared = prepare(recipe);
  const hits = [];
  for (const rule of rules?.hard ?? []) {
    for (const phrase of findHits(prepared, rule.phrases)) {
      hits.push({ phrase, severity: "allergy", rule: rule.label });
    }
  }
  for (const rule of rules?.soft ?? []) {
    for (const phrase of findHits(prepared, rule.phrases)) {
      if (!hits.some((hit) => hit.phrase === phrase)) {
        hits.push({ phrase, severity: "avoid", rule: rule.label });
      }
    }
  }
  return { ok: hits.length === 0, hits };
}
