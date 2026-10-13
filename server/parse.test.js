import assert from "node:assert/strict";
import test from "node:test";
import { reviewDraft } from "./plan.js";
import { parseMeal, parseSteps } from "./parse.js";
import { buildPrompt } from "./prompt.js";
import { expandRules } from "./safety.js";

test("parses a dinner card and ignores a none shop line", () => {
  const meal = parseMeal(`Sure, here you go.
TITLE: Lemon tomato egg rice
BECAUSE: It uses the eggs and reheats.
USES: eggs, rice, tomato, lemon
STEPS:
1. Fry the tomato.
2. Scramble in the eggs.
3. Fold through the rice.
SHOP: none`);

  assert.equal(meal.ok, true);
  assert.equal(meal.title, "Lemon tomato egg rice");
  assert.equal(meal.steps.length, 3);
  assert.equal(meal.shop, "");
  assert.match(meal.uses, /eggs/);
});

test("pulls short steps out of a markdown draft", () => {
  const steps = parseSteps(`**TITLE:** Tomato Rice Salad

**STEPS**:
- **Step 1**, chop an onion into fine pieces to add flavor without overpowering other ingredients in our recipe.
- **Step 2**, mix the onion with rice and tomato.
`);
  assert.equal(steps.length, 2);
  assert.match(steps[0], /^Chop an onion/);
  assert.ok(steps[0].length < 160);
  assert.match(steps[1], /rice and tomato/);
});

test("the prompt names the banned foods and starts the dish line", () => {
  const rules = expandRules("peanuts, shellfish, lactose", "cilantro, mushrooms");
  const messages = buildPrompt({
    profile: {
      name: "Sample roommate",
      loves: "dal, eggs",
      notes: "One pan.",
    },
    fridge: "eggs, rice, tomato",
    minutes: 30,
    rules,
    behavior: "Follow the rules.",
    earlierMiss: "",
  });
  assert.equal(messages[0].content, "Follow the rules.");
  assert.match(messages[1].content, /peanut oil/);
  assert.match(messages[1].content, /paneer/);
  assert.match(messages[1].content, /prawn/);
  assert.match(messages[1].content, /cilantro/);
  assert.match(messages[1].content, /Sample roommate/);
  assert.match(messages[1].content, /dish name/i);
  assert.doesNotMatch(messages[1].content, /short dish name/);
});

test("a real kitchen draft is accepted and a copied blank card is not", () => {
  const rules = expandRules("peanuts, shellfish, lactose", "cilantro, mushrooms");
  const fridge = "eggs, rice, onion, tomato, lemon";
  const good = reviewDraft(`Lemon tomato egg rice
BECAUSE: It reheats and uses the eggs.
USES: eggs, rice, tomato, lemon
STEPS:
1. Fry the tomato and onion.
2. Scramble in the eggs.
3. Fold through the rice and lemon.
SHOP: none`, fridge, rules);
  assert.equal(good.accept, true);

  const copied = reviewDraft(`short dish name
BECAUSE: one sentence about why it fits this person
USES: foods from the kitchen, separated by commas
STEPS:
1. first step
2. second step
3. third step
SHOP: none`, fridge, rules);
  assert.equal(copied.accept, false);
  assert.equal(copied.safety.ok, true);

  const unsafe = reviewDraft(`Prawn rice
BECAUSE: It is fast.
USES: prawn, rice
STEPS:
1. Fry the prawn.
2. Add rice.
3. Serve.
SHOP: none`, fridge, rules);
  assert.equal(unsafe.safety.ok, false);
  assert.equal(unsafe.accept, false);
});
