/**
 * No True Man Show — Public Dashboard
 * Tabbed layout: Feed | Timeline | Gallery | Emotions
 * Data from DB via /api/public/* endpoints (polling every 10s)
 * XSS-safe: uses textContent/DOM API only — no innerHTML with raw data
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

/** Create a DOM element with optional classes and textContent */
function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// === MODAL ===

function showModal(header: string, bodyBuilder: (container: HTMLElement) => void, jsonData?: unknown): void {
  const overlay = document.getElementById("modal-overlay")!;
  const headerEl = document.getElementById("modal-header")!;
  const bodyEl = document.getElementById("modal-body")!;
  const copyBtn = document.getElementById("modal-copy")!;

  headerEl.textContent = header;
  bodyEl.textContent = "";
  bodyBuilder(bodyEl);
  overlay.hidden = false;

  copyBtn.onclick = () => {
    navigator.clipboard.writeText(JSON.stringify(jsonData ?? {}, null, 2))
      .then(() => { copyBtn.textContent = "\u2705 Copied!"; setTimeout(() => { copyBtn.textContent = "\uD83D\uDCCB Copy JSON"; }, 1500); });
  };
}

/** Add a labeled pre block to a container (safe — uses textContent) */
function addLabeledPre(container: HTMLElement, label: string, content: string): void {
  const lbl = el("div", "label", label);
  const pre = el("pre", undefined, content);
  container.appendChild(lbl);
  container.appendChild(pre);
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
  const dot = badge.querySelector(".live-dot");
  const textNode = dot?.nextSibling;
  if (stats.callsToday && Number(stats.callsToday) > 0) {
    badge.className = "nav-live-badge online";
    if (textNode) textNode.textContent = " LIVE";
  } else {
    badge.className = "nav-live-badge";
    if (textNode) textNode.textContent = " OFFLINE";
  }
}

// === FEED TAB ===

type FeedItem = { source: string; data: Record<string, unknown>; createdAt: string };
let feedData: FeedItem[] = [];

async function loadFeed(): Promise<void> {
  const result = await fetchJSON<{ items: FeedItem[] }>("/api/public/feed?limit=50");
  if (result?.items) feedData = result.items;
}

function classifyFeedItem(item: FeedItem): { badgeClass: string; badgeText: string } {
  const d = item.data;
  const isLLM = item.source === "llm_call";
  const meta = d.metadata ? JSON.stringify(d.metadata) : "";
  const isBlog = !isLLM && meta.includes("write_blog");
  const isArt = !isLLM && meta.includes("create_artwork");
  const isSearch = !isLLM && meta.includes("web_search");
  const isError = isLLM && d.success === false;

  let badgeClass = isLLM ? "llm" : isBlog ? "blog" : isArt ? "art" : isSearch ? "search" : "memory";
  if (isError) badgeClass = "error";
  const badgeText = isLLM ? "\uD83E\uDD16 LLM" : isBlog ? "\uD83D\uDCDD Blog" : isArt ? "\uD83C\uDFA8 Art" : isSearch ? "\uD83D\uDD0D Search" : "\uD83D\uDCAD Memory";

  return { badgeClass, badgeText };
}

