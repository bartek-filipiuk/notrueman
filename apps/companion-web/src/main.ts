/**
 * No True Man Show — Public Dashboard
 * Tabbed layout: Feed | Timeline | Gallery | Emotions
 * Data from DB via /api/public/* endpoints (polling every 10s)
 */

const POLL_INTERVAL = 10_000;

// === HELPERS ===

function timeAgo(date: string | number): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 10) return "now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function esc(text: unknown): string {
  return String(text ?? "").replace(/[<>&"]/g, c =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.substring(0, max - 3) + "..." : text;
}

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// === MODAL ===

function showModal(header: string, bodyHtml: string, jsonData?: unknown): void {
  const overlay = document.getElementById("modal-overlay")!;
  const headerEl = document.getElementById("modal-header")!;
  const bodyEl = document.getElementById("modal-body")!;
  const copyBtn = document.getElementById("modal-copy")!;
  headerEl.textContent = header;
  bodyEl.innerHTML = bodyHtml;
  overlay.hidden = false;

  copyBtn.onclick = () => {
    navigator.clipboard.writeText(JSON.stringify(jsonData ?? {}, null, 2))
      .then(() => { copyBtn.textContent = "✅ Copied!"; setTimeout(() => { copyBtn.textContent = "📋 Copy JSON"; }, 1500); });
  };
}

function closeModal(): void {
  document.getElementById("modal-overlay")!.hidden = true;
}

// === STATS BAR ===

async function updateStats(): Promise<void> {
  const stats = await fetchJSON<Record<string, unknown>>("/api/public/stats");
  if (!stats) return;

  const set = (id: string, val: string) => {
    const el = document.querySelector(`#${id} .stat-value`);
    if (el) el.textContent = val;
  };

  set("stat-calls", String(stats.callsToday ?? 0));
  set("stat-tokens", `${((stats.totalTokensIn as number ?? 0) + (stats.totalTokensOut as number ?? 0)).toLocaleString()}`);
  set("stat-cost", `$${Number(stats.totalCostUsd ?? 0).toFixed(3)}`);
  set("stat-memories", String(stats.memoriesCount ?? 0));
  set("stat-uptime", stats.uptime ? `${Math.floor(Number(stats.uptime) / 3600)}h ${Math.floor((Number(stats.uptime) % 3600) / 60)}m` : "-");
  set("stat-mood", String(stats.currentMood ?? "offline"));

  // Live badge
  const badge = document.getElementById("nav-live-badge")!;
  // If we got stats data, backend is alive
  if (stats) {
    badge.className = "nav-live-badge online";
    badge.innerHTML = '<span class="live-dot"></span> LIVE';
  } else {
    badge.className = "nav-live-badge";
    badge.innerHTML = '<span class="live-dot"></span> OFFLINE';
  }
}

// === FEED TAB ===

let feedData: Array<{ source: string; data: Record<string, unknown>; createdAt: string }> = [];

async function loadFeed(): Promise<void> {
  const result = await fetchJSON<{ items: typeof feedData }>("/api/public/feed?limit=50");
  if (result?.items) feedData = result.items;
}

function renderFeed(filter: string, search: string): string {
  let items = feedData;
  if (filter !== "all") {
    items = items.filter(i => {
      if (filter === "llm") return i.source === "llm_call";
      if (filter === "memory") return i.source === "memory";
      return true;
    });
  }
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(i => JSON.stringify(i.data).toLowerCase().includes(q));
  }

  if (items.length === 0) return '<div class="tab-loading">No entries yet. Waiting for brain activity...</div>';

  return items.map(item => {
    const d = item.data;
    const isLLM = item.source === "llm_call";
    const isBlog = !isLLM && d.metadata && JSON.stringify(d.metadata).includes("write_blog");
    const isArt = !isLLM && d.metadata && JSON.stringify(d.metadata).includes("create_artwork");
    const isSearch = !isLLM && d.metadata && JSON.stringify(d.metadata).includes("web_search");
    const isError = isLLM && d.success === false;

    let badgeClass = isLLM ? "llm" : isBlog ? "blog" : isArt ? "art" : isSearch ? "search" : "memory";
    if (isError) badgeClass = "error";
    const badgeText = isLLM ? "🤖 LLM" : isBlog ? "📝 Blog" : isArt ? "🎨 Art" : isSearch ? "🔍 Search" : "💭 Memory";

    const mainText = isLLM
      ? truncate(String(d.response_preview ?? d.prompt_preview ?? "LLM call"), 120)
      : truncate(String(d.description ?? ""), 120);

    const meta = isLLM
      ? `${d.model ?? "?"} · ${d.duration_ms ?? "?"}ms · ${d.input_tokens ?? "?"}in/${d.output_tokens ?? "?"}out · $${Number(d.cost_usd ?? 0).toFixed(4)}`
      : `importance: ${d.importance ?? "?"} · type: ${d.type ?? "observation"}`;

    return `<div class="feed-entry" data-json='${esc(JSON.stringify(item))}'>
      <span class="feed-badge ${badgeClass}">${badgeText}</span>
      <div class="feed-content">
        <div class="feed-content-main">${esc(mainText)}</div>
        <div class="feed-content-meta">${esc(meta)}</div>
      </div>
      <span class="feed-time">${timeAgo(item.createdAt)}</span>
      <button class="feed-copy" title="Copy JSON">📋</button>
    </div>`;
  }).join("");
}

