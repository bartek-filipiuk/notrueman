import Phaser from "phaser";
import type { ActivityType } from "@nts/shared";
import { AudioMixer } from "./AudioMixer";

/**
 * Maps activity types to their ambient sound keys.
 * Activities not in this map have no specific ambient sound.
 * Per visual-spec S9.2.
 */
export const ACTIVITY_SOUND_MAP: Partial<Record<ActivityType, string>> = {
  computer: "ambient_typing",
  cook: "ambient_sizzle",
  read: "ambient_page_turn",
  exercise: "ambient_breathing",
  draw: "ambient_pencil",
};

/**
 * Volume levels for each ambient sound (relative to channel, 0–1).
 * These are multiplied by the AudioMixer ambient channel volume.
 * Per visual-spec S9.2.
 */
export const AMBIENT_VOLUMES: Record<string, number> = {
  ambient_clock: 0.1,
  ambient_typing: 0.2,
  ambient_sizzle: 0.3,
  ambient_page_turn: 0.15,
  ambient_breathing: 0.2,
  ambient_pencil: 0.15,
  ambient_crickets: 0.1,
};

/** Check if a given hour is nighttime (21:00–05:59) */
export function isNightTime(hour: number): boolean {
  return hour >= 21 || hour < 6;
}

/**
 * AmbientManager — orchestrates ambient sound playback based on
 * current activity and time of day.
 *
 * Always plays: clock ticking (subtle background).
 * Activity-specific: keyboard, sizzle, page turn, breathing, pencil.
 * Time-based: crickets at night (clear weather).
 *
 * Integrates with AudioMixer's "ambient" channel.
 */
export class AmbientManager {
  private scene: Phaser.Scene;
  private mixer: AudioMixer;
  private currentActivitySound: Phaser.Sound.BaseSound | null = null;
  private currentActivityKey: string | null = null;
  private clockSound: Phaser.Sound.BaseSound | null = null;
  private cricketsSound: Phaser.Sound.BaseSound | null = null;
  private lastNightCheck = false;
  private hourCheckTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, mixer: AudioMixer) {
    this.scene = scene;
    this.mixer = mixer;
  }

  /**
   * Start ambient system: begins clock ticking and time-based checks.
   * Call after ProceduralAudio.generateAllAmbientSounds().
   */
  start(): void {
    // Start clock ticking (always on)
    this.startClock();

    // Check time-based sounds immediately and every 60 seconds
    this.updateTimeBasedSounds();
    this.hourCheckTimer = this.scene.time.addEvent({
      delay: 60_000,
      loop: true,
      callback: () => this.updateTimeBasedSounds(),
    });
  }

  /**
   * Called when activity changes. Stops previous activity sound,
   * starts new one if applicable.
   */
  onActivityChange(activity: ActivityType | null): void {
    const newKey = activity ? ACTIVITY_SOUND_MAP[activity] ?? null : null;

    // No change needed
    if (newKey === this.currentActivityKey) return;

    // Stop previous activity sound
    if (this.currentActivitySound) {
      this.currentActivitySound.destroy();
      this.currentActivitySound = null;
    }
    this.currentActivityKey = null;

    // Start new activity sound
    if (newKey && this.scene.cache.audio.exists(newKey)) {
      const vol = AMBIENT_VOLUMES[newKey] ?? 0.15;
      this.currentActivitySound = this.mixer.playLoop("ambient", newKey, { volume: vol });
      this.currentActivityKey = newKey;
    }
  }

  /** Stop all ambient sounds and clean up timers */
  destroy(): void {
    if (this.currentActivitySound) {
      this.currentActivitySound.destroy();
      this.currentActivitySound = null;
    }
    if (this.clockSound) {
      this.clockSound.destroy();
      this.clockSound = null;
    }
    if (this.cricketsSound) {
      this.cricketsSound.destroy();
      this.cricketsSound = null;
    }
    if (this.hourCheckTimer) {
      this.hourCheckTimer.destroy();
      this.hourCheckTimer = undefined;
    }
    this.currentActivityKey = null;
  }

  /** Start the ever-present clock ticking */
  private startClock(): void {
    const key = "ambient_clock";
    if (!this.scene.cache.audio.exists(key)) return;
    const vol = AMBIENT_VOLUMES[key] ?? 0.1;
    this.clockSound = this.mixer.playLoop("ambient", key, { volume: vol });
  }

  /** Check time of day and start/stop crickets accordingly */
  private updateTimeBasedSounds(): void {
    const hour = new Date().getHours();
    const night = isNightTime(hour);

    if (night && !this.lastNightCheck) {
      // Night started — add crickets
      this.startCrickets();
    } else if (!night && this.lastNightCheck) {
      // Day started — stop crickets
      this.stopCrickets();
    }

    this.lastNightCheck = night;
  }

  private startCrickets(): void {
    if (this.cricketsSound) return; // already playing
    const key = "ambient_crickets";
    if (!this.scene.cache.audio.exists(key)) return;
    const vol = AMBIENT_VOLUMES[key] ?? 0.1;
    this.cricketsSound = this.mixer.playLoop("ambient", key, { volume: vol });
  }

  private stopCrickets(): void {
    if (this.cricketsSound) {
      this.cricketsSound.destroy();
      this.cricketsSound = null;
    }
  }
}