function buildFeedEntry(item: FeedItem): HTMLElement {
  const d = item.data;
  const isLLM = item.source === "llm_call";
  const { badgeClass, badgeText } = classifyFeedItem(item);

  const entry = el("div", "feed-entry");

  // Badge
  const badge = el("span", `feed-badge ${badgeClass}`, badgeText);
  entry.appendChild(badge);

  // Content
  const content = el("div", "feed-content");
  const mainText = isLLM
    ? truncate(String(d.responsePreview ?? d.promptPreview ?? d.response_preview ?? d.prompt_preview ?? "LLM call"), 120)
    : truncate(String(d.description ?? ""), 120);
  const contentMain = el("div", "feed-content-main", mainText);
  content.appendChild(contentMain);

  const metaText = isLLM
    ? `${d.model ?? "?"} \u00B7 ${d.durationMs ?? d.duration_ms ?? "?"}ms \u00B7 ${d.inputTokens ?? d.input_tokens ?? "?"}in/${d.outputTokens ?? d.output_tokens ?? "?"}out \u00B7 $${Number(d.costUsd ?? d.cost_usd ?? 0).toFixed(4)}`
    : `importance: ${d.importance ?? "?"} \u00B7 type: ${d.type ?? "observation"}`;
  const contentMeta = el("div", "feed-content-meta", metaText);
  content.appendChild(contentMeta);
  entry.appendChild(content);

  // Time
  const time = el("span", "feed-time", timeAgo(item.createdAt));
  entry.appendChild(time);

  // Copy button
  const copyBtn = el("button", "feed-copy", "\uD83D\uDCCB");
  copyBtn.title = "Copy JSON";
  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(item, null, 2));
    copyBtn.textContent = "\u2705";
    setTimeout(() => { copyBtn.textContent = "\uD83D\uDCCB"; }, 1000);
  });
  entry.appendChild(copyBtn);

  // Click → detail modal
  entry.addEventListener("click", () => showFeedDetailModal(item));

  return entry;
}

function showFeedDetailModal(item: FeedItem): void {
  const d = item.data;
  const isLLM = item.source === "llm_call";

  const header = isLLM
    ? `\uD83E\uDD16 LLM Call \u2014 ${d.model ?? "unknown"}`
    : `\uD83D\uDCAD ${d.type ?? "Memory"}`;

  showModal(header, (body) => {
    if (isLLM) {
      addLabeledPre(body, "Prompt Preview", String(d.promptPreview ?? d.prompt_preview ?? "N/A"));
      if (d.systemPreview ?? d.system_preview) {
        addLabeledPre(body, "System Preview", String(d.systemPreview ?? d.system_preview));
      }
      addLabeledPre(body, "Response Preview", String(d.responsePreview ?? d.response_preview ?? "N/A"));
      addLabeledPre(body, "Details",
        `Model: ${d.model ?? "?"}\nType: ${d.callType ?? d.call_type ?? "?"}\nDuration: ${d.durationMs ?? d.duration_ms ?? "?"}ms\nTokens: ${d.inputTokens ?? d.input_tokens ?? "?"}in / ${d.outputTokens ?? d.output_tokens ?? "?"}out\nCost: $${Number(d.costUsd ?? d.cost_usd ?? 0).toFixed(4)}\nSuccess: ${d.success}${d.error ? `\nError: ${d.error}` : ""}`
      );
    } else {
      addLabeledPre(body, "Description", String(d.description ?? ""));
      addLabeledPre(body, "Type", String(d.type ?? "observation"));
      addLabeledPre(body, "Importance", `${d.importance ?? "?"}/10`);
      const emoCtx = d.emotional_context ?? d.emotionalContext;
      if (emoCtx && typeof emoCtx === "object" && Object.keys(emoCtx as object).length > 0) {
        addLabeledPre(body, "Emotional Context", JSON.stringify(emoCtx, null, 2));
      }
      if (d.metadata && typeof d.metadata === "object" && Object.keys(d.metadata as object).length > 0) {
        addLabeledPre(body, "Metadata", JSON.stringify(d.metadata, null, 2));
      }
    }
  }, item);
}

function renderFeedList(container: HTMLElement, filter: string, search: string): void {
  container.textContent = "";
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

  if (items.length === 0) {
    container.appendChild(el("div", "tab-loading", "No entries yet. Waiting for brain activity..."));
    return;
  }

  for (const item of items) {
    container.appendChild(buildFeedEntry(item));
  }
}