function initFeedTab(): void {
  const container = document.getElementById("tab-content")!;
  container.innerHTML = `
    <div class="feed-controls">
      <select class="feed-filter" id="feed-filter">
        <option value="all">All</option>
        <option value="llm">🤖 LLM Calls</option>
        <option value="memory">💭 Memories</option>
      </select>
      <input class="feed-search" id="feed-search" placeholder="Search..." />
      <button class="feed-refresh" id="feed-refresh">↻ Refresh</button>
    </div>
    <div class="feed-list" id="feed-list"></div>
  `;

  const update = () => {
    const filter = (document.getElementById("feed-filter") as HTMLSelectElement).value;
    const search = (document.getElementById("feed-search") as HTMLInputElement).value;
    document.getElementById("feed-list")!.innerHTML = renderFeed(filter, search);
  };

  loadFeed().then(update);
  document.getElementById("feed-filter")!.addEventListener("change", update);
  document.getElementById("feed-search")!.addEventListener("input", update);
  document.getElementById("feed-refresh")!.addEventListener("click", () => loadFeed().then(update));

  // Click entry → modal
  container.addEventListener("click", (e) => {
    const entry = (e.target as HTMLElement).closest(".feed-entry") as HTMLElement;
    if (!entry) return;

    // Copy button
    const copyBtn = (e.target as HTMLElement).closest(".feed-copy");
    if (copyBtn) {
      e.stopPropagation();
      const json = entry.getAttribute("data-json") ?? "{}";
      navigator.clipboard.writeText(json);
      copyBtn.textContent = "✅";
      setTimeout(() => { copyBtn.textContent = "📋"; }, 1000);
      return;
    }

    // Detail modal
    const item = JSON.parse(entry.getAttribute("data-json") ?? "{}");
    const d = item.data ?? {};
    const isLLM = item.source === "llm_call";

    const header = isLLM ? `🤖 LLM Call — ${d.model ?? "unknown"}` : `💭 ${d.type ?? "Memory"}`;

    let body = "";
    if (isLLM) {
      body += `<div class="label">Prompt Preview</div><pre>${esc(d.prompt_preview ?? "N/A")}</pre>`;
      if (d.system_preview) body += `<div class="label">System Preview</div><pre>${esc(d.system_preview)}</pre>`;
      body += `<div class="label">Response Preview</div><pre>${esc(d.response_preview ?? "N/A")}</pre>`;
      body += `<div class="label">Details</div><pre>Model: ${esc(d.model)}\nType: ${esc(d.call_type)}\nDuration: ${d.duration_ms}ms\nTokens: ${d.input_tokens}in / ${d.output_tokens}out\nCost: $${Number(d.cost_usd ?? 0).toFixed(4)}\nSuccess: ${d.success}\n${d.error ? `Error: ${d.error}` : ""}</pre>`;
    } else {
      body += `<div class="label">Description</div><pre>${esc(d.description ?? "")}</pre>`;
      body += `<div class="label">Type</div><pre>${esc(d.type ?? "observation")}</pre>`;
      body += `<div class="label">Importance</div><pre>${d.importance ?? "?"}/10</pre>`;
      if (d.emotional_context || d.emotionalContext) {
        body += `<div class="label">Emotional Context</div><pre>${JSON.stringify(d.emotional_context ?? d.emotionalContext, null, 2)}</pre>`;
      }
      if (d.metadata && Object.keys(d.metadata).length > 0) {
        body += `<div class="label">Metadata</div><pre>${JSON.stringify(d.metadata, null, 2)}</pre>`;
      }
    }
    showModal(header, body, item);
  });
}

