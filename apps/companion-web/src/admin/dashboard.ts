/**
 * Admin dashboard — live status, emotion chart, budget, recent memories.
 * Updated via /ws/admin-feed WebSocket.
 */

import { getStoredToken, getApiBase } from "./login.js";
import { MindFeedClient } from "../ws-client.js";

export interface DashboardState {
  activity: string;
  mood: string;
  day: number;
  uptime: number;
  tickCount: number;
  emotions: Record<string, number>;
  budget: { used: number; total: number };
  memories: Array<{ description: string; type: string; importance: number }>;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function createEmotionRadar(emotions: Record<string, number>): string {
  const dims = ["happiness", "curiosity", "anxiety", "boredom", "excitement", "contentment", "frustration"];
  const colors: Record<string, string> = {
    happiness: "#f1c40f",
    curiosity: "#3498db",
    anxiety: "#e74c3c",
    boredom: "#95a5a6",
    excitement: "#e67e22",
    contentment: "#2ecc71",
    frustration: "#9b59b6",
  };

  return dims.map(dim => {
    const val = emotions[dim] ?? 0;
    const pct = Math.round(val * 100);
    const color = colors[dim] ?? "#888";
    return `<div class="emotion-bar">
      <span class="emotion-label">${dim}</span>
      <div class="emotion-track">
        <div class="emotion-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="emotion-value">${pct}%</span>
    </div>`;
  }).join("");
}

function createBudgetBar(used: number, total: number): string {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const color = pct > 80 ? "#e74c3c" : pct > 50 ? "#f39c12" : "#2ecc71";
  return `<div class="budget-bar">
    <div class="budget-fill" style="width:${pct}%;background:${color}"></div>
    <span class="budget-text">${used}/${total} calls</span>
  </div>`;
}

export function renderDashboard(container: HTMLElement): void {
  const state: DashboardState = {
    activity: "idle",
    mood: "neutral",
    day: 1,
    uptime: 0,
    tickCount: 0,
    emotions: {},
    budget: { used: 0, total: 20 },
    memories: [],
  };

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
      <div class="dashboard-grid">
        <div class="card" id="status-card">
          <h2>Status</h2>
          <div id="status-content">Loading...</div>
        </div>
        <div class="card" id="emotions-card">
          <h2>Emotions</h2>
          <div id="emotions-content">Loading...</div>
        </div>
        <div class="card" id="budget-card">
          <h2>Budget</h2>
          <div id="budget-content">Loading...</div>
        </div>
        <div class="card" id="memories-card">
          <h2>Recent Memories</h2>
          <div id="memories-content">Loading...</div>
        </div>
      </div>
    </div>
  `;

  const statusEl = container.querySelector("#status-content") as HTMLDivElement;
  const emotionsEl = container.querySelector("#emotions-content") as HTMLDivElement;
  const budgetEl = container.querySelector("#budget-content") as HTMLDivElement;
  const memoriesEl = container.querySelector("#memories-content") as HTMLDivElement;

  function updateUI(): void {
    statusEl.innerHTML = `
      <div class="status-item"><span class="status-label">Activity</span><span class="status-badge">${state.activity}</span></div>
      <div class="status-item"><span class="status-label">Mood</span><span class="status-badge">${state.mood}</span></div>
      <div class="status-item"><span class="status-label">Day</span><span class="status-badge">${state.day}</span></div>
      <div class="status-item"><span class="status-label">Uptime</span><span class="status-badge">${formatUptime(state.uptime)}</span></div>
      <div class="status-item"><span class="status-label">Ticks</span><span class="status-badge">${state.tickCount}</span></div>
    `;
    emotionsEl.innerHTML = createEmotionRadar(state.emotions);
    budgetEl.innerHTML = createBudgetBar(state.budget.used, state.budget.total);
    memoriesEl.innerHTML = state.memories.length > 0
      ? state.memories.slice(0, 20).map(m =>
          `<div class="memory-entry"><span class="memory-type">${m.type}</span> ${escapeHtml(m.description)}</div>`
        ).join("")
      : "<p>No memories yet</p>";
  }

  // Fetch initial state
  const token = getStoredToken();
  if (token) {
    fetchBrainState(token, state).then(updateUI);
    fetchMemories(token, state).then(updateUI);
  }

  // Connect to admin WebSocket feed
  const apiBase = getApiBase();
  const wsHost = apiBase ? new URL(apiBase).host : window.location.host;
  const wsProtocol = (apiBase ? new URL(apiBase).protocol : window.location.protocol) === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${wsHost}/ws/admin-feed?token=${token}`;

  const client = new MindFeedClient({
    url: wsUrl,
    onEvent: (event) => {
      if (event.type === "thought" || event.type === "reflection") {
        // Update from events
      }
      if (event.type === "mood_change") {
        state.mood = String(event.data.mood ?? state.mood);
      }
      if (event.type === "activity_change") {
        state.activity = String(event.data.activity ?? state.activity);
      }
      if (event.data.emotions) {
        state.emotions = event.data.emotions as Record<string, number>;
      }
      updateUI();
    },
  });
  client.connect();

  // Logout handler
  container.querySelector("#admin-logout")?.addEventListener("click", () => {
    localStorage.removeItem("nts_admin_token");
    window.location.hash = "#/admin/login";
    window.location.reload();
  });

  // Poll status every 10s
  const pollInterval = setInterval(() => {
    if (token) {
      fetchBrainState(token, state).then(updateUI);
    }
  }, 10_000);

  // Cleanup when navigating away
  (container as any)._cleanup = () => {
    client.disconnect();
    clearInterval(pollInterval);
  };
}

async function fetchBrainState(token: string, state: DashboardState): Promise<void> {
  try {
    const res = await fetch(`${getApiBase()}/api/admin/brain-state`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.state) {
      state.tickCount = data.state.tickCount ?? state.tickCount;
      state.mood = data.state.currentMood ?? state.mood;
      state.activity = data.state.currentActivity ?? state.activity;
    }
    if (data.status) {
      state.uptime = data.status.uptime ?? state.uptime;
    }
  } catch {
    // Silently fail
  }
}

async function fetchMemories(token: string, state: DashboardState): Promise<void> {
  try {
    const res = await fetch(`${getApiBase()}/api/admin/memories?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    state.memories = data.memories ?? [];
  } catch {
    // Silently fail
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