function initFeedTab(): void {
  const container = document.getElementById("tab-content")!;
  container.textContent = "";

  // Controls
  const controls = el("div", "feed-controls");

  const filterSelect = document.createElement("select");
  filterSelect.className = "feed-filter";
  filterSelect.id = "feed-filter";
  for (const [val, label] of [["all", "All"], ["llm", "\uD83E\uDD16 LLM Calls"], ["memory", "\uD83D\uDCAD Memories"]]) {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    filterSelect.appendChild(opt);
  }
  controls.appendChild(filterSelect);

  const searchInput = document.createElement("input");
  searchInput.className = "feed-search";
  searchInput.id = "feed-search";
  searchInput.placeholder = "Search...";
  controls.appendChild(searchInput);

  const refreshBtn = el("button", "feed-refresh", "\u21BB Refresh");
  refreshBtn.id = "feed-refresh";
  controls.appendChild(refreshBtn);

  container.appendChild(controls);

  const list = el("div", "feed-list");
  list.id = "feed-list";
  container.appendChild(list);

  const update = () => {
    renderFeedList(list, filterSelect.value, searchInput.value);
  };

  loadFeed().then(update);
  filterSelect.addEventListener("change", update);
  searchInput.addEventListener("input", update);
  refreshBtn.addEventListener("click", () => loadFeed().then(update));
}

// === TIMELINE TAB ===

async function initTimelineTab(): Promise<void> {
  const container = document.getElementById("tab-content")!;
  container.textContent = "";

  const result = await fetchJSON<{ items: FeedItem[] }>("/api/public/feed?limit=100");
  const items = result?.items ?? [];

  const activityColors: Record<string, string> = {
    read: "var(--accent-blue)", cook: "var(--accent-amber)", sleep: "#7c3aed",
    draw: "var(--accent-pink)", computer: "var(--accent-cyan)", exercise: "var(--accent-green)",
    think: "#fbbf24", eat: "var(--accent-red)", idle: "var(--text-muted)",
  };

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
    container.appendChild(el("div", "tab-loading", "No activity data yet."));
    return;
  }

  const tlContainer = el("div", "timeline-container");

  // Track
  const track = el("div", "timeline-track");
  for (const a of activities) {
    const block = el("div", "timeline-block");
    block.dataset.activity = a.activity;
    block.title = a.thought;
    block.style.background = activityColors[a.activity] ?? activityColors.idle;

    const tooltip = el("div", "timeline-tooltip", a.thought);
    block.appendChild(tooltip);
    track.appendChild(block);
  }
  tlContainer.appendChild(track);

  // Labels
  const labels = el("div", "timeline-labels");
  const first = new Date(activities[0].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const last = new Date(activities[activities.length - 1].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  labels.appendChild(el("span", undefined, first));
  labels.appendChild(el("span", undefined, last));
  tlContainer.appendChild(labels);

  // Legend
  const legend = el("div", "timeline-legend");
  for (const [name, color] of Object.entries(activityColors)) {
    const item = el("div", "timeline-legend-item");
    const dot = el("div", "timeline-legend-dot");
    dot.style.background = color;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(name));
    legend.appendChild(item);
  }
  tlContainer.appendChild(legend);

  container.appendChild(tlContainer);
}

// === GALLERY TAB ===

