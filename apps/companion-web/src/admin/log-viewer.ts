/**
 * Admin log viewer — realtime event log from admin WebSocket feed.
 * Filterable by type, searchable, auto-scroll toggle.
 */

import { getStoredToken, getApiBase } from "./login.js";
import { MindFeedClient, type MindFeedClientEvent } from "../ws-client.js";

interface LogEntry {
  timestamp: number;
  type: string;
  content: string;
  raw: Record<string, unknown>;
}

const TYPE_COLORS: Record<string, string> = {
  thought: "#9b59b6",
  mood_change: "#00d2ff",
  tool_call: "#f39c12",
  activity_change: "#2ecc71",
  blog_created: "#27ae60",
  artwork_created: "#e91e63",
  reflection: "#3498db",
  status: "#95a5a6",
};

const MAX_ENTRIES = 200;

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function renderLogViewer(container: HTMLElement): void {
  const entries: LogEntry[] = [];
  let autoScroll = true;
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
          <option value="thought">Thought</option>
          <option value="mood_change">Mood Change</option>
          <option value="tool_call">Tool Call</option>
          <option value="activity_change">Activity Change</option>
          <option value="blog_created">Blog</option>
          <option value="artwork_created">Artwork</option>
          <option value="reflection">Reflection</option>
        </select>
        <input id="log-search" type="text" placeholder="Search logs..." class="log-search" />
        <label class="log-autoscroll">
          <input type="checkbox" id="log-autoscroll-toggle" checked />
          Auto-scroll
        </label>
      </div>
      <div id="log-entries" class="log-entries"></div>
    </div>
  `;

  const entriesEl = container.querySelector("#log-entries") as HTMLDivElement;
  const filterEl = container.querySelector("#log-filter") as HTMLSelectElement;
  const searchEl = container.querySelector("#log-search") as HTMLInputElement;
  const autoScrollEl = container.querySelector("#log-autoscroll-toggle") as HTMLInputElement;

  filterEl.addEventListener("change", () => {
    filterType = filterEl.value;
    renderEntries();
  });

  searchEl.addEventListener("input", () => {
    searchText = searchEl.value.toLowerCase();
    renderEntries();
  });

  autoScrollEl.addEventListener("change", () => {
    autoScroll = autoScrollEl.checked;
  });

  function renderEntries(): void {
    const filtered = entries.filter(e => {
      if (filterType !== "all" && e.type !== filterType) return false;
      if (searchText && !e.content.toLowerCase().includes(searchText)) return false;
      return true;
    });

    entriesEl.innerHTML = filtered.map(e => {
      const color = TYPE_COLORS[e.type] ?? "#888";
      return `<div class="log-entry">
        <span class="log-time">${formatTime(e.timestamp)}</span>
        <span class="log-type-badge" style="background:${color}">${e.type}</span>
        <span class="log-content">${escapeHtml(e.content)}</span>
      </div>`;
    }).join("");

    if (autoScroll) {
      entriesEl.scrollTop = entriesEl.scrollHeight;
    }
  }

  function addEntry(event: MindFeedClientEvent): void {
    const content = summarizeEvent(event);
    entries.push({
      timestamp: event.timestamp ?? Date.now(),
      type: event.type,
      content,
      raw: event.data,
    });

    if (entries.length > MAX_ENTRIES) {
      entries.splice(0, entries.length - MAX_ENTRIES);
    }

    renderEntries();
  }

  // Connect to admin WebSocket
  const token = getStoredToken();
  const apiBase = getApiBase();
  const wsHost = apiBase ? new URL(apiBase).host : window.location.host;
  const wsProtocol = (apiBase ? new URL(apiBase).protocol : window.location.protocol) === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${wsHost}/ws/admin-feed?token=${token}`;

  const client = new MindFeedClient({
    url: wsUrl,
    onEvent: addEntry,
  });
  client.connect();

  container.querySelector("#admin-logout")?.addEventListener("click", () => {
    localStorage.removeItem("nts_admin_token");
    window.location.hash = "#/admin/login";
    window.location.reload();
  });

  (container as any)._cleanup = () => client.disconnect();
}

function summarizeEvent(event: MindFeedClientEvent): string {
  const d = event.data;
  switch (event.type) {
    case "thought": return String(d.text ?? "");
    case "mood_change": return `${d.prevMood} → ${d.mood}`;
    case "tool_call": return `${d.tool}: ${d.topic ?? ""}`;
    case "activity_change": return `${d.prevActivity} → ${d.activity}`;
    case "blog_created": return `Blog: ${d.title}`;
    case "artwork_created": return `Art: ${d.title} (${d.style})`;
    case "reflection": return String(d.insight ?? "");
    default: return JSON.stringify(d).slice(0, 200);
  }
}
