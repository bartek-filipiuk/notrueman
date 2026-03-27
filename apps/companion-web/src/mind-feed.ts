/**
 * Mind feed UI — Twitch-chat style feed of Truman's thoughts.
 * Chat-style cards with gradient borders per event type.
 * Slide-in animation, auto-scroll, max 50 entries.
 */

import type { MindFeedClientEvent } from "./ws-client.js";

const MAX_ENTRIES = 50;

const TYPE_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  thought:         { emoji: "\uD83D\uDCAD", color: "#9b59b6", label: "Thought" },
  mood_change:     { emoji: "\uD83D\uDE0A", color: "#00d2ff", label: "Mood" },
  tool_call:       { emoji: "\uD83D\uDD0D", color: "#f39c12", label: "Search" },
  activity_change: { emoji: "\uD83C\uDFAE", color: "#2ecc71", label: "Activity" },
  blog_created:    { emoji: "\uD83D\uDCDD", color: "#27ae60", label: "Blog" },
  artwork_created: { emoji: "\uD83C\uDFA8", color: "#e91e63", label: "Art" },
  reflection:      { emoji: "\uD83D\uDD2E", color: "#3498db", label: "Insight" },
  status:          { emoji: "\u2699\uFE0F", color: "#95a5a6", label: "Status" },
};

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

function summarizeEvent(event: MindFeedClientEvent): string {
  const d = event.data;
  switch (event.type) {
    case "thought": return String(d.text ?? "...");
    case "mood_change": return `${d.prevMood ?? "?"} \u2192 ${d.mood ?? "?"}`;
    case "tool_call": return `${d.tool ?? "tool"}: ${d.topic ?? ""}`;
    case "activity_change": return `${d.prevActivity ?? "?"} \u2192 ${d.activity ?? "?"}`;
    case "blog_created": return `"${d.title ?? "Untitled"}"`;
    case "artwork_created": return `"${d.title ?? "Untitled"}" (${d.style ?? "?"})`;
    case "reflection": return String(d.insight ?? "...");
    case "status": return String(d.message ?? "connected");
    default: return JSON.stringify(d).slice(0, 100);
  }
}

export interface MindFeedUI {
  addEvent(event: MindFeedClientEvent): void;
  getContainer(): HTMLElement;
}

export function createMindFeed(): MindFeedUI {
  const container = document.createElement("div");
  container.className = "mind-feed";

  const header = document.createElement("div");
  header.className = "mind-feed-header";
  header.innerHTML = `<span class="mind-feed-title">\uD83E\uDDE0 Mind Feed</span>
    <button class="mind-feed-scroll-btn" id="scroll-to-bottom" title="Scroll to bottom">\u2193</button>`;
  container.appendChild(header);

  const list = document.createElement("div");
  list.className = "mind-feed-list";
  container.appendChild(list);

  let autoScroll = true;

  list.addEventListener("scroll", () => {
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    autoScroll = atBottom;
    const btn = container.querySelector("#scroll-to-bottom") as HTMLElement;
    if (btn) btn.style.opacity = atBottom ? "0.3" : "1";
  });

  container.querySelector("#scroll-to-bottom")?.addEventListener("click", () => {
    list.scrollTop = list.scrollHeight;
    autoScroll = true;
  });

  function addEvent(event: MindFeedClientEvent): void {
    const config = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.status;
    const ts = event.timestamp ?? Date.now();

    const card = document.createElement("div");
    card.className = "mind-feed-card";
    card.style.setProperty("--card-color", config.color);

    card.innerHTML = `
      <div class="mf-card-header">
        <span class="mf-badge" style="background:${config.color}">${config.emoji} ${config.label}</span>
        <span class="mf-time">${timeAgo(ts)}</span>
      </div>
      <div class="mf-card-content">${escapeHtml(summarizeEvent(event))}</div>
    `;

    // Store raw event for click-to-preview
    (card as any)._event = event;
    card.addEventListener("click", () => {
      showPreviewModal(event);
    });

    list.appendChild(card);

    // FIFO: remove oldest if over max
    while (list.children.length > MAX_ENTRIES) {
      list.removeChild(list.firstChild!);
    }

    if (autoScroll) {
      list.scrollTop = list.scrollHeight;
    }
  }

  return { addEvent, getContainer: () => container };
}

function showPreviewModal(event: MindFeedClientEvent): void {
  // Only show modal for blog/artwork/reflection events
  if (!["blog_created", "artwork_created", "reflection", "thought"].includes(event.type)) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const config = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.status;
  const d = event.data;

  let contentHTML = "";
  if (event.type === "blog_created") {
    contentHTML = `
      <h3 class="modal-title">${escapeHtml(String(d.title ?? "Untitled"))}</h3>
      <div class="modal-tags">${(d.tags as string[] ?? []).map(t => `<span class="modal-tag">${escapeHtml(t)}</span>`).join("")}</div>
      <p class="modal-body">${escapeHtml(String(d.content ?? ""))}</p>
    `;
  } else if (event.type === "artwork_created") {
    contentHTML = `
      <h3 class="modal-title">${escapeHtml(String(d.title ?? "Untitled"))}</h3>
      <p class="modal-meta">Style: ${escapeHtml(String(d.style ?? ""))}</p>
      <p class="modal-body">${escapeHtml(String(d.description ?? ""))}</p>
    `;
  } else {
    contentHTML = `
      <p class="modal-body">${escapeHtml(summarizeEvent(event))}</p>
    `;
  }

  overlay.innerHTML = `
    <div class="modal-card" style="--card-color:${config.color}">
      <div class="modal-header">
        <span class="mf-badge" style="background:${config.color}">${config.emoji} ${config.label}</span>
        <button class="modal-close">&times;</button>
      </div>
      ${contentHTML}
    </div>
  `;

  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector(".modal-close")?.addEventListener("click", close);

  document.addEventListener("keydown", function handler(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", handler);
    }
  });

  document.body.appendChild(overlay);
}
