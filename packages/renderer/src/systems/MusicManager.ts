import Phaser from "phaser";
import { AudioMixer } from "./AudioMixer";
import { type MusicMood, MUSIC_TRACK_KEYS, moodToMusicMood } from "./ProceduralMusic";

/**
 * Crossfade duration in milliseconds.
 * Per T8.4: 2 second crossfade between tracks.
 */
export const CROSSFADE_MS = 2000;

/**
 * Silence probability — some periods with no music (comfortable silence is OK).
 * Per visual-spec S9.3: not every moment needs music.
 * ~20% chance of silence after a track ends.
 */
export const SILENCE_CHANCE = 0.2;

/**
 * Minimum silence duration in ms before next track starts.
 */
export const MIN_SILENCE_MS = 10_000;

/**
 * Maximum silence duration in ms.
 */
export const MAX_SILENCE_MS = 30_000;

/**
 * MusicManager — manages mood-based background music with crossfade.
 *
 * Features:
 * - Mood-reactive: switches tracks when Truman's mood changes
 * - 2-second crossfade between tracks (smooth transition)
 * - Comfortable silences: ~20% chance of quiet period between tracks
 * - Plays on AudioMixer "music" channel (15-20% volume per spec)
 * - Loops current track until mood changes
 *
 * Per visual-spec S9.3: lo-fi hip hop / ambient / chiptune style.
 */
export class MusicManager {
  private scene: Phaser.Scene;
  private mixer: AudioMixer;
  private currentMood: MusicMood | null = null;
  private currentSound: Phaser.Sound.BaseSound | null = null;
  private fadeTween: Phaser.Tweens.Tween | null = null;
  private silenceTimer?: Phaser.Time.TimerEvent;
  private started = false;
  private _inSilence = false;

  constructor(scene: Phaser.Scene, mixer: AudioMixer) {
    this.scene = scene;
    this.mixer = mixer;
  }

  /** Start the music system. Begins with calm track. */
  start(initialMood = "neutral"): void {
    if (this.started) return;
    this.started = true;
    this.onMoodChange(initialMood);
  }

  /**
   * Called when Truman's mood changes. Crossfades to appropriate track
   * if the music mood category changed.
   */
  onMoodChange(mood: string): void {
    if (!this.started) return;

    const newMusicMood = moodToMusicMood(mood);
    if (newMusicMood === this.currentMood) return;

    this.crossfadeTo(newMusicMood);
  }

  /** Whether the manager is currently in a silence period */
  get inSilence(): boolean {
    return this._inSilence;
  }

  /** Current playing music mood (null if silent/stopped) */
  get activeMood(): MusicMood | null {
    return this.currentMood;
  }

  /** Stop all music and clean up */
  destroy(): void {
    this.started = false;
    this.cancelSilenceTimer();
    this.cancelFadeTween();

    if (this.currentSound) {
      this.currentSound.destroy();
      this.currentSound = null;
    }
    this.currentMood = null;
    this._inSilence = false;
  }

  /**
   * Crossfade from current track to a new mood track.
   * If no current track, starts immediately.
   */
  private crossfadeTo(newMood: MusicMood): void {
    this.cancelSilenceTimer();
    this._inSilence = false;

    const newKey = MUSIC_TRACK_KEYS[newMood];
    if (!this.scene.cache.audio.exists(newKey)) {
      console.warn(`[MusicManager] Track "${newKey}" not in cache, skipping`);
      this.currentMood = newMood;
      return;
    }

    const oldSound = this.currentSound;
    this.cancelFadeTween();

    // Start new track at volume 0, fade in
    const newSound = this.mixer.playLoop("music", newKey, { volume: 0 });
    if (!newSound) {
      this.currentMood = newMood;
      return;
    }

    this.currentSound = newSound;
    this.currentMood = newMood;

    // Wire up loop completion for silence periods
    // Since we're looping, we use a timer to occasionally insert silence
    this.scheduleNextSilenceCheck();

    if (oldSound) {
      // Crossfade: fade out old, fade in new over CROSSFADE_MS
      this.fadeTween = this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: CROSSFADE_MS,
        onUpdate: (tween) => {
          const progress = (tween.getValue() ?? 0);
          // Fade in new sound
          if ("setVolume" in newSound && typeof newSound.setVolume === "function") {
            (newSound as Phaser.Sound.WebAudioSound).setVolume(progress);
          }
          // Fade out old sound
          if ("setVolume" in oldSound && typeof oldSound.setVolume === "function") {
            (oldSound as Phaser.Sound.WebAudioSound).setVolume(1 - progress);
          }
        },
        onComplete: () => {
          oldSound.destroy();
          this.fadeTween = null;
        },
      });
    } else {
      // No previous track — fade in from silence
      this.fadeTween = this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: CROSSFADE_MS,
        onUpdate: (tween) => {
          const progress = (tween.getValue() ?? 0);
          if ("setVolume" in newSound && typeof newSound.setVolume === "function") {
            (newSound as Phaser.Sound.WebAudioSound).setVolume(progress);
          }
        },
        onComplete: () => {
          this.fadeTween = null;
        },
      });
    }
  }

  /**
   * Schedule a timer to check if we should insert a silence period.
   * Checks every ~30-60 seconds (randomized to feel natural).
   */
  private scheduleNextSilenceCheck(): void {
    this.cancelSilenceTimer();

    const checkDelay = 30_000 + Math.random() * 30_000; // 30-60s
    this.silenceTimer = this.scene.time.addEvent({
      delay: checkDelay,
      callback: () => {
        if (!this.started || !this.currentSound) return;

        if (Math.random() < SILENCE_CHANCE) {
          this.enterSilence();
        } else {
          // Check again later
          this.scheduleNextSilenceCheck();
        }
      },
    });
  }

  /** Fade out current track and enter a silence period */
  private enterSilence(): void {
    this._inSilence = true;
    const sound = this.currentSound;
    if (!sound) return;

    this.cancelFadeTween();

    this.fadeTween = this.scene.tweens.addCounter({
      from: 1,
      to: 0,
      duration: CROSSFADE_MS,
      onUpdate: (tween) => {
        if ("setVolume" in sound && typeof sound.setVolume === "function") {
          (sound as Phaser.Sound.WebAudioSound).setVolume((tween.getValue() ?? 0));
        }
      },
      onComplete: () => {
        sound.destroy();
        this.currentSound = null;
        this.fadeTween = null;

        // Schedule resumption after silence period
        const silenceDuration = MIN_SILENCE_MS + Math.random() * (MAX_SILENCE_MS - MIN_SILENCE_MS);
        this.silenceTimer = this.scene.time.addEvent({
          delay: silenceDuration,
          callback: () => {
            this._inSilence = false;
            if (this.started && this.currentMood) {
              this.crossfadeTo(this.currentMood);
            }
          },
        });
      },
    });
  }

  private cancelFadeTween(): void {
    if (this.fadeTween) {
      this.fadeTween.destroy();
      this.fadeTween = null;
    }
  }

  private cancelSilenceTimer(): void {
    if (this.silenceTimer) {
      this.silenceTimer.destroy();
      this.silenceTimer = undefined;
    }
  }
}
