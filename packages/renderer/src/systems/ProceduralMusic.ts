/**
 * ProceduralMusic — generates lo-fi background music AudioBuffers per mood.
 *
 * Each track is a short seamless loop (8-12 seconds) using simple synthesis:
 * - Pentatonic melodies with soft sine/triangle waves
 * - Lo-fi characteristics: gentle noise layer, subtle vinyl crackle
 * - Mood-specific: tempo, scale, rhythm vary by mood
 *
 * Per visual-spec S9.3: Lo-fi hip hop, ambient, chiptune aesthetic.
 * Volume: 15-20% (handled by AudioMixer music channel at 0.18).
 */

const SAMPLE_RATE = 44100;

/** Musical note frequencies (octave 3-5) */
const NOTE_FREQS: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
};

/** Pentatonic scales per mood category */
const MOOD_SCALES: Record<string, string[]> = {
  happy: ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"],
  sad: ["A3", "C4", "D4", "E4", "G4", "A4", "C5"],
  curious: ["D4", "E4", "G4", "A4", "B4", "D5", "E5"],
  neutral: ["C4", "E4", "G4", "A4", "C5", "E5"],
};

/** Tempo (BPM) per mood */
const MOOD_TEMPOS: Record<string, number> = {
  happy: 90,
  sad: 60,
  curious: 80,
  neutral: 72,
};

/** Map OverallMood to music mood category */
export const MOOD_TO_MUSIC: Record<string, string> = {
  happy: "happy",
  excited: "happy",
  content: "neutral",
  curious: "curious",
  contemplative: "curious",
  neutral: "neutral",
  bored: "neutral",
  anxious: "sad",
  frustrated: "sad",
};

/** All music track keys */
export const MUSIC_TRACK_KEYS = [
  "music_happy",
  "music_sad",
  "music_curious",
  "music_neutral",
] as const;

export type MusicTrackKey = (typeof MUSIC_TRACK_KEYS)[number];

/** Soft sine wave with gentle attack/release */
function softTone(
  data: Float32Array,
  startSample: number,
  freq: number,
  durationSamples: number,
  amplitude: number,
): void {
  const attackLen = Math.min(Math.floor(durationSamples * 0.15), 2000);
  const releaseLen = Math.min(Math.floor(durationSamples * 0.3), 3000);

  for (let i = 0; i < durationSamples; i++) {
    const idx = startSample + i;
    if (idx >= data.length) break;

    const t = i / SAMPLE_RATE;
    // Sine + slight triangle for warmth
    let wave = Math.sin(2 * Math.PI * freq * t) * 0.7;
    // Add soft overtone
    wave += Math.sin(2 * Math.PI * freq * 2 * t) * 0.15;
    wave += Math.sin(2 * Math.PI * freq * 3 * t) * 0.05;

    // Envelope
    let env = 1;
    if (i < attackLen) env = i / attackLen;
    if (i > durationSamples - releaseLen) env = (durationSamples - i) / releaseLen;

    data[idx] += wave * amplitude * env;
  }
}

/** Add lo-fi vinyl crackle noise layer */
function addVinylCrackle(data: Float32Array, amplitude: number): void {
  for (let i = 0; i < data.length; i++) {
    // Very sparse crackles
    if (Math.random() < 0.0003) {
      const crackleLen = Math.floor(SAMPLE_RATE * 0.002);
      for (let j = 0; j < crackleLen && i + j < data.length; j++) {
        data[i + j] += (Math.random() * 2 - 1) * amplitude * Math.exp(-j / (crackleLen * 0.3));
      }
    }
    // Continuous very quiet hiss
    data[i] += (Math.random() * 2 - 1) * amplitude * 0.05;
  }
}

/** Simple low-pass filter for warmth */
function warmFilter(data: Float32Array, strength: number): void {
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    data[i] = prev + strength * (data[i] - prev);
    prev = data[i];
  }
}

/** Add a gentle bass note */
function addBass(
  data: Float32Array,
  startSample: number,
  freq: number,
  durationSamples: number,
  amplitude: number,
): void {
  const attackLen = Math.floor(durationSamples * 0.05);
  const releaseLen = Math.floor(durationSamples * 0.4);

  for (let i = 0; i < durationSamples; i++) {
    const idx = startSample + i;
    if (idx >= data.length) break;

    const t = i / SAMPLE_RATE;
    const wave = Math.sin(2 * Math.PI * freq * t);

    let env = 1;
    if (i < attackLen) env = i / attackLen;
    if (i > durationSamples - releaseLen) env = (durationSamples - i) / releaseLen;

    data[idx] += wave * amplitude * env;
  }
}

/** Deterministic pseudo-random based on seed for reproducible melodies */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generate a lo-fi music track for a given mood category.
 * Returns a seamless-looping AudioBuffer.
 */
