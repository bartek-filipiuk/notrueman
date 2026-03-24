/**
 * TTSManager — orchestrates TTS generation and playback.
 *
 * Queues speech requests (max 1 at a time). Plays audio via Web Audio API
 * on the AudioMixer "voice" channel. Configurable on/off, voice selection.
 *
 * Architecture:
 * 1. Speech text arrives (from RendererBridge show_bubble with type "speech")
 * 2. TTSClient generates mp3 ArrayBuffer from OpenAI API
 * 3. Web Audio API decodes and plays through AudioMixer voice channel
 * 4. Queue ensures only one utterance plays at a time
 */

import { generateSpeech, isValidVoice, DEFAULT_VOICE } from "./TTSClient";
import type { TTSVoice, TTSClientConfig } from "./TTSClient";
import type { AudioMixer } from "./AudioMixer";

export interface TTSConfig {
  enabled: boolean;
  voice: TTSVoice;
  apiKey: string;
}

interface QueuedUtterance {
  text: string;
  mood: string;
}

/**
 * Manages TTS generation, queueing, and playback.
 */
export class TTSManager {
  private config: TTSConfig;
  private audioMixer: AudioMixer | null = null;
  private audioContext: AudioContext | null = null;
  private isPlaying = false;
  private queue: QueuedUtterance[] = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;

  /** Callback fired when speech starts playing */
  onSpeechStart: (() => void) | null = null;
  /** Callback fired when speech finishes playing */
  onSpeechEnd: (() => void) | null = null;

  constructor(config: Partial<TTSConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      voice: config.voice ?? DEFAULT_VOICE,
      apiKey: config.apiKey ?? "",
    };
  }

  /** Connect to AudioMixer for volume/mute control */
  setAudioMixer(mixer: AudioMixer): void {
    this.audioMixer = mixer;
  }

  /** Update TTS config dynamically */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.stopCurrent();
      this.queue = [];
    }
  }

  /** Update voice */
  setVoice(voice: string): void {
    if (isValidVoice(voice)) {
      this.config.voice = voice;
    }
  }

  /** Update API key */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  /** Whether TTS is currently enabled and configured */
  isEnabled(): boolean {
    return this.config.enabled && this.config.apiKey.length > 0;
  }

  /** Whether an utterance is currently playing */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /** Current voice setting */
  getVoice(): TTSVoice {
    return this.config.voice;
  }

  /** Queue size */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Speak text aloud. Queues if another utterance is playing.
   * Only generates audio if TTS is enabled and API key is set.
   */
  async speak(text: string, mood: string): Promise<void> {
    if (!this.isEnabled()) return;
    if (!text || text.trim().length === 0) return;

    if (this.isPlaying) {
      // Replace queue — only latest utterance matters (max 1 queued)
      this.queue = [{ text, mood }];
      return;
    }

    await this.playUtterance(text, mood);
  }

  /** Stop current playback and clear queue */
  stopCurrent(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Already stopped
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
    this.queue = [];
  }

  /** Clean up resources */
  destroy(): void {
    this.stopCurrent();
    if (this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close();
    }
    this.audioContext = null;
    this.gainNode = null;
  }

  /** Play a single utterance — generate audio and play */
  private async playUtterance(text: string, mood: string): Promise<void> {
    this.isPlaying = true;
    this.onSpeechStart?.();

    try {
      // 1. Generate speech audio
      const clientConfig: TTSClientConfig = {
        apiKey: this.config.apiKey,
        voice: this.config.voice,
      };

      const audioData = await generateSpeech(text, mood, clientConfig);

      // 2. Decode and play via Web Audio API
      await this.playAudioBuffer(audioData);
    } catch (error) {
      console.warn("[TTS] Speech generation failed:", error);
      this.isPlaying = false;
      this.onSpeechEnd?.();
      // Process queue even on error
      this.processQueue();
    }
  }

  /** Decode mp3 ArrayBuffer and play through Web Audio API */
  private async playAudioBuffer(data: ArrayBuffer): Promise<void> {
    // Lazy-init AudioContext (must happen after user interaction)
    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new AudioContext();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }

    // Resume if suspended (autoplay policy)
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    // Apply volume from AudioMixer voice channel
    if (this.gainNode && this.audioMixer) {
      this.gainNode.gain.value = this.audioMixer.getEffectiveVolume("voice");
    }

    const audioBuffer = await this.audioContext.decodeAudioData(data);
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode!);

    this.currentSource = source;

    return new Promise<void>((resolve) => {
      source.onended = () => {
        this.currentSource = null;
        this.isPlaying = false;
        this.onSpeechEnd?.();
        resolve();
        // Process next in queue
        this.processQueue();
      };

      source.start(0);
    });
  }

  /** Process next utterance in queue */
  private processQueue(): void {
    if (this.queue.length === 0) return;
    if (this.isPlaying) return;

    const next = this.queue.shift()!;
    void this.playUtterance(next.text, next.mood);
  }
}

/**
 * Read TTS config from URL params.
 * - ?tts=on — enable TTS
 * - ?voice=nova — select voice
 * - ?openaiKey=sk-... — OpenAI API key (separate from OpenRouter key)
 */
export function getTTSConfigFromURL(): Partial<TTSConfig> {
  const params = new URLSearchParams(window.location.search);
  const config: Partial<TTSConfig> = {};

  const tts = params.get("tts");
  if (tts === "on") config.enabled = true;
  else if (tts === "off") config.enabled = false;

  const voice = params.get("voice");
  if (voice && isValidVoice(voice)) config.voice = voice as TTSVoice;

  const apiKey = params.get("openaiKey");
  if (apiKey) config.apiKey = apiKey;

  return config;
}
