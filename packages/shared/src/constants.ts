import type { EmotionState } from "./types/emotions.js";
import type { BubbleStyle, RoomObject } from "./types/renderer.js";
import type { ActivityType } from "./types/agent-state.js";

/** Application name */
export const APP_NAME = "No True Man Show";

/** Brain loop constants (brain-algorithm.md S3.1) */
export const TICK_INTERVAL_MS = 30_000;
export const REFLECTION_THRESHOLD = 150;
export const MEMORY_RETRIEVE_K = 20;
export const WAKE_HOURS_MIN = 16;
export const WAKE_HOURS_MAX = 18;
export const SLEEP_HOURS_MIN = 6;
export const SLEEP_HOURS_MAX = 8;
export const SLEEP_TICK_INTERVAL_MS = 300_000;

/** Embedding dimensions (tech-stack.md S4.4) */
export const EMBEDDING_DIMENSIONS = 768;

/** Recency decay constant (brain-algorithm.md S4.1) */
export const RECENCY_DECAY_BASE = 0.995;

/** Emotion defaults (design-spec.md S3, agent-spec.md S4.1) */
export const EMOTION_DEFAULTS: EmotionState = {
  happiness: 0.6,
  curiosity: 0.7,
  anxiety: 0.2,
  boredom: 0.3,
  excitement: 0.4,
  contentment: 0.5,
  frustration: 0.1,
};

/** Emotion floors (agent-spec.md S4.3) */
export const EMOTION_FLOORS: Partial<EmotionState> = {
  happiness: 0.2,
};

/** Emotion ceilings (agent-spec.md S4.3) */
export const EMOTION_CEILINGS: Partial<EmotionState> = {
  anxiety: 0.6,
  boredom: 0.9,
  frustration: 0.7,
};

/** Emotion time decay rate per tick (brain-algorithm.md S10.1) */
export const EMOTION_DECAY_RATE = 0.02;

/** Emotion LLM evaluation frequency (brain-algorithm.md S10.2) */
export const EMOTION_LLM_EVAL_EVERY_N_TICKS = 5;

/** Variety scoring thresholds (brain-algorithm.md S7.1) */
export const VARIETY_SCORING = {
  HEAVY_PENALTY_HOURS: 2,
  HEAVY_PENALTY_VALUE: 0.2,
  MODERATE_PENALTY_HOURS: 6,
  MODERATE_PENALTY_VALUE: 0.5,
  LIGHT_PENALTY_HOURS: 12,
  LIGHT_PENALTY_VALUE: 0.8,
  NOVELTY_BONUS_HOURS: 24,
  NOVELTY_BONUS_VALUE: 1.2,
  DEFAULT_VALUE: 1.0,
} as const;

/** Awakening phase thresholds (agent-spec.md S7.3) */
export const AWAKENING_THRESHOLDS = {
  unaware: 0.0,
  subtle: 0.15,
  pattern: 0.35,
  questioning: 0.55,
  exploring: 0.75,
} as const;

/** Vocalization probability table (brain-algorithm.md S9.1) */
export const VOCALIZATION_PROBABILITY = {
  new_activity: 0.7,
  unexpected_event: 0.9,
  task_success: 0.5,
  task_failure: 0.8,
  focused_work: 0.1,
  idle_transition: 0.3,
  after_reflection: 0.6,
  viewer_event: 0.85,
} as const;

/** Significant observation threshold (brain-algorithm.md S3.3 step 4) */
export const SIGNIFICANT_OBS_THRESHOLD = 6;

/** Last-N action tracking window (brain-algorithm.md S7.5) */
export const LAST_N_ACTIONS = 20;

/** Activity failure rates (design-spec.md S5.2) */
export const ACTIVITY_FAILURE_RATES: Record<string, number> = {
  sleep: 0,
  eat: 0.25,
  read: 0.1,
  computer: 0.2,
  exercise: 0.25,
  think: 0.05,
  cook: 0.3,
  draw: 0.25,
};

/** Resistance/refusal rates by mood (interaction-spec.md S2.2) */
export const REFUSAL_RATES: Record<string, number> = {
  happy: 0.15,
  content: 0.15,
  curious: 0.2,
  excited: 0.2,
  neutral: 0.3,
  bored: 0.25,
  frustrated: 0.45,
  anxious: 0.45,
};

/** Chaos mode parameter overrides (interaction-spec.md S7.1) */
export const CHAOS_MODE = {
  VOTE_WINDOW_MIN: 2,
  POLL_FREQUENCY_MIN: 15,
  POLL_OPTIONS: 6,
  CHANNEL_POINT_COOLDOWN_MIN: 3,
  REFUSAL_RATE: 0.15,
} as const;

/** Normal mode parameters (interaction-spec.md S3) */
export const NORMAL_MODE = {
  VOTE_WINDOW_MIN: 5,
  POLL_FREQUENCY_MIN: 60,
  POLL_OPTIONS: 4,
  CHANNEL_POINT_COOLDOWN_MIN: 10,
} as const;

/** LLM sampling rate (observability-spec.md S3.1) */
export const LLM_SAMPLE_RATE = 0.05;
export const LLM_ALWAYS_SAMPLE_PURPOSES = [
  "reflection",
  "replan",
  "daily_plan",
] as const;

