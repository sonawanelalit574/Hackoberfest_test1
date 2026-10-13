const fields = ["name", "allergies", "avoids", "loves", "notes"];
const state = { sample: true, rules: { hard: [], soft: [] }, polling: 0 };

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function request(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 422) {
    throw new Error(body.error || "The laptop could not finish that.");
  }
  return body;
}

function readProfileForm() {
  const profile = { sample: state.sample };
  for (const field of fields) profile[field] = $(field).value.trim();
  return profile;
}

function fillProfile(profile) {
  state.sample = Boolean(profile.sample);
  for (const field of fields) $(field).value = profile[field] || "";
  $("sample-banner").hidden = !state.sample;
}

function renderRules(rules) {
  state.rules = rules;
  const rows = [
    ...(rules.hard || []).map((rule) => ({ ...rule, tone: "hard" })),
    ...(rules.soft || []).map((rule) => ({ ...rule, tone: "soft" })),
  ];
  $("rule-list").innerHTML = rows.length
    ? rows.map((rule) => `
        <div class="rule ${rule.tone}">
          <strong>${escapeHtml(rule.label)}</strong>
          <span>${escapeHtml(rule.phrases.slice(0, 12).join(", "))}</span>
        </div>
      `).join("")
    : `<p class="empty">No hard rules yet. Add an allergy or a won't-eat food.</p>`;
}

function renderStatus(status) {
  const card = $("status");
  card.className = `status ${status.state || "idle"}`;
  const shortModel = (status.model || "Model").split("/").at(-1);
  $("status-label").textContent = shortModel;
  let message = status.message || "Waiting.";
  if ((status.state === "downloading" || status.state === "generating") && status.startedAt) {
    const seconds = Math.max(0, Math.round((Date.now() - status.startedAt) / 1000));
    message += ` · ${seconds}s`;
  }
  $("status-message").textContent = message;
  const wrap = $("status-bar-wrap");
  wrap.hidden = status.state !== "downloading";
  $("status-bar").style.width = `${Math.max(0, Math.min(100, status.progress || 0))}%`;
}

function startPolling() {
  if (state.polling) return;
  state.polling = window.setInterval(async () => {
    try {
      renderStatus(await request("/api/status"));
    } catch {
      // The plan request will surface the real error.
    }
  }, 700);
}

function stopPolling() {
  window.clearInterval(state.polling);
  state.polling = 0;
}

async function saveProfile() {
  const payload = await request("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(readProfileForm()),
  });
  fillProfile(payload.profile);
  renderRules(payload.rules);
  return payload;
}

function verdict(ok, name, hits) {
  if (ok) {
    return `<p class="verdict safe">Clear for ${escapeHtml(name)}. Nothing on their list showed up.</p>`;
  }
  const lines = (hits || []).map((hit) => `${hit.phrase} (${hit.rule})`).join(", ");
  return `<p class="verdict blocked">Don't cook this for ${escapeHtml(name)}. Found ${escapeHtml(lines)}.</p>`;
}

function renderMeal(result) {
  const host = $("meal");
  if (!result.ok) {
    host.innerHTML = `<p class="verdict blocked">${escapeHtml(result.error)}</p>`;
    return;
  }
  const meal = result.meal;
  const checked = [...state.rules.hard, ...state.rules.soft].map((rule) => rule.label).join(", ");
  const retry = result.attempts > 1
    ? `<p class="fine">An earlier draft was discarded. This one passed the check.</p>`
    : "";
  const loose = result.loose
    ? `<p class="fine">This passed the allergy check. It may wander off the kitchen list, so read it before you cook.</p>`
    : "";
  if (!meal.ok) {
    host.innerHTML = `
      ${verdict(true, $("name").value, [])}
      <p class="fine">The model did not use the recipe card, so here is the safe text it did write.</p>
      <pre class="raw">${escapeHtml(result.raw || "")}</pre>
      ${retry}
      ${loose}
    `;
    return;
  }
  const shop = meal.shop ? `<p class="shop"><strong>Still need:</strong> ${escapeHtml(meal.shop)}</p>` : "";
  host.innerHTML = `
    <article class="recipe">
      <p class="kicker">Tonight</p>
      <h3>${escapeHtml(meal.title)}</h3>
      <p class="because">${meal.because ? escapeHtml(meal.because) : "Uses what is in the kitchen and stays inside their rules."}</p>
      <p class="uses">From the kitchen: ${escapeHtml(meal.uses || "see the steps")}</p>
      <ol>${meal.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      ${shop}
    </article>
    <p class="stamp safe">Checked on this laptop against ${escapeHtml(checked || "their list")}.</p>
    ${retry}
    ${loose}
  `;
}

