import { z } from "zod";
import { ACTIVITY_LIST } from "../constants.js";
import type { ActivityType } from "./agent-state.js";

/** ACTIVITY_LIST cast for z.enum() */
const ACTIVITY_ENUM = ACTIVITY_LIST as unknown as readonly [
  ActivityType,
  ...ActivityType[],
];

/** Overall mood literals */
const OverallMoodEnum = z.enum([
  "happy",
  "curious",
  "anxious",
  "bored",
  "excited",
  "content",
  "frustrated",
  "contemplative",
  "neutral",
]);

/** 7-dimension emotion state schema */
const EmotionStateSchema = z.object({
  happiness: z.number().min(0).max(1),
  curiosity: z.number().min(0).max(1),
  anxiety: z.number().min(0).max(1),
  boredom: z.number().min(0).max(1),
  excitement: z.number().min(0).max(1),
  contentment: z.number().min(0).max(1),
  frustration: z.number().min(0).max(1),
});

/** Physical state schema */
const PhysicalStateSchema = z.object({
  energy: z.number().min(0).max(1),
  hunger: z.number().min(0).max(1),
  tiredness: z.number().min(0).max(1),
});

/** Recent activity entry */
const RecentActivitySchema = z.object({
  type: z.string(),
  at: z.number(),
});

/**
 * SaveData Zod schema — defines the full persisted state for Truman.
 * PostgreSQL PRIMARY, localStorage FALLBACK.
 */
export const SaveDataSchema = z.object({
  /** Schema version for migration support */
  version: z.number().int().positive(),
  /** Unix timestamp (ms) when this save was created */
  savedAt: z.number(),
  /** Unix timestamp (ms) of Truman's first-ever creation (never overwritten) */
  createdAt: z.number(),
  /** Day count: floor((now - createdAt) / 86400000) */
  dayCount: z.number().int().min(0),
  /** Total time Truman has been alive across all sessions (ms) */
  totalTimeAliveMs: z.number().min(0),
  /** Number of sessions (incremented each load) */
  sessionCount: z.number().int().min(0),

  /** Truman's renderer state */
  truman: z.object({
    x: z.number(),
    y: z.number(),
    facing: z.enum(["left", "right"]),
    currentActivity: z.enum(ACTIVITY_ENUM).nullable(),
    currentMood: OverallMoodEnum,
  }),

  /** 7-dimension emotion state */
  emotions: EmotionStateSchema,

  /** Physical state (energy, hunger, tiredness) */
  physicalState: PhysicalStateSchema,

  /** Recent activity history for variety scoring */
  recentActivities: z.array(RecentActivitySchema),

  /** Brain loop tick count (continuity) */
  brainTickCount: z.number().int().min(0),
});

/** Inferred TypeScript type from Zod schema */
export type SaveData = z.infer<typeof SaveDataSchema>;

/** Current save data version */
export const SAVE_DATA_VERSION = 1;
