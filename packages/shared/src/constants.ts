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

/** Room layout constants for 3/4 top-down perspective.
 *  Y=0 at top (back wall), Y=540 at bottom (front).
 *  Wall zone: Y=0..ROOM_WALL_BOTTOM_Y (back wall, objects hang here).
 *  Floor zone: ROOM_FLOOR_TOP_Y..ROOM_FLOOR_BOTTOM_Y (walkable area). */
export const ROOM_WALL_TOP_Y = 0;
export const ROOM_WALL_BOTTOM_Y = 200;
export const ROOM_FLOOR_TOP_Y = 210;
export const ROOM_FLOOR_BOTTOM_Y = 520;
/** @deprecated Use ROOM_FLOOR_TOP_Y / ROOM_FLOOR_BOTTOM_Y instead */
export const FLOOR_LINE_Y = ROOM_FLOOR_TOP_Y;

export const ROOM_OBJECTS: readonly RoomObject[] = [
  // === FLOOR OBJECTS (sorted roughly by Y for readability) ===
  // Positions in 3/4 top-down view. Origin = center-bottom of sprite.
  // collisionBox: {x, y, w, h} offset from object (x,y), used for pathfinding obstacles.
  { id: "bookshelf",    x: 100, y: 280, width: 64, height: 96, displayWidth: 64, displayHeight: 96, wallMounted: false, collisionBox: { x: -28, y: -20, w: 56, h: 20 }, label: "Bookshelf", zone: "reading" },
  { id: "fridge",       x: 60,  y: 320, width: 48, height: 80, displayWidth: 48, displayHeight: 80, wallMounted: false, collisionBox: { x: -20, y: -20, w: 40, h: 20 }, label: "Fridge", zone: "kitchen" },
  { id: "stove",        x: 160, y: 340, width: 48, height: 48, displayWidth: 48, displayHeight: 48, wallMounted: false, collisionBox: { x: -20, y: -16, w: 40, h: 16 }, label: "Stove", zone: "kitchen" },
  { id: "desk",         x: 480, y: 310, width: 96, height: 64, displayWidth: 96, displayHeight: 64, wallMounted: false, collisionBox: { x: -40, y: -20, w: 80, h: 20 }, label: "Desk", zone: "work" },
  { id: "computer",     x: 490, y: 290, width: 64, height: 48, displayWidth: 64, displayHeight: 48, wallMounted: false, collisionBox: { x: -24, y: -16, w: 48, h: 16 }, label: "Computer", zone: "work" },
  { id: "plant",        x: 350, y: 270, width: 32, height: 48, displayWidth: 32, displayHeight: 48, wallMounted: false, collisionBox: { x: -12, y: -10, w: 24, h: 10 }, label: "Plant", zone: "window" },
  { id: "bed",          x: 820, y: 380, width: 128, height: 64, displayWidth: 128, displayHeight: 64, wallMounted: false, collisionBox: { x: -56, y: -24, w: 112, h: 24 }, label: "Bed", zone: "sleep" },
  { id: "easel",        x: 880, y: 300, width: 48, height: 80, displayWidth: 48, displayHeight: 80, wallMounted: false, collisionBox: { x: -18, y: -16, w: 36, h: 16 }, label: "Easel", zone: "creative" },
  { id: "table_chair",  x: 600, y: 420, width: 96, height: 64, displayWidth: 96, displayHeight: 64, wallMounted: false, collisionBox: { x: -40, y: -20, w: 80, h: 20 }, label: "Table & Chair", zone: "kitchen" },
  { id: "exercise_mat", x: 380, y: 460, width: 96, height: 32, displayWidth: 96, displayHeight: 32, wallMounted: false, collisionBox: { x: -40, y: -10, w: 80, h: 10 }, label: "Exercise Mat", zone: "exercise" },
  { id: "door",         x: 910, y: 260, width: 48, height: 96, displayWidth: 48, displayHeight: 96, wallMounted: false, collisionBox: { x: -20, y: -16, w: 40, h: 16 }, label: "Door", zone: "door" },
  // === WALL-MOUNTED OBJECTS (no collision, fixed depth) ===
  { id: "window",       x: 480, y: 120, width: 64, height: 80, displayWidth: 80, displayHeight: 80, wallMounted: true, label: "Window", zone: "window" },
  { id: "clock",        x: 700, y: 80,  width: 32, height: 32, displayWidth: 32, displayHeight: 32, wallMounted: true, label: "Clock", zone: "window" },
  { id: "poster",       x: 780, y: 100, width: 48, height: 48, displayWidth: 48, displayHeight: 48, wallMounted: true, label: "Poster", zone: "creative" },
] as const;

/** Anchor points: where Truman positions himself when performing an activity.
 *  x/y = Truman's feet position. facing = which way he looks.
 *  poseOffsetY = vertical adjustment for pose (negative = higher, e.g. lying in bed). */
export interface ActivityAnchor {
  x: number;
  y: number;
  facing: "left" | "right";
  poseOffsetX?: number;
  poseOffsetY?: number;
}

// Anchor points for 3/4 top-down view — Truman stands BELOW or BESIDE the object
export const ACTIVITY_ANCHORS: Record<ActivityType, ActivityAnchor> = {
  sleep:    { x: 820, y: 400, facing: "left", poseOffsetY: -10 },  // in front of bed
  eat:      { x: 600, y: 440, facing: "right" },                   // at table (below it)
  read:     { x: 100, y: 300, facing: "right" },                   // at bookshelf (below it)
  computer: { x: 480, y: 330, facing: "right" },                   // at desk (below it)
  exercise: { x: 380, y: 480, facing: "right" },                   // on mat
  think:    { x: 480, y: 240, facing: "right" },                   // near window (below wall)
  cook:     { x: 160, y: 360, facing: "right" },                   // at stove (below it)
  draw:     { x: 880, y: 320, facing: "left" },                    // at easel (below it)
};