function renderHistory(history) {
  const list = $("history");
  if (!history.length) {
    list.innerHTML = `<li class="empty">Nothing planned yet.</li>`;
    return;
  }
  list.innerHTML = history.map((item) => `
    <li>
      <strong>${escapeHtml(item.title)}</strong><br>
      <time datetime="${escapeHtml(item.at)}">${escapeHtml(new Date(item.at).toLocaleString())}</time>
    </li>
  `).join("");
}

async function refreshStatus() {
  renderStatus(await request("/api/status"));
}

async function load() {
  const [profile, settings, prompt, history] = await Promise.all([
    request("/api/profile"),
    request("/api/settings"),
    request("/api/prompt"),
    request("/api/history"),
  ]);
  fillProfile(profile.profile);
  renderRules(profile.rules);
  $("model").value = settings.model;
  $("dtype").value = settings.dtype;
  $("max-tokens").value = settings.maxNewTokens;
  $("prompt").value = prompt.text.trim();
  renderHistory(history.history || []);
  await refreshStatus();
}

$("profile-form").addEventListener("input", () => {
  state.sample = false;
});

$("profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveProfile();
    $("save-note").textContent = "Saved on this laptop.";
  } catch (error) {
    $("save-note").textContent = error.message;
  }
});

$("dismiss-sample").addEventListener("click", async () => {
  state.sample = false;
  await saveProfile();
});

$("restore-sample").addEventListener("click", async () => {
  const payload = await request("/api/profile/reset", { method: "POST" });
  fillProfile(payload.profile);
  renderRules(payload.rules);
  $("save-note").textContent = "Sample roommate restored.";
});

$("sample-kitchen").addEventListener("click", () => {
  $("fridge").value = "eggs, rice, onion, tomato, lemon, green chili, oil, salt, cumin, turmeric";
});

$("plan-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("plan-button");
  button.disabled = true;
  $("meal").innerHTML = `<p class="fine">Saving their rules, then writing on this CPU. A plan often takes about a minute. The first one also downloads the open model.</p>`;
  startPolling();
  try {
    await saveProfile();
    const result = await request("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fridge: $("fridge").value, minutes: Number($("minutes").value) }),
    });
    renderMeal(result);
    renderHistory((await request("/api/history")).history || []);
  } catch (error) {
    $("meal").innerHTML = `<p class="verdict blocked">${escapeHtml(error.message)}</p>`;
  } finally {
    stopPolling();
    button.disabled = false;
    try { await refreshStatus(); } catch { /* status is decorative if the plan already failed */ }
  }
});

for (const chip of document.querySelectorAll(".chip")) {
  chip.addEventListener("click", () => {
    $("recipe").value = chip.dataset.recipe;
    $("check-form").requestSubmit();
  });
}

$("check-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveProfile();
    const result = await request("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe: $("recipe").value }),
    });
    $("check-result").innerHTML = verdict(result.ok, result.name, result.hits);
  } catch (error) {
    $("check-result").innerHTML = `<p class="verdict blocked">${escapeHtml(error.message)}</p>`;
  }
});

$("save-settings").addEventListener("click", async () => {
  try {
    const settings = await request("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: $("model").value,
        dtype: $("dtype").value,
        maxNewTokens: Number($("max-tokens").value),
      }),
    });
    $("behavior-note").textContent = `Next plan will use ${settings.model}.`;
    await refreshStatus();
  } catch (error) {
    $("behavior-note").textContent = error.message;
  }
});

$("save-prompt").addEventListener("click", async () => {
  try {
    await request("/api/prompt", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: $("prompt").value }),
    });
    $("behavior-note").textContent = "The cook's instructions are saved.";
  } catch (error) {
    $("behavior-note").textContent = error.message;
  }
});

load().catch((error) => {
  $("status-message").textContent = error.message;
});
