export interface DayNightConfig {
  /** How long Truman sleeps (hours). Default: 5 */
  sleepDurationHours: number;
  /** Hour at which Truman naturally wakes up. Default: 7 */
  wakeHour: number;
}

export type DayPhase = "awake" | "sleeping";

export interface DayNightState {
  phase: DayPhase;
  sleepStartedAt: Date | null;
  lastWakeAt: Date | null;
}

const DEFAULT_BEDTIME_HOUR = 22;

/**
 * Day/night cycle manager.
 * Controls when Truman sleeps (no LLM ticks, $0 cost) and wakes up.
 */
export class DayNightCycle {
  private config: DayNightConfig;
  private phase: DayPhase = "awake";
  private sleepStartedAt: Date | null = null;
  private lastWakeAt: Date | null = null;

  constructor(config: DayNightConfig) {
    this.config = config;
  }

  /** Check if Truman is currently sleeping */
  isSleeping(): boolean {
    return this.phase === "sleeping";
  }

  /** Get current phase */
  getPhase(): DayPhase {
    return this.phase;
  }

  /** Get full state for persistence */
  getState(): DayNightState {
    return {
      phase: this.phase,
      sleepStartedAt: this.sleepStartedAt,
      lastWakeAt: this.lastWakeAt,
    };
  }

  /** Put Truman to sleep */
  goToSleep(): void {
    this.phase = "sleeping";
    this.sleepStartedAt = new Date();
  }

  /** Check if it's time to wake up. Call this periodically during sleep. */
  checkWakeUp(now: Date = new Date()): void {
    if (this.phase !== "sleeping" || !this.sleepStartedAt) return;

    const sleepDurationMs = this.config.sleepDurationHours * 60 * 60 * 1000;
    const elapsedMs = now.getTime() - this.sleepStartedAt.getTime();

    if (elapsedMs >= sleepDurationMs) {
      this.phase = "awake";
      this.lastWakeAt = now;
      this.sleepStartedAt = null;
    }
  }

  /** Should Truman go to sleep at this time? */
  shouldSleep(now: Date = new Date()): boolean {
    if (this.phase === "sleeping") return false;
    const hour = now.getHours();
    return hour >= DEFAULT_BEDTIME_HOUR || hour < this.config.wakeHour;
  }

  /** Hours of sleep remaining (0 if awake) */
  getSleepHoursRemaining(): number {
    if (this.phase !== "sleeping" || !this.sleepStartedAt) return 0;
    const sleepDurationMs = this.config.sleepDurationHours * 60 * 60 * 1000;
    const elapsedMs = Date.now() - this.sleepStartedAt.getTime();
    const remainingMs = sleepDurationMs - elapsedMs;
    return Math.max(0, remainingMs / (60 * 60 * 1000));
  }

  /** HUD label for sleep state */
  getHUDLabel(): string {
    if (this.phase === "sleeping") return "Sleeping...";
    return "";
  }

  /** Restore state from persistence */
  restoreState(state: DayNightState): void {
    this.phase = state.phase;
    this.sleepStartedAt = state.sleepStartedAt;
    this.lastWakeAt = state.lastWakeAt;
  }
}
