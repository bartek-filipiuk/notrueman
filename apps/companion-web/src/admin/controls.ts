/**
 * Admin controls — reset buttons, force activity, visibility toggles.
 */

import { getStoredToken } from "./login.js";

export function renderControls(container: HTMLElement): void {
  container.innerHTML = `
    <div class="admin-dashboard">
      <header class="admin-header">
        <h1>NTS Admin — Controls</h1>
        <button id="admin-logout" class="admin-logout-btn">Logout</button>
      </header>
      <nav class="admin-nav">
        <a href="#/admin/dashboard">Dashboard</a>
        <a href="#/admin/logs">Logs</a>
        <a href="#/admin/settings">Settings</a>
        <a href="#/admin/controls" class="nav-active">Controls</a>
      </nav>
      <div class="controls-grid">
        <div class="card">
          <h2>Reset</h2>
          <p class="control-desc">Soft reset preserves the current day. Hard reset clears all state.</p>
          <div class="control-buttons">
            <button id="soft-reset" class="btn-warning">Soft Reset</button>
            <button id="hard-reset" class="btn-danger">Hard Reset</button>
          </div>
          <div id="reset-status" class="control-status" hidden></div>
        </div>
        <div class="card">
          <h2>Force Activity</h2>
          <p class="control-desc">Override the next cognitive tick with a specific activity.</p>
          <div class="control-row">
            <select id="force-activity-select" class="log-select">
              <option value="read">Read</option>
              <option value="cook">Cook</option>
              <option value="draw">Draw</option>
              <option value="exercise">Exercise</option>
              <option value="computer">Computer</option>
              <option value="sleep">Sleep</option>
              <option value="eat">Eat</option>
              <option value="think">Think</option>
              <option value="watch_tv">Watch TV</option>
              <option value="look_window">Look Window</option>
            </select>
            <button id="force-activity-btn" class="btn-small">Go</button>
          </div>
          <div id="force-status" class="control-status" hidden></div>
        </div>
        <div class="card">
          <h2>Public Feed Visibility</h2>
          <p class="control-desc">Toggle which events are visible on the public feed.</p>
          <div class="visibility-toggles">
            <label><input type="checkbox" checked data-type="thoughts" /> Thoughts</label>
            <label><input type="checkbox" checked data-type="moods" /> Mood Changes</label>
            <label><input type="checkbox" checked data-type="tools" /> Tool Calls</label>
            <label><input type="checkbox" checked data-type="creativity" /> Blog/Artwork</label>
          </div>
        </div>
      </div>
    </div>
  `;

  const token = getStoredToken();

  // Soft Reset
  container.querySelector("#soft-reset")?.addEventListener("click", async () => {
    if (!token) return;
    const statusEl = container.querySelector("#reset-status") as HTMLDivElement;
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode: "soft" }),
      });
      statusEl.textContent = res.ok ? "Soft reset done" : "Reset failed";
      statusEl.className = `control-status ${res.ok ? "status-ok" : "status-error"}`;
      statusEl.hidden = false;
    } catch {
      statusEl.textContent = "Reset failed";
      statusEl.className = "control-status status-error";
      statusEl.hidden = false;
    }
  });

  // Hard Reset (with confirmation)
  container.querySelector("#hard-reset")?.addEventListener("click", async () => {
    if (!token) return;
    if (!confirm("Are you sure? Hard reset will clear ALL state.")) return;

    const statusEl = container.querySelector("#reset-status") as HTMLDivElement;
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode: "hard" }),
      });
      statusEl.textContent = res.ok ? "Hard reset done" : "Reset failed";
      statusEl.className = `control-status ${res.ok ? "status-ok" : "status-error"}`;
      statusEl.hidden = false;
    } catch {
      statusEl.textContent = "Reset failed";
      statusEl.className = "control-status status-error";
      statusEl.hidden = false;
    }
  });

  // Force Activity
  container.querySelector("#force-activity-btn")?.addEventListener("click", async () => {
    if (!token) return;
    const select = container.querySelector("#force-activity-select") as HTMLSelectElement;
    const statusEl = container.querySelector("#force-status") as HTMLDivElement;

    try {
      const res = await fetch("/api/admin/force-activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ activity: select.value }),
      });
      statusEl.textContent = res.ok ? `Forced: ${select.value}` : "Failed";
      statusEl.className = `control-status ${res.ok ? "status-ok" : "status-error"}`;
      statusEl.hidden = false;
    } catch {
      statusEl.textContent = "Failed";
      statusEl.className = "control-status status-error";
      statusEl.hidden = false;
    }
  });

  container.querySelector("#admin-logout")?.addEventListener("click", () => {
    localStorage.removeItem("nts_admin_token");
    window.location.hash = "#/admin/login";
    window.location.reload();
  });
}