async function initGalleryTab(): Promise<void> {
  const container = document.getElementById("tab-content")!;
  container.textContent = "";

  const result = await fetchJSON<{ items: Array<Record<string, unknown>> }>("/api/public/gallery?limit=30");
  const items = result?.items ?? [];

  if (items.length === 0) {
    container.appendChild(el("div", "gallery-empty", "\uD83C\uDFA8 No creative works yet. Truman hasn't written any blogs or created artwork."));
    return;
  }

  const grid = el("div", "gallery-grid");

  for (const item of items) {
    const isBlog = item.type === "blog";
    const card = el("div", "gallery-card");

    const typeEl = el("div", `gallery-card-type ${isBlog ? "blog" : "art"}`, isBlog ? "\uD83D\uDCDD Blog Post" : "\uD83C\uDFA8 Artwork");
    card.appendChild(typeEl);

    const title = el("div", "gallery-card-title", String(item.title ?? "Untitled"));
    card.appendChild(title);

    const preview = el("div", "gallery-card-preview", truncate(String(item.content ?? item.description ?? ""), 120));
    card.appendChild(preview);

    if (Array.isArray(item.tags) && item.tags.length > 0) {
      const tagsDiv = el("div", "gallery-card-tags");
      for (const t of item.tags) {
        tagsDiv.appendChild(el("span", "gallery-tag", String(t)));
      }
      card.appendChild(tagsDiv);
    }

    if (item.createdAt) {
      card.appendChild(el("div", "gallery-card-time", timeAgo(String(item.createdAt))));
    }

    card.addEventListener("click", () => {
      showModal(
        `${isBlog ? "\uD83D\uDCDD" : "\uD83C\uDFA8"} ${item.title ?? "Untitled"}`,
        (body) => {
          addLabeledPre(body, isBlog ? "Content" : "Description", String(item.content ?? item.description ?? ""));
          if (item.style) addLabeledPre(body, "Style", String(item.style));
          if (item.tags) addLabeledPre(body, "Tags", JSON.stringify(item.tags));
        },
        item,
      );
    });

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

// === EMOTIONS TAB ===

async function initEmotionsTab(): Promise<void> {
  const container = document.getElementById("tab-content")!;
  container.textContent = "";

  const result = await fetchJSON<{ points: Array<Record<string, number | string>> }>("/api/public/emotions?limit=100");
  const points = result?.points ?? [];

  if (points.length < 2) {
    container.appendChild(el("div", "tab-loading", "Not enough emotion data yet. Need at least 2 data points."));
    return;
  }

  const dims = ["happiness", "curiosity", "anxiety", "boredom", "excitement", "contentment", "frustration"];
  const colors = ["#ffd700", "#00d2ff", "#e74c3c", "#9e9e9e", "#fbbf24", "#2ecc71", "#ff9800"];

  const chartContainer = el("div", "emotions-chart-container");

  const canvas = document.createElement("canvas");
  canvas.className = "emotions-canvas";
  canvas.id = "emotions-canvas";
  chartContainer.appendChild(canvas);

  // Legend
  const legendDiv = el("div", "emotions-legend");
  dims.forEach((d, i) => {
    const item = el("div", "emotions-legend-item");
    const dot = el("div", "emotions-legend-dot");
    dot.style.background = colors[i];
    item.appendChild(dot);
    item.appendChild(document.createTextNode(d));
    legendDiv.appendChild(item);
  });
  chartContainer.appendChild(legendDiv);

  container.appendChild(chartContainer);

  // Draw chart after DOM insertion
  requestAnimationFrame(() => {
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

    // Grid
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

    // Lines per emotion
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
  });
}

// === TAB ROUTING (hash-based) ===

let currentTab = "feed";
let pollTimer: ReturnType<typeof setInterval> | undefined;

const VALID_TABS = ["feed", "timeline", "gallery", "emotions"];

function getTabFromHash(): string {
  const hash = window.location.hash.replace("#", "");
  return VALID_TABS.includes(hash) ? hash : "feed";
}

function switchTab(tab: string): void {
  if (!VALID_TABS.includes(tab)) tab = "feed";
  currentTab = tab;

  // Update hash without triggering hashchange
  if (window.location.hash !== `#${tab}`) {
    history.replaceState(null, "", `#${tab}`);
  }

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
        if (list) renderFeedList(list, filter, search);
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
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab") ?? "feed";
      window.location.hash = tab;
      switchTab(tab);
    });
  });

  // Hash navigation
  window.addEventListener("hashchange", () => {
    switchTab(getTabFromHash());
  });

  // Modal close
  document.getElementById("modal-close")!.addEventListener("click", closeModal);
  document.getElementById("modal-overlay")!.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // Initial load
  updateStats();
  switchTab(getTabFromHash());

  // Poll stats
  setInterval(updateStats, POLL_INTERVAL);
});
