import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./index.js";

async function withServer(run) {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("profile and recipe check work before the model is downloaded", async () => {
  await withServer(async (base) => {
    const profileResponse = await fetch(`${base}/api/profile`);
    assert.equal(profileResponse.status, 200);
    const payload = await profileResponse.json();
    assert.equal(payload.profile.name, "Sample roommate");
    assert.ok(payload.rules.hard.some((rule) => rule.id === "peanut"));

    const bad = await fetch(`${base}/api/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe: "Rice fried in peanut oil with prawns" }),
    });
    const badBody = await bad.json();
    assert.equal(bad.status, 200);
    assert.equal(badBody.ok, false);
    assert.ok(badBody.hits.some((hit) => hit.phrase.includes("peanut")));

    const good = await fetch(`${base}/api/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe: "Lemon tomato eggs with rice" }),
    });
    assert.equal((await good.json()).ok, true);

    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Second Plate/);
  });
});
