/**
 * ActivityPanel — sidebar showing Truman's creative activity logs in realtime.
 * Toggle with Tab key. Shows tool calls, thoughts, and budget.
 */

export type ActivityEntryType = "search" | "blog" | "artwork" | "thought" | "system";

export interface ActivityEntry {
  type: ActivityEntryType;
  text: string;
  timestamp: number;
  detail?: string; // full content for preview
}

const TYPE_ICONS: Record<ActivityEntryType, string> = {
  search: "\uD83D\uDD0D",  // 🔍
  blog: "\uD83D\uDCDD",    // 📝
  artwork: "\uD83C\uDFA8", // 🎨
  thought: "\uD83D\uDCAD", // 💭
  system: "\u2699\uFE0F",  // ⚙️
};

const MAX_ENTRIES = 20;

export class ActivityPanel {
  private container: HTMLDivElement;
  private entriesDiv: HTMLDivElement;
  private budgetDiv: HTMLDivElement;
  private modal: HTMLDivElement | null = null;
  private visible = false;
  private entries: ActivityEntry[] = [];
  private budgetCalls = 0;
  private budgetTotal = 20;
  private dayCount = 0;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "activity-panel";
    this.container.style.cssText = `
      position: fixed; top: 0; right: 0; z-index: 9998;
      width: 220px; height: 100vh;
      background: rgba(26, 26, 46, 0.85);
      color: #ccc; font-family: monospace; font-size: 9px;
      display: none; flex-direction: column;
      border-left: 1px solid #333;
      pointer-events: auto;
    `;

    // Header
    const header = document.createElement("div");
    header.style.cssText = "padding: 8px; border-bottom: 1px solid #333; color: #ffd93d; font-size: 10px; font-weight: bold;";
    header.textContent = "Activity Log";
    this.container.appendChild(header);

    // Entries area (scrollable)
    this.entriesDiv = document.createElement("div");
    this.entriesDiv.style.cssText = "flex: 1; overflow-y: auto; padding: 4px 6px;";
    this.container.appendChild(this.entriesDiv);

    // Budget bar at bottom
    this.budgetDiv = document.createElement("div");
    this.budgetDiv.style.cssText = "padding: 6px 8px; border-top: 1px solid #333; font-size: 10px;";
    this.container.appendChild(this.budgetDiv);
    this.updateBudgetDisplay();

    document.body.appendChild(this.container);

    // Toggle with Tab key
    window.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        this.toggle();
      }
      if (e.key === "Escape" && this.modal) {
        this.closeModal();
      }
    });
  }

  /** Toggle panel visibility */
  toggle(): void {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? "flex" : "none";
  }

  /** Push a new activity entry */
  push(entry: ActivityEntry): void {
    this.entries.unshift(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.length = MAX_ENTRIES;
    }
    this.renderEntries();
  }

  /** Update budget display */
  updateBudget(callsUsed: number, totalCalls: number, dayCount: number): void {
    this.budgetCalls = callsUsed;
    this.budgetTotal = totalCalls;
    this.dayCount = dayCount;
    this.updateBudgetDisplay();
  }

  /** Get current entry count */
  getEntryCount(): number {
    return this.entries.length;
  }

  /** Check if visible */
  isVisible(): boolean {
    return this.visible;
  }

  private renderEntries(): void {
    this.entriesDiv.innerHTML = "";
    for (const entry of this.entries) {
      const row = document.createElement("div");
      row.style.cssText = "padding: 3px 0; border-bottom: 1px solid #222; cursor: pointer;";

      const time = new Date(entry.timestamp);
      const timeStr = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
      const icon = TYPE_ICONS[entry.type] || "\u2022";

      row.textContent = `${timeStr} ${icon} ${entry.text}`;

      if (entry.detail) {
        row.addEventListener("click", () => this.showModal(entry));
        row.style.cursor = "pointer";
        row.addEventListener("mouseenter", () => { row.style.background = "rgba(255,255,255,0.05)"; });
        row.addEventListener("mouseleave", () => { row.style.background = ""; });
      }

      this.entriesDiv.appendChild(row);
    }
  }

  private updateBudgetDisplay(): void {
    const remaining = this.budgetTotal - this.budgetCalls;
    const pct = this.budgetTotal > 0 ? remaining / this.budgetTotal : 0;
    let color = "#81c784"; // green
    if (pct <= 0.2) color = "#ef5350"; // red
    else if (pct <= 0.5) color = "#ffd93d"; // yellow

    this.budgetDiv.innerHTML = `<span style="color:${color}">\uD83D\uDD0B Tools: ${remaining}/${this.budgetTotal}</span> | Day ${this.dayCount}`;
  }

  private showModal(entry: ActivityEntry): void {
    this.closeModal();

    this.modal = document.createElement("div");
    this.modal.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      z-index: 10000; background: #1a1a2e; color: #e0e0e0;
      padding: 16px 20px; border-radius: 8px; border: 1px solid #555;
      max-width: 500px; max-height: 400px; overflow-y: auto;
      font-family: monospace; font-size: 11px; line-height: 1.5;
      pointer-events: auto;
    `;

    const icon = TYPE_ICONS[entry.type] || "\u2022";
    this.modal.innerHTML = `
      <div style="font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #ffd93d;">
        ${icon} ${entry.text}
      </div>
      <div style="white-space: pre-wrap;">${entry.detail || "(no detail)"}</div>
      <div style="margin-top: 12px; color: #888; font-size: 9px;">Press Escape to close</div>
    `;

    // Close on click outside
    const backdrop = document.createElement("div");
    backdrop.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; background: rgba(0,0,0,0.5);";
    backdrop.addEventListener("click", () => this.closeModal());

    document.body.appendChild(backdrop);
    document.body.appendChild(this.modal);

    // Store backdrop ref for cleanup
    (this.modal as any).__backdrop = backdrop;
  }

  private closeModal(): void {
    if (this.modal) {
      const backdrop = (this.modal as any).__backdrop;
      if (backdrop) backdrop.remove();
      this.modal.remove();
      this.modal = null;
    }
  }
}
