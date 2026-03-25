/**
 * Chat command handlers for Twitch bot.
 * Commands: !status, !mood, !activity
 */
import type { AgentStateProvider } from "./agent-state-provider.js";

export interface CommandResult {
  response: string;
}

const ACTIVITY_LABELS: Record<string, string> = {
  sleep: "sleeping 💤",
  eat: "eating 🍽️",
  read: "reading a book 📖",
  computer: "working on the computer 💻",
  exercise: "exercising 🏋️",
  think: "deep in thought 🤔",
  cook: "cooking 🍳",
  draw: "drawing on the easel 🎨",
};

const MOOD_EMOJIS: Record<string, string> = {
  happy: "😊",
  curious: "🧐",
  anxious: "😰",
  bored: "😐",
  excited: "🤩",
  content: "😌",
  frustrated: "😤",
  contemplative: "🤔",
  neutral: "😶",
};

function formatActivity(activity: string | null): string {
  if (!activity) return "idle (deciding what to do)";
  return ACTIVITY_LABELS[activity] ?? activity;
}

function formatMood(mood: string): string {
  const emoji = MOOD_EMOJIS[mood] ?? "";
  return `${mood} ${emoji}`.trim();
}

export function handleStatus(state: AgentStateProvider): CommandResult {
  const activity = state.getCurrentActivity();
  const mood = state.getCurrentMood();
  const ticks = state.getTickCount();
  const running = state.isRunning();

  if (!running) {
    return { response: "Truman is offline right now. Check back later!" };
  }

  return {
    response: `Truman is ${formatActivity(activity)} | Mood: ${formatMood(mood)} | Tick #${ticks}`,
  };
}

export function handleMood(state: AgentStateProvider): CommandResult {
  const mood = state.getCurrentMood();
  return { response: `Truman's mood: ${formatMood(mood)}` };
}

export function handleActivity(state: AgentStateProvider): CommandResult {
  const current = state.getCurrentActivity();
  const recent = state.getRecentActivities();

  let response = `Current: ${formatActivity(current)}`;

  if (recent.length > 0) {
    const recentList = recent
      .slice(0, 3)
      .map((r) => {
        const mins = Math.floor(r.completedSecondsAgo / 60);
        return `${formatActivity(r.activity)} (${mins}m ago)`;
      })
      .join(", ");
    response += ` | Recent: ${recentList}`;
  }

  return { response };
}

/** Dispatch a command by name. Returns null if not a known command. */
export function dispatchCommand(
  command: string,
  state: AgentStateProvider,
): CommandResult | null {
  switch (command.toLowerCase()) {
    case "!status":
      return handleStatus(state);
    case "!mood":
      return handleMood(state);
    case "!activity":
      return handleActivity(state);
    default:
      return null;
  }
}
