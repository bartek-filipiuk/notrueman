import Phaser from "phaser";

/**
 * Audio channel identifiers.
 * - voice: TTS speech playback
 * - ambient: activity/environment loops (clock, rain, cooking, etc.)
 * - music: background lo-fi tracks
 */
export type AudioChannel = "voice" | "ambient" | "music";

/** Default volume levels per channel (0–1) */
const DEFAULT_VOLUMES: Record<AudioChannel, number> = {
  voice: 0.8,
  ambient: 0.25,
  music: 0.18,
};

/** All channel names for iteration */
const ALL_CHANNELS: readonly AudioChannel[] = ["voice", "ambient", "music"] as const;

/**
 * AudioMixer — wraps Phaser Sound Manager with three named channels.
 *
 * Each channel has its own volume and mute state. Sounds are tagged with
 * a channel so volume/mute changes propagate to all sounds on that channel.
 *
 * Handles browser autoplay policy: if AudioContext is suspended, calling
 * `resumeOnInteraction()` will set up a one-time click/touch listener.
 */
export class AudioMixer {
  private scene: Phaser.Scene;
  private volumes: Record<AudioChannel, number>;
  private muted: Record<AudioChannel, boolean>;
  private masterMuted = false;
  /** Maps channel → array of active Phaser sounds on that channel */
  private channelSounds: Record<AudioChannel, Phaser.Sound.BaseSound[]>;
  private _audioUnlocked = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.volumes = { ...DEFAULT_VOLUMES };
    this.muted = { voice: false, ambient: false, music: false };
    this.channelSounds = { voice: [], ambient: [], music: [] };

    // Check if audio context is already unlocked
    this._audioUnlocked = !scene.sound.locked;

    if (scene.sound.locked) {
      scene.sound.once("unlocked", () => {
        this._audioUnlocked = true;
      });
    }
  }

  /** Whether the browser audio context has been unlocked by user interaction */
  get audioUnlocked(): boolean {
    return this._audioUnlocked;
  }

  /** Get current volume for a channel (0–1) */
  getVolume(channel: AudioChannel): number {
    return this.volumes[channel];
  }

  /** Set volume for a channel (clamped 0–1). Updates all sounds on that channel. */
  setVolume(channel: AudioChannel, volume: number): void {
    this.volumes[channel] = Math.max(0, Math.min(1, volume));
    this.applyChannelVolume(channel);
  }

  /** Check if a channel is muted */
  isMuted(channel: AudioChannel): boolean {
    return this.muted[channel];
  }

  /** Toggle mute for a specific channel */
  toggleMute(channel: AudioChannel): boolean {
    this.muted[channel] = !this.muted[channel];
    this.applyChannelVolume(channel);
    return this.muted[channel];
  }

  /** Set mute state for a channel */
  setMute(channel: AudioChannel, mute: boolean): void {
    this.muted[channel] = mute;
    this.applyChannelVolume(channel);
  }

  /** Check if master mute is active */
  isMasterMuted(): boolean {
    return this.masterMuted;
  }

  /** Toggle master mute (affects all channels) */
  toggleMasterMute(): boolean {
    this.masterMuted = !this.masterMuted;
    for (const ch of ALL_CHANNELS) {
      this.applyChannelVolume(ch);
    }
    return this.masterMuted;
  }

  /** Set master mute state */
  setMasterMute(mute: boolean): void {
    this.masterMuted = mute;
    for (const ch of ALL_CHANNELS) {
      this.applyChannelVolume(ch);
    }
  }

  /**
   * Play a sound on a specific channel.
   * Returns the sound instance, or null if audio is locked / sound doesn't exist.
   */
  play(
    channel: AudioChannel,
    key: string,
    config?: Phaser.Types.Sound.SoundConfig,
  ): Phaser.Sound.BaseSound | null {
    if (!this.scene.cache.audio.exists(key)) {
      console.warn(`[AudioMixer] Audio key "${key}" not found in cache`);
      return null;
    }

    const effectiveVolume = this.getEffectiveVolume(channel);
    const sound = this.scene.sound.add(key, {
      ...config,
      volume: (config?.volume ?? 1) * effectiveVolume,
    });

    this.channelSounds[channel].push(sound);

    // Clean up when sound completes
    sound.once("complete", () => {
      this.removeSound(channel, sound);
    });
    sound.once("stop", () => {
      this.removeSound(channel, sound);
    });

    if (!this.scene.sound.locked) {
      (sound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).play();
    }

    return sound;
  }

  /**
   * Play a looping sound on a channel. Returns the sound instance.
   */
  playLoop(
    channel: AudioChannel,
    key: string,
    config?: Phaser.Types.Sound.SoundConfig,
  ): Phaser.Sound.BaseSound | null {
    return this.play(channel, key, { ...config, loop: true });
  }

  /** Stop all sounds on a specific channel */
  stopChannel(channel: AudioChannel): void {
    for (const sound of [...this.channelSounds[channel]]) {
      sound.destroy();
    }
    this.channelSounds[channel] = [];
  }

  /** Stop all sounds on all channels */
  stopAll(): void {
    for (const ch of ALL_CHANNELS) {
      this.stopChannel(ch);
    }
  }

  /** Get all currently active sounds on a channel */
  getChannelSounds(channel: AudioChannel): readonly Phaser.Sound.BaseSound[] {
    return this.channelSounds[channel];
  }

  /** Compute effective volume for a channel considering mute states */
  getEffectiveVolume(channel: AudioChannel): number {
    if (this.masterMuted || this.muted[channel]) return 0;
    return this.volumes[channel];
  }

  /** Clean up — stop all sounds and remove references */
  destroy(): void {
    this.stopAll();
  }

  /** Apply computed volume to all sounds on a channel */
  private applyChannelVolume(channel: AudioChannel): void {
    const effectiveVol = this.getEffectiveVolume(channel);
    for (const sound of this.channelSounds[channel]) {
      if ("setVolume" in sound && typeof sound.setVolume === "function") {
        // Scale relative to the sound's base volume stored in its config
        (sound as any).setVolume(effectiveVol);
      }
    }
  }

  /** Remove a sound from channel tracking */
  private removeSound(channel: AudioChannel, sound: Phaser.Sound.BaseSound): void {
    const idx = this.channelSounds[channel].indexOf(sound);
    if (idx !== -1) {
      this.channelSounds[channel].splice(idx, 1);
    }
  }
}
