---
title: Second Plate — a local dinner planner for the person I cook for
tags: devchallenge, weekendchallenge, hf26challenge, ai, opensource
---

## Second Plate

This is a submission for the Hacktoberfest Weekend Challenge: Build for a Friend.

I built Second Plate for the person I share a kitchen with. During a heavy month, dinner has to come from whatever is already in the house, reheat the next day, and stay inside a short list of allergies and foods they will not eat. I did not want that list sitting in a chat box on someone else's server.

The page has their name, allergies, won't-eat list, foods they love, and a note about how they are eating right now. I type what is in the kitchen and how many minutes I have. An open-weight model, Qwen2.5-1.5B-Instruct, names the dish and writes the steps. A checker I can read then scans the draft. If the model mentions a forbidden food, or a food that is not in the kitchen, the steps are hidden and it has to try again.

The sample roommate in the repo is only there so the app can be tried before it is handed over. Before I rely on it, I replace that profile with the real person.

## Demo

Run it locally:

```powershell
npm install
npm start
```

Open http://127.0.0.1:4317

Code: this repository.

The first plan downloads the model onto the laptop. After that, `SECOND_PLATE_OFFLINE=1` keeps it from fetching the weights again.

## Why open innovation mattered here

A closed model would have been the wrong default for this.

- Their allergies and the shape of their week are not something I want to send out with every dinner plan. The weights run on this CPU. The server binds to localhost. The profile is a JSON file next to the app.
- It costs nothing per meal after the one-time download. There is no API key to lose and no usage cap at 11pm.
- I can change how the cook behaves by editing `prompts/cook.txt`. I can swap the model id for another Transformers.js text-generation model without rewriting the checker.
- SmolLM2-360M was the first model I tried. It is open and small, and it kept inventing coconut milk and noodles that were not in the kitchen. Because the runtime takes any Transformers.js model id, I switched the default to Qwen2.5-1.5B-Instruct without rewriting the checker. A hosted chat box would have made that swap someone else's product decision.
- Plant milks, eggplant, coriander powder, and the phrase "peanut-free" are easy ways for a keyword filter to become silly. The checker has tests for those, and I can change them when I learn a new exception they care about.

## How it is built

- Model: `onnx-community/Qwen2.5-1.5B-Instruct`, quantized q4, through Transformers.js and ONNX Runtime on CPU. Any other Transformers.js text-generation model can be pasted into the settings.
- Rules: `server/safety.js` expands allergies into families (one shellfish blocks the family, lactose blocks ghee and paneer) and keeps won't-eat foods literal.
- The prompt and the checker share one list, from `bannedPhrases`.
- Interface: one page, no CDN, no account.

## What they said

[Write this after you hand it over. Keep their words. Do not invent a reaction.]

## Show your work

[Optional: save this agent session with DevRelay and embed it here.]
