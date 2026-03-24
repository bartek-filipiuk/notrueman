import type { PhysicalState, ActivityType } from "@nts/shared";
import { ACTIVITY_LIST } from "@nts/shared";

const DEFAULT_PHYSICAL_STATE: PhysicalState = {
  energy: 0.8,
  hunger: 0.3,
  tiredness: 0.2,
};

/** Activity effects on physical state */
const ACTIVITY_EFFECTS: Record<string, Partial<PhysicalState>> = {
  sleep: { energy: 0.15, tiredness: -0.2, hunger: 0.02 },
  eat: { energy: 0.05, hunger: -0.3, tiredness: 0.0 },
  exercise: { energy: -0.15, tiredness: 0.1, hunger: 0.05 },
  cook: { energy: -0.03, tiredness: 0.02, hunger: 0.02 },
  read: { energy: -0.02, tiredness: 0.03, hunger: 0.01 },
  computer: { energy: -0.03, tiredness: 0.05, hunger: 0.01 },
  think: { energy: -0.01, tiredness: 0.02, hunger: 0.01 },
  draw: { energy: -0.03, tiredness: 0.03, hunger: 0.01 },
};

/** Natural drift rates per hour */
const DRIFT_PER_HOUR = {
  energy: -0.03,     // energy slowly drains
  hunger: 0.06,      // hunger slowly builds
  tiredness: 0.04,   // tiredness slowly builds
};

/**
 * Physical state engine (T4.5).
 * Manages energy, hunger, tiredness — influences activity selection.
 */
export class PhysicalStateEngine {
  private state: PhysicalState;

  constructor(initial?: PhysicalState) {
    this.state = initial ? { ...initial } : { ...DEFAULT_PHYSICAL_STATE };
  }

  /** Get current physical state */
  getState(): PhysicalState {
    return { ...this.state };
  }

  /** Set state directly (for persistence recovery) */
  setState(state: PhysicalState): void {
    this.state = { ...state };
    this.clamp();
  }

  /** Apply the effect of an activity on physical state */
  applyActivity(activity: string): void {
    const effects = ACTIVITY_EFFECTS[activity];
    if (!effects) return;

    if (effects.energy !== undefined) this.state.energy += effects.energy;
    if (effects.hunger !== undefined) this.state.hunger += effects.hunger;
    if (effects.tiredness !== undefined) this.state.tiredness += effects.tiredness;

    this.clamp();
  }

  /** Apply natural drift over elapsed hours */
  applyTimeDrift(hours: number): void {
    this.state.energy += DRIFT_PER_HOUR.energy * hours;
    this.state.hunger += DRIFT_PER_HOUR.hunger * hours;
    this.state.tiredness += DRIFT_PER_HOUR.tiredness * hours;
    this.clamp();
  }

  /**
   * Get activity suitability scores based on physical state.
   * Higher score = more suitable given current physical needs.
   */
  getActivitySuitability(): Record<string, number> {
    const scores: Record<string, number> = {};

    for (const activity of ACTIVITY_LIST) {
      let score = 1.0;

      switch (activity) {
        case "sleep":
          // Sleep is very suitable when tired, less when rested
          score = 0.3 + this.state.tiredness * 0.7;
          break;
        case "eat":
          // Eating is very suitable when hungry
          score = 0.3 + this.state.hunger * 0.7;
          break;
        case "exercise":
          // Exercise needs energy and low tiredness
          score = this.state.energy * (1 - this.state.tiredness * 0.5);
          break;
        case "cook":
          // Cooking needs some energy
          score = 0.5 + this.state.energy * 0.3;
          break;
        default:
          // Other activities: slight energy influence
          score = 0.5 + this.state.energy * 0.3 - this.state.tiredness * 0.2;
          break;
      }

      scores[activity] = Math.max(0.1, Math.min(1.0, score));
    }

    return scores;
  }

  /** Clamp all values to [0, 1] */
  private clamp(): void {
    this.state.energy = Math.max(0, Math.min(1, this.state.energy));
    this.state.hunger = Math.max(0, Math.min(1, this.state.hunger));
    this.state.tiredness = Math.max(0, Math.min(1, this.state.tiredness));
  }
}
