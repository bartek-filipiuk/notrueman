/**
 * Admin log viewer — DB-backed, HTTP polling.
 * Merges memories + LLM calls, sorted by timestamp.
 * Filterable by type, searchable, auto-refresh 10s.
 */

import { getStoredToken, getApiBase } from "./login.js";

interface LogEntry {
  timestamp: number;
  type: string;
  source: "memory" | "llm";
  content: string;
  raw: Record<string, unknown>;
}

const TYPE_COLORS: Record<string, string> = {
  observation: "#3498db",
  reflection: "#9b59b6",
  plan: "#2ecc71",
  generateText: "#f39c12",
  generateObject: "#e67e22",
  generateWithTools: "#e91e63",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function renderLogViewer(container: HTMLElement): void {
  let filterType = "all";
  let searchText = "";

  container.innerHTML = `
    <div class="admin-dashboard">
      <header class="admin-header">
        <h1>NTS Admin — Logs</h1>
        <button id="admin-logout" class="admin-logout-btn">Logout</button>
      </header>
      <nav class="admin-nav">
        <a href="#/admin/dashboard">Dashboard</a>
        <a href="#/admin/logs" class="nav-active">Logs</a>
        <a href="#/admin/settings">Settings</a>
        <a href="#/admin/controls">Controls</a>
      </nav>
      <div class="log-controls">
        <select id="log-filter" class="log-select">
          <option value="all">All types</option>
          <option value="memory">Memories only</option>
          <option value="llm">LLM calls only</option>
          <option value="observation">Observation</option>
          <option value="reflection">Reflection</option>
          <option value="plan">Plan</option>
          <option value="generateText">generateText</option>
          <option value="generateObject">generateObject</option>
          <option value="generateWithTools">generateWithTools</option>
        </select>
        <input id="log-search" type="text" placeholder="Search logs..." class="log-search" />
        <span id="log-status" class="log-status">Loading...</span>
      </div>
      <div id="log-entries" class="log-entries"></div>
    </div>
  `;

  const entriesEl = container.querySelector("#log-entries") as HTMLDivElement;
  const filterEl = container.querySelector("#log-filter") as HTMLSelectElement;
  const searchEl = container.querySelector("#log-search") as HTMLInputElement;
  const statusEl = container.querySelector("#log-status") as HTMLSpanElement;

  let allEntries: LogEntry[] = [];

  filterEl.addEventListener("change", () => {
    filterType = filterEl.value;
    renderEntries();
  });

  searchEl.addEventListener("input", () => {
    searchText = searchEl.value.toLowerCase();
    renderEntries();
  });

  function renderEntries(): void {
    const filtered = allEntries.filter(e => {
      if (filterType === "memory" && e.source !== "memory") return false;
      if (filterType === "llm" && e.source !== "llm") return false;
      if (!["all", "memory", "llm"].includes(filterType) && e.type !== filterType) return false;
      if (searchText && !e.content.toLowerCase().includes(searchText)) return false;
      return true;
    });

    entriesEl.innerHTML = filtered.map(e => {
      const color = TYPE_COLORS[e.type] ?? "#888";
      const sourceTag = e.source === "llm" ? "LLM" : "MEM";
      return `<div class="log-entry">
        <span class="log-time">${formatTime(e.timestamp)}</span>
        <span class="log-source-badge log-source-${e.source}">${sourceTag}</span>
        <span class="log-type-badge" style="background:${color}">${e.type}</span>
        <span class="log-content">${escapeHtml(e.content)}</span>
      </div>`;
    }).join("");

    entriesEl.scrollTop = entriesEl.scrollHeight;
  }

  const token = getStoredToken();

  async function fetchLogs(): Promise<void> {
    try {
      const [memRes, llmRes] = await Promise.all([
        fetch(`${getApiBase()}/api/admin/memories?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${getApiBase()}/api/admin/llm-calls?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const entries: LogEntry[] = [];

      if (memRes.ok) {
        const memData = await memRes.json();
        for (const m of memData.memories ?? []) {
          entries.push({
            timestamp: new Date(m.createdAt ?? m.created_at).getTime(),
            type: m.type,
            source: "memory",
            content: (m.description ?? "").slice(0, 200),
            raw: m,
          });
        }
      }

      if (llmRes.ok) {
        const llmData = await llmRes.json();
        for (const c of llmData.calls ?? []) {
          entries.push({
            timestamp: new Date(c.createdAt ?? c.created_at).getTime(),
            type: c.callType ?? c.call_type,
            source: "llm",
            content: `[${(c.model ?? "").split("/").pop()}] ${(c.promptPreview ?? c.prompt_preview ?? "").slice(0, 120)}`,
            raw: c,
          });
        }
      }

      entries.sort((a, b) => b.timestamp - a.timestamp);
      allEntries = entries;
      statusEl.textContent = `${entries.length} entries | Last refresh: ${new Date().toLocaleTimeString()}`;
      renderEntries();
    } catch {
      statusEl.textContent = "Fetch failed";
    }
  }

  fetchLogs();
  const pollInterval = setInterval(fetchLogs, 10_000);

  container.querySelector("#admin-logout")?.addEventListener("click", () => {
    localStorage.removeItem("nts_admin_token");
    window.location.hash = "#/admin/login";
    window.location.reload();
  });

  (container as any)._cleanup = () => clearInterval(pollInterval);
}
