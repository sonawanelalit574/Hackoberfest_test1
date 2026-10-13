import assert from "node:assert/strict";
import test from "node:test";
import { expandRules, scanRecipe } from "./safety.js";

const sample = () => expandRules("peanuts, shellfish, lactose", "cilantro, mushrooms");

function phrases(rules, id) {
  return rules.hard.find((rule) => rule.id === id)?.phrases ?? [];
}

test("sample allergies expand to families, not to plant milk or eggplant", () => {
  const rules = sample();
  assert.ok(phrases(rules, "peanut").includes("peanut oil"));
  assert.ok(phrases(rules, "peanut").includes("satay"));
  assert.ok(phrases(rules, "shellfish").includes("prawn"));
  assert.ok(phrases(rules, "dairy").includes("paneer"));
  assert.ok(phrases(rules, "dairy").includes("ghee"));
  assert.equal(rules.hard.some((rule) => rule.id === "fish"), false);
  assert.ok(rules.soft.some((rule) => rule.phrases.includes("cilantro")));
  assert.ok(rules.soft.some((rule) => rule.phrases.includes("mushroom")));
});

test("tree nuts do not ban peanuts, and the word nuts bans both families", () => {
  const treeOnly = expandRules("tree nuts", "");
  assert.equal(treeOnly.hard.some((rule) => rule.id === "peanut"), false);
  assert.equal(scanRecipe("peanut butter on toast", treeOnly).ok, true);

  const nuts = expandRules("nuts", "");
  assert.equal(scanRecipe("peanut oil", nuts).ok, false);
  assert.equal(scanRecipe("a walnut tart", nuts).ok, false);
});

test("safe dinners pass and lookalikes do not get flagged", () => {
  const rules = sample();
  const safe = scanRecipe(
    "Tomato egg rice. Fry onion and tomato, scramble in eggs, fold through rice, finish with lemon.",
    rules,
  );
  assert.equal(safe.ok, true);
  assert.equal(scanRecipe("Coconut milk rice with chili and lime", rules).ok, true);
  assert.equal(scanRecipe("Roasted eggplant with rice", expandRules("eggs", "")).ok, true);
  assert.equal(scanRecipe("Almond milk oatmeal", expandRules("lactose", "")).ok, true);
  assert.equal(scanRecipe("Coconut cream curry with rice", rules).ok, true);
  assert.equal(scanRecipe("A peanut-free lemon dal", rules).ok, true);
  assert.equal(scanRecipe("No peanuts. Lemon rice with egg and tomato.", rules).ok, true);
  assert.equal(scanRecipe("Sprinkle coriander powder over the dal", rules).ok, true);
});

test("forbidden foods are caught, including hidden names and a later real use", () => {
  const rules = sample();
  assert.equal(scanRecipe("Toss the rice with peanut oil", rules).ok, false);
  assert.equal(scanRecipe("No peanuts, then fry it in peanut oil", rules).ok, false);
  assert.equal(scanRecipe("Paneer bhurji", rules).ok, false);
  assert.equal(scanRecipe("Finish with a spoon of ghee", rules).ok, false);
  assert.equal(scanRecipe("Prawn pulao", rules).ok, false);
  assert.equal(scanRecipe("Fold in fresh coriander", rules).ok, false);
  assert.equal(scanRecipe("Add coriander and lemon", rules).ok, false);
  assert.equal(scanRecipe("Garlic mushrooms on toast", rules).ok, false);
  assert.equal(scanRecipe("Satay sauce noodles", rules).ok, false);
});

test("a named family member blocks the rest of that family", () => {
  const shrimp = expandRules("shrimp", "");
  assert.equal(scanRecipe("Crab cakes", shrimp).ok, false);
  const salmon = expandRules("salmon", "");
  assert.equal(salmon.hard.some((rule) => rule.id === "fish"), false);
  assert.equal(scanRecipe("A tuna sandwich", salmon).ok, true);
  assert.equal(scanRecipe("Grilled salmon", salmon).ok, false);
});

test("soy milk is soy, not dairy, and shellfish is not fish", () => {
  assert.equal(scanRecipe("Soy milk rice", expandRules("soy", "")).ok, false);
  assert.equal(scanRecipe("Soy milk rice", expandRules("lactose", "")).ok, true);
  assert.equal(scanRecipe("Salmon and rice", expandRules("shellfish", "")).ok, true);
});
