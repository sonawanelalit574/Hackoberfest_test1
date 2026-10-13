function promptFoods(rules) {
  const chosen = [];
  for (const rule of [...(rules?.hard ?? []), ...(rules?.soft ?? [])]) {
    const phrases = rule.hints?.length ? rule.hints : rule.phrases.slice(0, 4);
    chosen.push(...phrases);
  }
  if (!chosen.length) return "none listed";
  return [...new Set(chosen.map((item) => item.toLowerCase()))].join(", ");
}

function messages(behavior, user) {
  return [
    { role: "system", content: String(behavior ?? "").trim() },
    { role: "user", content: user },
  ];
}

export function buildPrompt({ profile, fridge, minutes, rules, behavior, earlierMiss }) {
  const lines = [
    `Person: ${profile.name}`,
    `Minutes: ${minutes}`,
    `Kitchen: ${fridge}`,
    `They love: ${profile.loves || "simple food"}`,
    `Notes: ${profile.notes || "none"}`,
    `Never use: ${promptFoods(rules)}.`,
    "Reply with only the dish name. Use a food from the kitchen. Four words or fewer. No markdown.",
  ];
  if (earlierMiss) lines.push(`The last name failed because ${earlierMiss}.`);
  return messages(behavior, lines.join("\n"));
}

export function buildStepsPrompt({ profile, fridge, title, rules, behavior, earlierMiss }) {
  const lines = [
    `Dish: ${title}`,
    `Person: ${profile.name}`,
    `Kitchen: ${fridge}`,
    `Never use: ${promptFoods(rules)}.`,
    "Write exactly 3 steps. One short sentence each. Number them 1, 2, and 3. Use only the kitchen. No markdown.",
  ];
  if (earlierMiss) lines.push(`The last steps failed because ${earlierMiss}.`);
  return messages(behavior, lines.join("\n"));
}
