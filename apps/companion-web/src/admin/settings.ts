/**
 * Admin settings panel — edit interests, tick interval, model names, budget, personality.
 */

import { getStoredToken, getApiBase } from "./login.js";

export function renderSettings(container: HTMLElement): void {
  container.innerHTML = `
    <div class="admin-dashboard">
      <header class="admin-header">
        <h1>NTS Admin — Settings</h1>
        <button id="admin-logout" class="admin-logout-btn">Logout</button>
      </header>
      <nav class="admin-nav">
        <a href="#/admin/dashboard">Dashboard</a>
        <a href="#/admin/logs">Logs</a>
        <a href="#/admin/settings" class="nav-active">Settings</a>
        <a href="#/admin/controls">Controls</a>
      </nav>
      <div class="settings-form" id="settings-form">
        <div class="card">
          <h2>Interests</h2>
          <div id="interests-tags" class="tag-container"></div>
          <div class="tag-input-row">
            <input type="text" id="interest-input" placeholder="Add interest..." class="settings-input" />
            <button id="add-interest" class="btn-small">Add</button>
          </div>
        </div>
        <div class="card">
          <h2>Tick Interval</h2>
          <input type="range" id="tick-interval" min="15" max="120" value="30" class="settings-range" />
          <span id="tick-interval-label">30s</span>
        </div>
        <div class="card">
          <h2>Models</h2>
          <label class="settings-label">Think Model
            <input type="text" id="think-model" class="settings-input" placeholder="deepseek/deepseek-chat" />
          </label>
          <label class="settings-label">Classify Model
            <input type="text" id="classify-model" class="settings-input" placeholder="mistralai/mistral-small-latest" />
          </label>
        </div>
        <div class="card">
          <h2>Daily Budget</h2>
          <input type="number" id="daily-budget" min="1" max="100" value="20" class="settings-input" />
          <span>tool calls/day</span>
        </div>
        <div class="card">
          <h2>Personality Prompt</h2>
          <textarea id="personality-prompt" class="settings-textarea" rows="6" placeholder="System prompt..."></textarea>
        </div>
        <button id="save-settings" class="login-button">Save Settings</button>
        <div id="settings-toast" class="settings-toast" hidden></div>
      </div>
    </div>
  `;

  const token = getStoredToken();
  let interests: string[] = [];

  const interestsEl = container.querySelector("#interests-tags") as HTMLDivElement;
  const interestInput = container.querySelector("#interest-input") as HTMLInputElement;
  const tickSlider = container.querySelector("#tick-interval") as HTMLInputElement;
  const tickLabel = container.querySelector("#tick-interval-label") as HTMLSpanElement;
  const toastEl = container.querySelector("#settings-toast") as HTMLDivElement;

  function renderInterests(): void {
    interestsEl.innerHTML = interests.map((tag, i) =>
      `<span class="tag">${escapeHtml(tag)} <button class="tag-remove" data-idx="${i}">&times;</button></span>`
    ).join("");

    interestsEl.querySelectorAll(".tag-remove").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number((btn as HTMLElement).dataset.idx);
        interests.splice(idx, 1);
        renderInterests();
      });
    });
  }

  container.querySelector("#add-interest")?.addEventListener("click", () => {
    const val = interestInput.value.trim();
    if (val && !interests.includes(val)) {
      interests.push(val);
      interestInput.value = "";
      renderInterests();
    }
  });

  tickSlider.addEventListener("input", () => {
    tickLabel.textContent = `${tickSlider.value}s`;
  });

  // Load current settings
  if (token) {
    fetch(`${getApiBase()}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => res.ok ? res.json() : null).then(data => {
      if (!data) return;
      if (data.interests) {
        interests = data.interests;
        renderInterests();
      }
      if (data.config) {
        const tickMs = data.config.tickIntervalMs;
        if (tickMs) {
          const secs = Math.round(tickMs / 1000);
          tickSlider.value = String(secs);
          tickLabel.textContent = `${secs}s`;
        }
        if (data.config.systemPrompt) {
          (container.querySelector("#personality-prompt") as HTMLTextAreaElement).value = data.config.systemPrompt;
        }
      }
    });
  }

  // Save settings
  container.querySelector("#save-settings")?.addEventListener("click", async () => {
    if (!token) return;

    const tickMs = Number(tickSlider.value) * 1000;
    const payload: Record<string, unknown> = {
      interests,
      tickIntervalMs: tickMs,
    };

    const thinkModel = (container.querySelector("#think-model") as HTMLInputElement).value;
    const classifyModel = (container.querySelector("#classify-model") as HTMLInputElement).value;
    if (thinkModel) payload.thinkModel = thinkModel;
    if (classifyModel) payload.classifyModel = classifyModel;

    const prompt = (container.querySelector("#personality-prompt") as HTMLTextAreaElement).value;
    if (prompt) payload.systemPrompt = prompt;

    const budget = (container.querySelector("#daily-budget") as HTMLInputElement).value;
    if (budget) payload.dailyBudget = Number(budget);

    try {
      const res = await fetch(`${getApiBase()}/api/admin/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(toastEl, "Saved!");
      } else {
        showToast(toastEl, "Save failed", true);
      }
    } catch {
      showToast(toastEl, "Save failed", true);
    }
  });

  container.querySelector("#admin-logout")?.addEventListener("click", () => {
    localStorage.removeItem("nts_admin_token");
    window.location.hash = "#/admin/login";
    window.location.reload();
  });
}

function showToast(el: HTMLDivElement, msg: string, isError = false): void {
  el.textContent = msg;
  el.className = `settings-toast ${isError ? "toast-error" : "toast-success"}`;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 3000);
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
