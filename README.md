# Second Plate

A dinner planner for one person you cook for. Their allergies, the foods they won't eat, and the notes about how they eat this month stay in a file on this laptop. [Qwen2.5-1.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct), an open-weight model under Apache 2.0, writes the meal. A checker in `server/safety.js` reads the same food list and hides the recipe if the model slips.

## Run it

```powershell
npm install
npm start
```

Open http://127.0.0.1:4317

The server listens on `127.0.0.1` only. The first plan downloads the quantized model (a few hundred megabytes) into `.cache`. Later plans use that copy.

```powershell
$env:SECOND_PLATE_OFFLINE = "1"
npm start
```

With that set, Transformers.js will not fetch weights again. Planning still works from the cache.

## Hand it to someone

1. Open the page and replace the sample roommate with the real person: name, allergies, foods they won't eat, foods they love, and how they eat right now.
2. Type what is actually in the kitchen.
3. Plan tonight. Read the card with them. The green line is the checker, not the model's opinion.
4. If a draft mentions a forbidden food, the page hides the steps and asks the model for a different dish.

Naming one nut, one shellfish, or one dairy food blocks that whole family, and the page shows the expanded list. A won't-eat word blocks that word and a few obvious aliases (cilantro also blocks dhaniya and fresh coriander, and it leaves coriander powder alone).

## Why the open model is the product

- The profile is household health data. A closed chat API would receive it on every plan. Here the weights run on the CPU, and the profile never leaves the machine.
- After the download, it plans with no account, no key, and no per-meal fee.
- The cook's job description is `prompts/cook.txt`. Edit it in the page. The next plan follows the new instructions.
- The model id is a setting. Point it at another Transformers.js text-generation model when you want a bigger open model. The checker stays the same.
- The checker is plain code with tests (`npm test`). You can see exactly which words it treats as peanut, dairy, or shellfish.

## Tests

```powershell
npm test
```

The tests cover the food list, the recipe card parser, and the pages that work before the model has been downloaded.