/** Mood-based bubble colors (visual-spec.md S7.3) */
export const MOOD_BUBBLE_STYLES: Record<string, BubbleStyle> = {
  happy: {
    bubbleColor: "#FFF8E1",
    textColor: "#3E2723",
    border: "rounded",
  },
  curious: {
    bubbleColor: "#E1F5FE",
    textColor: "#0D47A1",
    border: "angular",
  },
  anxious: {
    bubbleColor: "#F3E5F5",
    textColor: "#4A148C",
    border: "wobbly",
  },
  excited: {
    bubbleColor: "#FFF3E0",
    textColor: "#E65100",
    border: "bouncy",
  },
  frustrated: {
    bubbleColor: "#FFEBEE",
    textColor: "#B71C1C",
    border: "sharp",
  },
  content: {
    bubbleColor: "#E8F5E9",
    textColor: "#1B5E20",
    border: "rounded",
  },
  contemplative: {
    bubbleColor: "#F5F5F5",
    textColor: "#212121",
    border: "minimal",
  },
  bored: {
    bubbleColor: "#ECEFF1",
    textColor: "#455A64",
    border: "minimal",
  },
  neutral: {
    bubbleColor: "#FAFAFA",
    textColor: "#424242",
    border: "rounded",
  },
};

/** Typewriter effect speed (visual-spec.md S7.2) */
export const TYPEWRITER_CHAR_MS = 50;

/** Bubble display duration (visual-spec.md S7.2) */
export const BUBBLE_DISPLAY_MS = 9_000;
export const BUBBLE_FADE_MS = 1_000;

/** BullMQ queue names (tech-stack.md S7) */
export const QUEUE_NAMES = {
  AGENT_THINK: "agent:think",
  AGENT_ACTION: "agent:action",
  RENDERER_COMMAND: "renderer:command",
  LOG_EVENT: "log:event",
  TTS_GENERATE: "tts:generate",
  CHAT_EVENT: "chat:event",
} as const;

/** Cost checkpoint interval (observability-spec.md S2.2) */
export const COST_CHECKPOINT_INTERVAL_MIN = 10;

/** Cost cap thresholds (brain-algorithm.md S12.2) */
export const COST_CAP_WARNING_PCT = 0.8;
export const COST_CAP_HARD_PCT = 1.0;

/** Phaser game config constants (visual-spec.md S2, tech-stack.md S5.1) */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const GAME_FPS = 30;
export const STREAM_WIDTH = 1920;
export const STREAM_HEIGHT = 1080;

/**
 * All activity types as array (design-spec.md S5.2).
 * SINGLE SOURCE OF TRUTH for activities. Zod schemas derive from this list.
 *
 * To add a new activity:
 * 1. Add type literal to ActivityType union (types/agent-state.ts)
 * 2. Add entry here in ACTIVITY_LIST
 * 3. Add entry in ACTIVITY_FAILURE_RATES (below)
 * 4. Add color in renderer ActivityRenderer.ACTIVITY_EFFECT_COLORS
 * 5. Add draw method in ActivityRenderer.drawActivityFrame()
 * 6. Add room mapping in ActivityManager.ACTIVITY_OBJECTS
 * 7. Add physical effects in agent-brain PhysicalStateEngine.ACTIVITY_EFFECTS
 */
export const ACTIVITY_LIST: readonly ActivityType[] = [
  "sleep",
  "eat",
  "read",
  "computer",
  "exercise",
  "think",
  "cook",
  "draw",
] as const;

/** Room objects with positions (visual-spec.md S3.1, S4.1) */
// Background is ONE AI-generated image with all furniture baked in.
// ROOM_OBJECTS are now INTERACTION POINTS — where Truman walks to
// perform activities. No separate sprites needed.
// Positions match furniture in the AI background image (384x216 → 960x540).
export const FLOOR_LINE_Y = 400;

export const ROOM_OBJECTS: readonly RoomObject[] = [
  // Positions = where Truman stands to interact (center-bottom of furniture)
  { id: "bed",          x: 180, y: 430, width: 1, height: 1, label: "Bed", zone: "sleep" },
  { id: "bookshelf",    x: 80,  y: 350, width: 1, height: 1, label: "Bookshelf", zone: "reading" },
  { id: "desk",         x: 260, y: 370, width: 1, height: 1, label: "Desk", zone: "work" },
  { id: "computer",     x: 280, y: 360, width: 1, height: 1, label: "Computer", zone: "work" },
  { id: "window",       x: 480, y: 330, width: 1, height: 1, label: "Window", zone: "window" },
  { id: "fridge",       x: 620, y: 360, width: 1, height: 1, label: "Fridge", zone: "kitchen" },
  { id: "stove",        x: 620, y: 400, width: 1, height: 1, label: "Stove", zone: "kitchen" },
  { id: "plant",        x: 700, y: 380, width: 1, height: 1, label: "Plant", zone: "window" },
  { id: "easel",        x: 800, y: 380, width: 1, height: 1, label: "Easel", zone: "creative" },
  { id: "table_chair",  x: 450, y: 440, width: 1, height: 1, label: "Table & Chair", zone: "kitchen" },
  { id: "exercise_mat", x: 830, y: 450, width: 1, height: 1, label: "Exercise Mat", zone: "exercise" },
  { id: "clock",        x: 480, y: 300, width: 1, height: 1, label: "Clock", zone: "window" },
  { id: "poster",       x: 180, y: 280, width: 1, height: 1, label: "Poster", zone: "creative" },
  { id: "door",         x: 900, y: 380, width: 1, height: 1, label: "Door", zone: "door" },
] as const;
