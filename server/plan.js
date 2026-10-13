import { clipToCard, groundedInKitchen, inventedFoods, isUsableMeal, kitchenWords, parseMeal, parseSteps, readOpening, withTitle, wordsUsed } from "./parse.js";
import { buildPrompt, buildStepsPrompt } from "./prompt.js";
import { scanRecipe } from "./safety.js";

export function reviewDraft(raw, fridge, rules) {
  const card = withTitle(clipToCard(raw));
  const meal = parseMeal(card);
  const scannedText = meal.ok
    ? [meal.title, meal.because, meal.uses, meal.steps.join("\n"), meal.shop].filter(Boolean).join("\n")
    : card;
  const safety = scanRecipe(scannedText, rules);
  const usable = isUsableMeal(meal);
  const grounded = usable && groundedInKitchen(meal, fridge);
  return { card, meal, safety, usable, grounded, accept: safety.ok && usable && grounded };
}

function cleanTitle(title) {
  return String(title ?? "").replace(/\s+/g, " ").trim();
}

export async function createPlan({ fridge, minutes, profile, rules, behavior, settings, generate }) {
  let titleNote = "";
  let opening = null;
  let attempts = 0;
  let lastHits = [];
  const foods = kitchenWords(fridge).slice(0, 8);

  for (let tryTitle = 0; tryTitle < 3 && !opening; tryTitle += 1) {
    attempts += 1;
    const raw = await generate(
      buildPrompt({ profile, fridge, minutes, rules, behavior, earlierMiss: titleNote }),
      settings,
      { maxNewTokens: 16, message: "Naming a dish on this CPU." },
    );
    const read = readOpening(raw);
    const title = cleanTitle(read.title);
    const titleSafety = scanRecipe(`${title}\n${read.because}`, rules);
    const namedKitchen = wordsUsed(title, fridge).length >= 1;
    const invented = inventedFoods(title, fridge);
    const shortEnough = title.split(/\s+/).length <= 8;
    if (title.length >= 3 && titleSafety.ok && namedKitchen && invented.length === 0 && shortEnough) {
      const becauseSafety = scanRecipe(read.because, rules);
      opening = { title, because: becauseSafety.ok ? read.because : "" };
      continue;
    }
    if (!titleSafety.ok) {
      lastHits = titleSafety.hits;
      titleNote = `it used forbidden foods (${titleSafety.hits.map((hit) => hit.phrase).join(", ")})`;
    } else if (invented.length) {
      titleNote = `it added ${invented.join(", ")}, which is not in the kitchen`;
    } else if (!shortEnough) {
      titleNote = "the name was too long. Use four words or fewer";
    } else {
      titleNote = `the name did not use the kitchen. Use one of: ${foods.join(", ")}`;
    }
  }

  if (!opening) {
    const mentioned = lastHits.map((hit) => hit.phrase).join(", ");
    return {
      ok: false,
      error: mentioned
        ? `The model mentioned a forbidden food (${mentioned}), so the recipe was hidden.`
        : "The model could not name a dish from this kitchen.",
      hits: lastHits,
      attempts,
      model: settings.model,
    };
  }

  let stepNote = "";
  for (let trySteps = 0; trySteps < 2; trySteps += 1) {
    attempts += 1;
    const raw = await generate(
      buildStepsPrompt({
        profile,
        fridge,
        title: opening.title,
        rules,
        behavior,
        earlierMiss: stepNote,
      }),
      settings,
      { maxNewTokens: 90, message: "Writing the steps on this CPU." },
    );
    const steps = parseSteps(raw).filter((step) => step.length > 8);
    const tooLong = steps.some((step) => step.length > 160);
    const body = `${opening.title}\n${opening.because}\n${steps.join("\n")}`;
    const safety = scanRecipe(body, rules);
    const invented = inventedFoods(body, fridge);
    const used = wordsUsed(body, fridge);
    if (steps.length >= 2 && steps.length <= 4 && safety.ok && invented.length === 0 && used.length >= 2 && !tooLong) {
      return {
        ok: true,
        meal: {
          title: opening.title,
          because: opening.because,
          uses: used.join(", "),
          shop: "",
          steps: steps.slice(0, 3),
          ok: true,
        },
        safety,
        attempts,
        model: settings.model,
      };
    }
    if (!safety.ok) {
      lastHits = safety.hits;
      stepNote = `it used forbidden foods (${safety.hits.map((hit) => hit.phrase).join(", ")})`;
    } else if (invented.length) {
      stepNote = `it added ${invented.join(", ")}, which is not in the kitchen`;
    } else if (tooLong) {
      stepNote = "the steps were too long. Write one short sentence each";
    } else {
      stepNote = `the steps did not cook the foods in the kitchen (${foods.join(", ")})`;
    }
  }

  const mentioned = lastHits.map((hit) => hit.phrase).join(", ");
  return {
    ok: false,
    error: mentioned
      ? `The model mentioned a forbidden food (${mentioned}), so the recipe was hidden.`
      : "The model could not write steps that stay inside this kitchen.",
    hits: lastHits,
    attempts,
    model: settings.model,
  };
}
