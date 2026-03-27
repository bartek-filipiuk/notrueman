/**
 * Admin dashboard — DB-backed with HTTP polling.
 * Sections: Stats bar, Memories list, LLM Calls list, State History.
 * Polls every 10s from REST API.
 */

import { getStoredToken, getApiBase } from "./login.js";

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(ts: string | number): string {
  return new Date(ts).toLocaleTimeString();
}

function formatDate(ts: string | number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

const TYPE_COLORS: Record<string, string> = {
  observation: "#3498db",
  reflection: "#9b59b6",
  plan: "#2ecc71",
};

const MOOD_EMOJIS: Record<string, string> = {
  happy: "😊", sad: "😢", neutral: "😐", curious: "🤔", anxious: "😰",
  excited: "🤩", bored: "😴", content: "😌", frustrated: "😤",
};

export function renderDashboard(container: HTMLElement): void {
  const token = getStoredToken();

  container.innerHTML = `
    <div class="admin-dashboard">
      <header class="admin-header">
        <h1>NTS Admin Dashboard</h1>
        <button id="admin-logout" class="admin-logout-btn">Logout</button>
      </header>
      <nav class="admin-nav">
        <a href="#/admin/dashboard" class="nav-active">Dashboard</a>
        <a href="#/admin/logs">Logs</a>
        <a href="#/admin/settings">Settings</a>
        <a href="#/admin/controls">Controls</a>
      </nav>
      <div id="stats-bar" class="stats-bar">Loading stats...</div>
      <div class="dashboard-grid">
        <div class="card" id="memories-card">
          <h2>Recent Memories</h2>
          <div class="card-filters">
            <select id="mem-type-filter" class="log-select">
              <option value="">All types</option>
              <option value="observation">Observation</option>
              <option value="reflection">Reflection</option>
              <option value="plan">Plan</option>
            </select>
            <input id="mem-importance-filter" type="range" min="1" max="10" value="1" class="settings-range" title="Min importance" />
            <span id="mem-importance-val" class="filter-value">1+</span>
          </div>
          <div id="memories-content">Loading...</div>
        </div>
        <div class="card" id="llm-card">
          <h2>LLM Calls</h2>
          <div class="card-filters">
            <select id="llm-model-filter" class="log-select">
              <option value="">All models</option>
            </select>
            <label class="log-autoscroll">
              <input type="checkbox" id="llm-success-filter" checked /> Success only
            </label>
          </div>
          <div id="llm-content">Loading...</div>
        </div>
      </div>
      <div class="card" id="state-card">
        <h2>State History</h2>
        <div id="state-content">Loading...</div>
      </div>
    </div>
    <div id="detail-modal" class="detail-modal hidden">
      <div class="modal-backdrop"></div>
      <div class="modal-body">
        <button class="modal-close">&times;</button>
        <div id="modal-content"></div>
      </div>
    </div>
  `;

  const statsEl = container.querySelector("#stats-bar") as HTMLDivElement;
  const memoriesEl = container.querySelector("#memories-content") as HTMLDivElement;
  const llmEl = container.querySelector("#llm-content") as HTMLDivElement;
  const stateEl = container.querySelector("#state-content") as HTMLDivElement;
  const modal = container.querySelector("#detail-modal") as HTMLDivElement;
  const modalContent = container.querySelector("#modal-content") as HTMLDivElement;

  // Modal handlers
  function showModal(html: string): void {
    modalContent.innerHTML = html;
    modal.classList.remove("hidden");
  }

  function hideModal(): void {
    modal.classList.add("hidden");
  }

  modal.querySelector(".modal-backdrop")?.addEventListener("click", hideModal);
  modal.querySelector(".modal-close")?.addEventListener("click", hideModal);

  // State for filters
  let memTypeFilter = "";
  let memMinImportance = 1;
  let llmModelFilter = "";
  let llmSuccessOnly = true;

  // Data caches
  let memoriesData: any[] = [];
  let llmData: any[] = [];

  const memTypeEl = container.querySelector("#mem-type-filter") as HTMLSelectElement;
  const memImpEl = container.querySelector("#mem-importance-filter") as HTMLInputElement;
  const memImpValEl = container.querySelector("#mem-importance-val") as HTMLSpanElement;
  const llmModelEl = container.querySelector("#llm-model-filter") as HTMLSelectElement;
  const llmSuccessEl = container.querySelector("#llm-success-filter") as HTMLInputElement;

  memTypeEl.addEventListener("change", () => { memTypeFilter = memTypeEl.value; fetchAll(); });
  memImpEl.addEventListener("input", () => {
    memMinImportance = Number(memImpEl.value);
    memImpValEl.textContent = `${memMinImportance}+`;
    fetchAll();
  });
  llmModelEl.addEventListener("change", () => { llmModelFilter = llmModelEl.value; fetchAll(); });
  llmSuccessEl.addEventListener("change", () => { llmSuccessOnly = !llmSuccessEl.checked ? false : true; fetchAll(); });

  async function apiFetch(path: string): Promise<any> {
    const res = await fetch(`${getApiBase()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }

  function renderStats(stats: any): void {
    if (!stats) { statsEl.innerHTML = "<p>Stats unavailable</p>"; return; }
    const costColor = stats.totalCostUsd > 5 ? "var(--accent-red)" : "var(--accent-green)";
    const errColor = stats.errorCount > 0 ? "var(--accent-red)" : "var(--accent-green)";
    statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-value">${stats.callsToday}</div><div class="stat-label">Calls Today</div></div>
      <div class="stat-card"><div class="stat-value">${stats.totalTokensIn}/${stats.totalTokensOut}</div><div class="stat-label">Tokens In/Out</div></div>
      <div class="stat-card" style="border-color:${costColor}"><div class="stat-value">$${Number(stats.totalCostUsd).toFixed(4)}</div><div class="stat-label">Cost</div></div>
      <div class="stat-card" style="border-color:${errColor}"><div class="stat-value">${stats.errorCount}</div><div class="stat-label">Errors</div></div>
      <div class="stat-card"><div class="stat-value">${stats.avgDurationMs}ms</div><div class="stat-label">Avg Duration</div></div>
      <div class="stat-card"><div class="stat-value">${stats.memoriesCount ?? 0}</div><div class="stat-label">Memories</div></div>
    `;
  }

  function renderMemories(): void {
    if (memoriesData.length === 0) {
      memoriesEl.innerHTML = "<p>No memories found</p>";
      return;
    }
    memoriesEl.innerHTML = memoriesData.map((m: any, i: number) => {
      const color = TYPE_COLORS[m.type] ?? "#888";
      const imp = m.importance ?? 5;
      const impPct = imp * 10;
      const moodKey = Object.keys(m.emotionalContext ?? {})[0] ?? "neutral";
      const emoji = MOOD_EMOJIS[moodKey] ?? "😐";
      return `<div class="mem-row" data-idx="${i}">
        <span class="log-time">${formatTime(m.createdAt ?? m.created_at)}</span>
        <span class="log-type-badge" style="background:${color}">${m.type}</span>
        <span class="mem-desc">${escapeHtml((m.description ?? "").slice(0, 100))}</span>
        <span class="mem-imp"><span class="imp-bar" style="width:${impPct}%"></span>${imp}</span>
        <span class="mem-mood">${emoji}</span>
      </div>`;
    }).join("");

    memoriesEl.querySelectorAll(".mem-row").forEach((row) => {
      row.addEventListener("click", () => {
        const idx = Number((row as HTMLElement).dataset.idx);
        const m = memoriesData[idx];
        if (!m) return;
        showModal(`
          <h3>Memory Detail</h3>
          <p><strong>Type:</strong> ${m.type} | <strong>Importance:</strong> ${m.importance}</p>
          <p><strong>Created:</strong> ${formatDate(m.createdAt ?? m.created_at)}</p>
          <div class="modal-section"><strong>Description</strong><pre class="modal-pre">${escapeHtml(m.description ?? "")}</pre></div>
          <div class="modal-section"><strong>Emotional Context</strong><pre class="modal-pre">${escapeHtml(JSON.stringify(m.emotionalContext ?? m.emotional_context ?? {}, null, 2))}</pre></div>
          <div class="modal-section"><strong>Metadata</strong><pre class="modal-pre">${escapeHtml(JSON.stringify(m.metadata ?? {}, null, 2))}</pre></div>
        `);
      });
    });
  }

  function renderLLMCalls(): void {
    if (llmData.length === 0) {
      llmEl.innerHTML = "<p>No LLM calls found</p>";
      return;
    }
    // Populate model dropdown with unique models
    const models = [...new Set(llmData.map((c: any) => c.model))];
    const currentOpts = Array.from(llmModelEl.options).map(o => o.value);
    models.forEach(m => {
      if (!currentOpts.includes(m)) {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m.split("/").pop() ?? m;
        llmModelEl.appendChild(opt);
      }
    });

    llmEl.innerHTML = llmData.map((c: any, i: number) => {
      const ok = c.success !== false;
      const rowClass = ok ? "" : "llm-row-error";
      const badge = ok ? '<span class="badge-ok">OK</span>' : '<span class="badge-fail">FAIL</span>';
      return `<div class="llm-row ${rowClass}" data-idx="${i}">
        <span class="log-time">${formatTime(c.createdAt ?? c.created_at)}</span>
        <span class="llm-model">${(c.model ?? "").split("/").pop()}</span>
        <span class="llm-type">${c.callType ?? c.call_type}</span>
        <span class="llm-duration">${c.durationMs ?? c.duration_ms}ms</span>
        <span class="llm-tokens">${c.inputTokens ?? c.input_tokens ?? "?"}/${c.outputTokens ?? c.output_tokens ?? "?"}</span>
        <span class="llm-cost">$${Number(c.costUsd ?? c.cost_usd ?? 0).toFixed(4)}</span>
        ${badge}
      </div>`;
    }).join("");

    llmEl.querySelectorAll(".llm-row").forEach((row) => {
      row.addEventListener("click", () => {
        const idx = Number((row as HTMLElement).dataset.idx);
        const c = llmData[idx];
        if (!c) return;
        showModal(`
          <h3>LLM Call Detail</h3>
          <p><strong>Model:</strong> ${c.model} | <strong>Type:</strong> ${c.callType ?? c.call_type}</p>
          <p><strong>Duration:</strong> ${c.durationMs ?? c.duration_ms}ms | <strong>Tokens:</strong> ${c.inputTokens ?? c.input_tokens ?? "?"}in / ${c.outputTokens ?? c.output_tokens ?? "?"}out</p>
          <p><strong>Cost:</strong> $${Number(c.costUsd ?? c.cost_usd ?? 0).toFixed(6)} | <strong>Success:</strong> ${c.success !== false ? "Yes" : "No"}</p>
          ${c.error ? `<div class="modal-section modal-error"><strong>Error</strong><pre class="modal-pre">${escapeHtml(c.error)}</pre></div>` : ""}
          <div class="modal-section"><strong>Prompt Preview</strong><pre class="modal-pre">${escapeHtml(c.promptPreview ?? c.prompt_preview ?? "")}</pre></div>
          <div class="modal-section"><strong>System Preview</strong><pre class="modal-pre">${escapeHtml(c.systemPreview ?? c.system_preview ?? "(none)")}</pre></div>
          <div class="modal-section"><strong>Response Preview</strong><pre class="modal-pre">${escapeHtml(c.responsePreview ?? c.response_preview ?? "")}</pre></div>
        `);
      });
    });
  }

  function renderStateHistory(snapshots: any[]): void {
    if (!snapshots || snapshots.length === 0) {
      stateEl.innerHTML = "<p>No state history</p>";
      return;
    }
    stateEl.innerHTML = snapshots.map((s: any, i: number) => {
      const state = s.state ?? {};
      const preview = `Day ${state.dayCount ?? "?"} | ${state.currentActivity ?? "idle"} | Mood: ${state.currentMood ?? "?"}`;
      return `<div class="state-row" data-idx="${i}">
        <span class="log-time">${formatDate(s.createdAt ?? s.created_at)}</span>
        <span class="state-preview">${escapeHtml(preview)}</span>
      </div>`;
    }).join("");

    const snapshotsCopy = [...snapshots];
    stateEl.querySelectorAll(".state-row").forEach((row) => {
      row.addEventListener("click", () => {
        const idx = Number((row as HTMLElement).dataset.idx);
        const s = snapshotsCopy[idx];
        if (!s) return;
        showModal(`
          <h3>State Snapshot</h3>
          <p><strong>Time:</strong> ${formatDate(s.createdAt ?? s.created_at)}</p>
          <pre class="modal-pre json-viewer">${escapeHtml(JSON.stringify(s.state ?? {}, null, 2))}</pre>
        `);
      });
    });
  }

  async function fetchAll(): Promise<void> {
    const memParams = new URLSearchParams({ limit: "20" });
    if (memTypeFilter) memParams.set("type", memTypeFilter);
    if (memMinImportance > 1) memParams.set("importance", String(memMinImportance));

    const llmParams = new URLSearchParams({ limit: "20" });
    if (llmModelFilter) llmParams.set("model", llmModelFilter);
    if (!llmSuccessOnly) { /* don't filter */ } else { /* no filter param means all */ }

    const [statsRes, memRes, llmRes, stateRes] = await Promise.all([
      apiFetch("/api/admin/stats"),
      apiFetch(`/api/admin/memories?${memParams}`),
      apiFetch(`/api/admin/llm-calls?${llmParams}`),
      apiFetch("/api/admin/state-history?limit=10"),
    ]);

    renderStats(statsRes);
    memoriesData = memRes?.memories ?? [];
    renderMemories();
    llmData = llmRes?.calls ?? [];
    renderLLMCalls();
    renderStateHistory(stateRes?.snapshots ?? []);
  }

  fetchAll();

  // Poll every 10s
  const pollInterval = setInterval(fetchAll, 10_000);

  // Logout
  container.querySelector("#admin-logout")?.addEventListener("click", () => {
    localStorage.removeItem("nts_admin_token");
    window.location.hash = "#/admin/login";
    window.location.reload();
  });

  (container as any)._cleanup = () => {
    clearInterval(pollInterval);
  };
}