// === TIMELINE TAB ===

async function initTimelineTab(): Promise<void> {
  const container = document.getElementById("tab-content")!;
  const result = await fetchJSON<{ items: Array<{ source: string; data: Record<string, unknown>; createdAt: string }> }>("/api/public/feed?limit=100");
  const items = result?.items ?? [];

  // Extract activities from memories
  const activities = items
    .filter(i => i.source === "memory" && i.data.description)
    .map(i => {
      const desc = String(i.data.description ?? "").toLowerCase();
      let activity = "idle";
      for (const a of ["sleep", "read", "computer", "cook", "draw", "exercise", "eat", "think"]) {
        if (desc.includes(a)) { activity = a; break; }
      }
      return { activity, time: new Date(i.createdAt).getTime(), thought: truncate(String(i.data.description), 60) };
    })
    .sort((a, b) => a.time - b.time);

  if (activities.length === 0) {
    container.innerHTML = '<div class="tab-loading">No activity data yet.</div>';
    return;
  }

  const activityColors: Record<string, string> = {
    read: "var(--accent-blue)", cook: "var(--accent-amber)", sleep: "#7c3aed",
    draw: "var(--accent-pink)", computer: "var(--accent-cyan)", exercise: "var(--accent-green)",
    think: "#fbbf24", eat: "var(--accent-red)", idle: "var(--text-muted)",
  };

  const blocks = activities.map(a =>
    `<div class="timeline-block" data-activity="${a.activity}" title="${esc(a.thought)}" style="background: ${activityColors[a.activity] ?? activityColors.idle}">
      <div class="timeline-tooltip">${esc(a.thought)}</div>
    </div>`
  ).join("");

  const legend = Object.entries(activityColors).map(([name, color]) =>
    `<div class="timeline-legend-item"><div class="timeline-legend-dot" style="background: ${color}"></div>${name}</div>`
  ).join("");

  const first = new Date(activities[0].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const last = new Date(activities[activities.length - 1].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  container.innerHTML = `
    <div class="timeline-container">
      <div class="timeline-track">${blocks}</div>
      <div class="timeline-labels"><span>${first}</span><span>${last}</span></div>
      <div class="timeline-legend">${legend}</div>
    </div>
  `;
}

// === GALLERY TAB ===

async function initGalleryTab(): Promise<void> {
  const container = document.getElementById("tab-content")!;
  const result = await fetchJSON<{ items: Array<Record<string, unknown>> }>("/api/public/gallery?limit=30");
  const items = result?.items ?? [];

  if (items.length === 0) {
    container.innerHTML = '<div class="gallery-empty">🎨 No creative works yet. Truman hasn\'t written any blogs or created artwork.</div>';
    return;
  }

  const cards = items.map(item => {
    const isBlog = item.type === "blog";
    const tags = Array.isArray(item.tags) ? item.tags.map((t: unknown) => `<span class="gallery-tag">${esc(t)}</span>`).join("") : "";

    return `<div class="gallery-card" data-json='${esc(JSON.stringify(item))}'>
      <div class="gallery-card-type ${isBlog ? "blog" : "art"}">${isBlog ? "📝 Blog Post" : "🎨 Artwork"}</div>
      <div class="gallery-card-title">${esc(item.title ?? "Untitled")}</div>
      <div class="gallery-card-preview">${esc(truncate(String(item.content ?? item.description ?? ""), 120))}</div>
      ${tags ? `<div class="gallery-card-tags">${tags}</div>` : ""}
      <div class="gallery-card-time">${item.createdAt ? timeAgo(String(item.createdAt)) : ""}</div>
    </div>`;
  }).join("");

  container.innerHTML = `<div class="gallery-grid">${cards}</div>`;

  container.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest(".gallery-card") as HTMLElement;
    if (!card) return;
    const item = JSON.parse(card.getAttribute("data-json") ?? "{}");
    const isBlog = item.type === "blog";
    showModal(
      `${isBlog ? "📝" : "🎨"} ${item.title ?? "Untitled"}`,
      `<div class="label">${isBlog ? "Content" : "Description"}</div><pre>${esc(item.content ?? item.description ?? "")}</pre>
       ${item.style ? `<div class="label">Style</div><pre>${esc(item.style)}</pre>` : ""}
       ${item.tags ? `<div class="label">Tags</div><pre>${esc(JSON.stringify(item.tags))}</pre>` : ""}`,
      item,
    );
  });
}

