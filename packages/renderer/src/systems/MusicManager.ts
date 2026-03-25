import Phaser from "phaser";
import type { OverallMood } from "@nts/shared";
import { AudioMixer } from "./AudioMixer";
import { MOOD_TO_MUSIC } from "./ProceduralMusic";

/**
 * Crossfade duration in milliseconds.
 * Per T8.4 spec: 2 seconds crossfade between tracks.
 */
export const CROSSFADE_DURATION_MS = 2000;

/** Crossfade step interval (ms) — smooth 60 steps over 2s */
const CROSSFADE_STEP_MS = 33;

/**
 * MusicManager — manages mood-based background music with crossfade.
 *
 * Per visual-spec S9.3 and T8.4:
 * - Lo-fi background tracks at 15-20% volume
 * - Mood mapping: happy/excited → upbeat, sad/anxious → piano,
 *   curious/contemplative → quirky, neutral/content/bored → calm
 * - 2-second crossfade between tracks when mood changes
 * - Some periods with comfortable silence are OK
 *
 * Uses AudioMixer "music" channel (default 0.18 volume).
 */
export class MusicManager {
  private scene: Phaser.Scene;
  private mixer: AudioMixer;
  private currentTrackKey: string | null = null;
  private currentSound: Phaser.Sound.BaseSound | null = null;
  private fadingOutSound: Phaser.Sound.BaseSound | null = null;
  private crossfadeTimer?: Phaser.Time.TimerEvent;
  private fadeProgress = 0;
  private started = false;

  constructor(scene: Phaser.Scene, mixer: AudioMixer) {
    this.scene = scene;
    this.mixer = mixer;
  }

  /**
   * Start the music system. Begins playing the track for the given mood.
   * If no mood is provided, defaults to "neutral".
   */
  start(initialMood?: OverallMood | string): void {
    this.started = true;
    const mood = initialMood ?? "neutral";
    this.onMoodChange(mood);
  }

  /**
   * Called when Truman's mood changes. Triggers crossfade to appropriate track.
   */
  onMoodChange(mood: OverallMood | string): void {
    if (!this.started) return;

    const musicCategory = MOOD_TO_MUSIC[mood] ?? "neutral";
    const trackKey = `music_${musicCategory}`;

    // Already playing this track
    if (trackKey === this.currentTrackKey) return;

    // Check if track exists in cache
    if (!this.scene.cache.audio.exists(trackKey)) {
      console.warn(`[MusicManager] Track "${trackKey}" not found in cache`);
      return;
    }

    // If nothing is playing, just start the new track
    if (!this.currentSound) {
      this.playTrack(trackKey);
      return;
    }

    // Crossfade from current to new track
    this.crossfadeTo(trackKey);
  }

  /** Get the currently playing track key */
  getCurrentTrackKey(): string | null {
    return this.currentTrackKey;
  }

  /** Check if music is currently playing */
  isPlaying(): boolean {
    return this.currentSound !== null;
  }

  /** Stop all music immediately */
  stop(): void {
    this.cancelCrossfade();

    if (this.fadingOutSound) {
      this.fadingOutSound.destroy();
      this.fadingOutSound = null;
    }
    if (this.currentSound) {
      this.currentSound.destroy();
      this.currentSound = null;
    }
    this.currentTrackKey = null;
  }

  /** Clean up all resources */
  destroy(): void {
    this.stop();
    this.started = false;
  }

  /** Start playing a track from scratch (no crossfade) */
  private playTrack(trackKey: string): void {
    this.currentSound = this.mixer.playLoop("music", trackKey);
    this.currentTrackKey = trackKey;
  }

  /** Crossfade from current track to a new track over CROSSFADE_DURATION_MS */
  private crossfadeTo(newTrackKey: string): void {
    // Cancel any in-progress crossfade
    this.cancelCrossfade();

    // Move current to fading-out
    if (this.fadingOutSound) {
      this.fadingOutSound.destroy();
    }
    this.fadingOutSound = this.currentSound;
    this.currentSound = null;
    this.currentTrackKey = null;

    // Start new track at zero volume
    const newSound = this.mixer.playLoop("music", newTrackKey, { volume: 0 });
    if (!newSound) {
      // Failed to start new track — restore old one
      this.currentSound = this.fadingOutSound;
      this.fadingOutSound = null;
      return;
    }

    this.currentSound = newSound;
    this.currentTrackKey = newTrackKey;
    this.fadeProgress = 0;

    const totalSteps = Math.ceil(CROSSFADE_DURATION_MS / CROSSFADE_STEP_MS);

    this.crossfadeTimer = this.scene.time.addEvent({
      delay: CROSSFADE_STEP_MS,
      repeat: totalSteps - 1,
      callback: () => {
        this.fadeProgress++;
        const t = Math.min(this.fadeProgress / totalSteps, 1);

        // Fade in new track
        if (this.currentSound && "setVolume" in this.currentSound) {
          (this.currentSound as Phaser.Sound.WebAudioSound).setVolume(
            this.mixer.getEffectiveVolume("music") * t,
          );
        }

        // Fade out old track
        if (this.fadingOutSound && "setVolume" in this.fadingOutSound) {
          (this.fadingOutSound as Phaser.Sound.WebAudioSound).setVolume(
            this.mixer.getEffectiveVolume("music") * (1 - t),
          );
        }

        // Crossfade complete
        if (t >= 1) {
          if (this.fadingOutSound) {
            this.fadingOutSound.destroy();
            this.fadingOutSound = null;
          }
          this.crossfadeTimer = undefined;
        }
      },
    });
  }

  /** Cancel an in-progress crossfade */
  private cancelCrossfade(): void {
    if (this.crossfadeTimer) {
      this.crossfadeTimer.destroy();
      this.crossfadeTimer = undefined;
    }
    if (this.fadingOutSound) {
      this.fadingOutSound.destroy();
      this.fadingOutSound = null;
    }
    this.fadeProgress = 0;
  }
}
