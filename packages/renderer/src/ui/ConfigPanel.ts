/**
 * Simple debug/config overlay toggled with ~ key.
 * Shows current brain state and allows tick interval adjustment.
 */
export class ConfigPanel {
  private container: HTMLDivElement;
  private visible = false;
  private getState: () => Record<string, unknown>;

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
        const bar = "█".repeat(Math.round(v * 10)) + "░".repeat(10 - Math.round(v * 10));
        lines.push(`  ${k.padEnd(12)} ${bar} ${(v as number).toFixed(2)}`);
      }
    }

    if (state.tts) {
      const tts = state.tts as { enabled: boolean; voice: string; playing: boolean; queueSize: number };
      lines.push(``);
      lines.push(`<b>TTS:</b> ${tts.enabled ? `ON (${tts.voice})` : "OFF"}`);
      if (tts.enabled) {
        lines.push(`  Playing: ${tts.playing ? "🔊" : "—"}  Queue: ${tts.queueSize}`);
      }
    }

    if (state.recentActivities) {
      const recent = state.recentActivities as Array<{ activity: string }>;
      lines.push(``);
      lines.push(`<b>Recent:</b> ${recent.map((r) => r.activity).join(" → ")}`);
    }

    this.container.innerHTML = lines.join("<br>");
  }
}
