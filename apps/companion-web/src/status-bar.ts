/**
 * Status bar — badge-style indicators for live state.
 * Shows: LIVE indicator, mood, activity, budget.
 */

export interface StatusBarState {
  isLive: boolean;
  day: number;
  mood: string;
  activity: string;
  budgetUsed: number;
  budgetTotal: number;
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

const ACTIVITY_EMOJI: Record<string, string> = {
  read: "\uD83D\uDCD6",
  cook: "\uD83C\uDF73",
  draw: "\uD83C\uDFA8",
  exercise: "\uD83C\uDFCB\uFE0F",
  computer: "\uD83D\uDCBB",
  sleep: "\uD83D\uDE34",
  eat: "\uD83C\uDF7D\uFE0F",
  think: "\uD83E\uDD14",
  watch_tv: "\uD83D\uDCFA",
  look_window: "\uD83C\uDF05",
  idle: "\uD83D\uDCA4",
};

export function createStatusBar(): {
  container: HTMLElement;
  update: (state: Partial<StatusBarState>) => void;
} {
  const container = document.createElement("div");
  container.className = "status-bar";

  const state: StatusBarState = {
    isLive: false,
    day: 1,
    mood: "neutral",
    activity: "idle",
    budgetUsed: 0,
    budgetTotal: 20,
  };

  function render(): void {
    const liveClass = state.isLive ? "live-dot live-dot--on" : "live-dot";
    const liveText = state.isLive ? "LIVE" : "OFFLINE";
    const activityEmoji = ACTIVITY_EMOJI[state.activity] ?? "\uD83C\uDFAE";
    const budgetStr = `${state.budgetUsed}/${state.budgetTotal}`;

    container.innerHTML = `
      <span class="sb-badge sb-live"><span class="${liveClass}"></span> ${liveText} Day ${state.day}</span>
      <span class="sb-badge sb-mood">\uD83E\uDDE0 ${escapeHtml(state.mood)}</span>
      <span class="sb-badge sb-activity">${activityEmoji} ${escapeHtml(state.activity.replace(/_/g, " "))}</span>
      <span class="sb-badge sb-budget">\u26A1 ${budgetStr}</span>
    `;
  }

  function update(partial: Partial<StatusBarState>): void {
    Object.assign(state, partial);
    render();
  }

  render();
  return { container, update };
}