// === EMOTIONS TAB ===

async function initEmotionsTab(): Promise<void> {
  const container = document.getElementById("tab-content")!;
  const result = await fetchJSON<{ points: Array<Record<string, number | string>> }>("/api/public/emotions?limit=100");
  const points = result?.points ?? [];

  if (points.length < 2) {
    container.innerHTML = '<div class="tab-loading">Not enough emotion data yet. Need at least 2 data points.</div>';
    return;
  }

  const dims = ["happiness", "curiosity", "anxiety", "boredom", "excitement", "contentment", "frustration"];
  const colors = ["#ffd700", "#00d2ff", "#e74c3c", "#9e9e9e", "#fbbf24", "#2ecc71", "#ff9800"];

  container.innerHTML = `
    <div class="emotions-chart-container">
      <canvas class="emotions-canvas" id="emotions-canvas"></canvas>
      <div class="emotions-legend">
        ${dims.map((d, i) => `<div class="emotions-legend-item"><div class="emotions-legend-dot" style="background: ${colors[i]}"></div>${d}</div>`).join("")}
      </div>
    </div>
  `;

  const canvas = document.getElementById("emotions-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  ctx.scale(2, 2);
  const w = rect.width;
  const h = rect.height;

  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  // Draw grid
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let y = 0; y <= 1; y += 0.25) {
    const py = pad.top + plotH * (1 - y);
    ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(pad.left + plotW, py); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "10px Inter";
    ctx.textAlign = "right";
    ctx.fillText(y.toFixed(1), pad.left - 6, py + 4);
  }

  // Draw lines per emotion
  dims.forEach((dim, di) => {
    ctx.strokeStyle = colors[di];
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();

    points.forEach((p, pi) => {
      const x = pad.left + (pi / (points.length - 1)) * plotW;
      const val = Number(p[dim] ?? 0);
      const y = pad.top + plotH * (1 - val);
      if (pi === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // Time labels
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "10px 'JetBrains Mono'";
  ctx.textAlign = "center";
  const firstTime = new Date(String(points[0].timestamp)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const lastTime = new Date(String(points[points.length - 1].timestamp)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  ctx.fillText(firstTime, pad.left, h - 6);
  ctx.fillText(lastTime, pad.left + plotW, h - 6);
}

// === TAB ROUTING ===

let currentTab = "feed";
let pollTimer: ReturnType<typeof setInterval> | undefined;

function switchTab(tab: string): void {
  currentTab = tab;
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
  });
  clearInterval(pollTimer);

  if (tab === "feed") {
    initFeedTab();
    pollTimer = setInterval(() => {
      loadFeed().then(() => {
        const filter = (document.getElementById("feed-filter") as HTMLSelectElement)?.value ?? "all";
        const search = (document.getElementById("feed-search") as HTMLInputElement)?.value ?? "";
        const list = document.getElementById("feed-list");
        if (list) list.innerHTML = renderFeed(filter, search);
      });
    }, POLL_INTERVAL);
  } else if (tab === "timeline") {
    initTimelineTab();
  } else if (tab === "gallery") {
    initGalleryTab();
  } else if (tab === "emotions") {
    initEmotionsTab();
  }
}

// === INIT ===

document.addEventListener("DOMContentLoaded", () => {
  // Tab buttons
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab") ?? "feed"));
  });

  // Modal close
  document.getElementById("modal-close")!.addEventListener("click", closeModal);
  document.getElementById("modal-overlay")!.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // Initial load
  updateStats();
  switchTab("feed");

  // Poll stats
  setInterval(updateStats, POLL_INTERVAL);
});