function generateMoodTrack(ctx: AudioContext, mood: string): AudioBuffer {
  const scale = MOOD_SCALES[mood] ?? MOOD_SCALES.neutral;
  const bpm = MOOD_TEMPOS[mood] ?? 72;
  const beatDuration = 60 / bpm; // seconds per beat
  const bars = 8;
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const duration = totalBeats * beatDuration;
  const totalSamples = Math.floor(SAMPLE_RATE * duration);

  const buffer = ctx.createBuffer(1, totalSamples, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  const rand = seededRandom(mood.charCodeAt(0) * 137 + mood.length * 31);

  // Melody: sparse notes on the pentatonic scale
  const beatSamples = Math.floor(SAMPLE_RATE * beatDuration);
  const noteAmplitude = mood === "sad" ? 0.08 : mood === "happy" ? 0.12 : 0.1;

  for (let beat = 0; beat < totalBeats; beat++) {
    const startSample = beat * beatSamples;

    // Melody: ~60% of beats have a note (sparser for sad)
    const noteChance = mood === "sad" ? 0.45 : mood === "curious" ? 0.55 : 0.6;
    if (rand() < noteChance) {
      const noteIdx = Math.floor(rand() * scale.length);
      const noteName = scale[noteIdx];
      const freq = NOTE_FREQS[noteName] ?? 261.63;
      // Note duration: half to full beat
      const noteDur = Math.floor(beatSamples * (0.5 + rand() * 0.5));
      softTone(data, startSample, freq, noteDur, noteAmplitude);
    }

    // Bass: on beats 0 and 2 of each bar
    const beatInBar = beat % beatsPerBar;
    if (beatInBar === 0 || beatInBar === 2) {
      // Bass note: root or fifth of current scale position
      const bassIdx = beatInBar === 0 ? 0 : Math.min(2, scale.length - 1);
      const bassNote = scale[bassIdx];
      const bassFreq = (NOTE_FREQS[bassNote] ?? 130.81) / 2; // one octave down
      addBass(data, startSample, bassFreq, beatSamples * 2, 0.06);
    }

    // Gentle hi-hat on off-beats for happy/curious
    if ((mood === "happy" || mood === "curious") && beatInBar % 2 === 1) {
      const hatLen = Math.floor(SAMPLE_RATE * 0.02);
      for (let i = 0; i < hatLen && startSample + i < totalSamples; i++) {
        const env = Math.exp(-i / (hatLen * 0.2));
        data[startSample + i] += (rand() * 2 - 1) * 0.03 * env;
      }
    }
  }

  // Lo-fi warmth: low-pass filter
  warmFilter(data, mood === "sad" ? 0.3 : 0.5);

  // Add vinyl crackle
  addVinylCrackle(data, 0.015);

  // Smooth loop boundaries
  const fadeLen = Math.min(Math.floor(SAMPLE_RATE * 0.5), Math.floor(totalSamples * 0.05));
  for (let i = 0; i < fadeLen; i++) {
    const t = i / fadeLen;
    data[i] *= t;
    data[totalSamples - 1 - i] *= t;
  }

  return buffer;
}

/** Generate happy lo-fi track */
export function generateMusicHappy(ctx: AudioContext): AudioBuffer {
  return generateMoodTrack(ctx, "happy");
}

/** Generate sad/anxious lo-fi track */
export function generateMusicSad(ctx: AudioContext): AudioBuffer {
  return generateMoodTrack(ctx, "sad");
}

/** Generate curious/contemplative lo-fi track */
export function generateMusicCurious(ctx: AudioContext): AudioBuffer {
  return generateMoodTrack(ctx, "curious");
}

/** Generate neutral/content lo-fi track */
export function generateMusicNeutral(ctx: AudioContext): AudioBuffer {
  return generateMoodTrack(ctx, "neutral");
}

/** Sound key to generator mapping */
const MUSIC_GENERATORS: Record<string, (ctx: AudioContext) => AudioBuffer> = {
  music_happy: generateMusicHappy,
  music_sad: generateMusicSad,
  music_curious: generateMusicCurious,
  music_neutral: generateMusicNeutral,
};

/**
 * Generate all music tracks and register them in the Phaser audio cache.
 * Call during scene create(), after Phaser sound system is initialized.
 */
export function generateAllMusicTracks(scene: Phaser.Scene): void {
  const soundManager = scene.sound as Phaser.Sound.WebAudioSoundManager;
  if (!soundManager || !soundManager.context) {
    console.warn("[ProceduralMusic] WebAudio not available, skipping music generation");
    return;
  }

  const ctx = soundManager.context;

  for (const [key, generator] of Object.entries(MUSIC_GENERATORS)) {
    if (scene.cache.audio.exists(key)) continue;
    try {
      const buffer = generator(ctx);
      scene.cache.audio.add(key, buffer);
    } catch (err) {
      console.warn(`[ProceduralMusic] Failed to generate ${key}:`, err);
    }
  }
}
