export interface SaveStats {
  dayCount: number;
  sessionCount: number;
  totalTimeAliveMs: number;
  lastSavedAt: number;
}

export type ResetCallback = (mode: "soft" | "hard") => void;

/**
 * Simple debug/config overlay toggled with ~ key.
 * Shows current brain state, save stats, and reset buttons.
 */
export class ConfigPanel {
  private container: HTMLDivElement;
  private visible = false;
  private getState: () => Record<string, unknown>;
  private saveStats: SaveStats = { dayCount: 0, sessionCount: 1, totalTimeAliveMs: 0, lastSavedAt: 0 };
  private onReset: ResetCallback | null = null;

  constructor(getState: () => Record<string, unknown>) {
    this.getState = getState;
    this.container = document.createElement("div");
    this.container.id = "config-panel";
    this.container.style.cssText = `
      position: fixed; top: 10px; left: 10px; z-index: 9999;
      background: rgba(0,0,0,0.85); color: #0f0; font-family: monospace;
      font-size: 11px; padding: 12px 16px; border-radius: 6px;
      border: 1px solid #333; max-width: 380px; display: none;
      line-height: 1.6; pointer-events: auto;
    `;
    document.body.appendChild(this.container);

    window.addEventListener("keydown", (e) => {
      if (e.key === "`" || e.key === "~") {
        this.toggle();
      }
    });

    // Auto-refresh every 2s when visible
    setInterval(() => {
      if (this.visible) this.render();
    }, 2000);
  }

  /** Set save stats for display (TI.2) */
  setSaveStats(stats: SaveStats): void {
    this.saveStats = stats;
  }

  /** Set reset callback for soft/hard reset buttons (TI.3, TI.4) */
  setOnReset(cb: ResetCallback): void {
    this.onReset = cb;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? "block" : "none";
    if (this.visible) this.render();
  }

  private render(): void {
    const state = this.getState();
    const lines = [
      `<b style="color:#fff">No True Man Show — Debug</b>`,
      `<span style="color:#888">Press ~ to close</span>`,
      ``,
      `<b>Mode:</b> ${state.mode || "unknown"}`,
      `<b>Tick:</b> #${state.tickCount || 0}`,
      `<b>Activity:</b> ${state.currentActivity || "none"}`,
      `<b>Mood:</b> ${state.currentMood || "?"}`,
      `<b>Last error:</b> ${state.lastError || "none"}`,
    ];

    if (state.emotions) {
      const e = state.emotions as Record<string, number>;
      lines.push(``);
      lines.push(`<b>Emotions:</b>`);
      for (const [k, v] of Object.entries(e)) {
        const bar = "\u2588".repeat(Math.round(v * 10)) + "\u2591".repeat(10 - Math.round(v * 10));
        lines.push(`  ${k.padEnd(12)} ${bar} ${(v as number).toFixed(2)}`);
      }
    }

    if (state.tts) {
      const tts = state.tts as { enabled: boolean; voice: string; playing: boolean; queueSize: number };
      lines.push(``);
      lines.push(`<b>TTS:</b> ${tts.enabled ? `ON (${tts.voice})` : "OFF"}`);
      if (tts.enabled) {
        lines.push(`  Playing: ${tts.playing ? "\uD83D\uDD0A" : "\u2014"}  Queue: ${tts.queueSize}`);
      }
    }

    if (state.recentActivities) {
      const recent = state.recentActivities as Array<{ activity: string }>;
      lines.push(``);
      lines.push(`<b>Recent:</b> ${recent.map((r) => r.activity).join(" \u2192 ")}`);
    }

    // Save stats section (TI.2)
    lines.push(``);
    lines.push(`<b style="color:#ffd93d">State Persistence:</b>`);
    lines.push(`  Day ${this.saveStats.dayCount}`);
    lines.push(`  Session #${this.saveStats.sessionCount}`);
    const aliveH = Math.floor(this.saveStats.totalTimeAliveMs / 3_600_000);
    const aliveM = Math.floor((this.saveStats.totalTimeAliveMs % 3_600_000) / 60_000);
    lines.push(`  Alive: ${aliveH}h ${aliveM}m`);
    if (this.saveStats.lastSavedAt > 0) {
      const agoS = Math.round((Date.now() - this.saveStats.lastSavedAt) / 1000);
      lines.push(`  Last saved: ${agoS}s ago`);
    }

    this.container.innerHTML = lines.join("<br>");

    // Add reset buttons (TI.3, TI.4) — recreate each render
    const btnRow = document.createElement("div");
    btnRow.style.cssText = "margin-top: 10px; display: flex; gap: 8px;";

    const softBtn = document.createElement("button");
    softBtn.textContent = "Soft Reset";
    softBtn.style.cssText = "background: #f9a825; color: #000; border: none; padding: 4px 10px; border-radius: 3px; cursor: pointer; font-family: monospace; font-size: 10px;";
    softBtn.onclick = () => this.onReset?.("soft");

    const hardBtn = document.createElement("button");
    hardBtn.textContent = "Hard Reset";
    hardBtn.style.cssText = "background: #e53935; color: #fff; border: none; padding: 4px 10px; border-radius: 3px; cursor: pointer; font-family: monospace; font-size: 10px;";
    hardBtn.onclick = () => {
      if (confirm("Are you sure? This will erase ALL save data and start from Day 0.")) {
        this.onReset?.("hard");
      }
    };

    btnRow.appendChild(softBtn);
    btnRow.appendChild(hardBtn);
    this.container.appendChild(btnRow);
  }
}
