/**
 * ProceduralMusic — generates lo-fi background music tracks using Web Audio API.
 *
 * Each track is a short loopable segment (~8-16 seconds) matching a mood category.
 * Style: lo-fi hip hop / ambient / chiptune (matching pixel art aesthetic).
 *
 * Mood categories (per visual-spec S9.3, design-spec):
 * - happy/excited → upbeat lo-fi with bright chords
 * - curious/contemplative → quirky, playful melody
 * - anxious/frustrated → tense, minor key ambient
 * - content/neutral → calm, warm lo-fi
 * - bored → slow, minimal piano
 *
 * Per T8.4: volume 15-20%, crossfade between tracks (2s).
 */

const SAMPLE_RATE = 44100;

/** Simple sine wave oscillator */
function sine(t: number, freq: number): number {
  return Math.sin(2 * Math.PI * freq * t);
}

/** Triangle wave */
function triangle(t: number, freq: number): number {
  const p = (t * freq) % 1;
  return 4 * Math.abs(p - 0.5) - 1;
}

/** Square wave (soft, with duty cycle) */
function softSquare(t: number, freq: number, duty = 0.5): number {
  const p = (t * freq) % 1;
  return p < duty ? 0.6 : -0.6;
}

/** Apply soft low-pass to smooth harsh edges */
function smoothBuffer(data: Float32Array, passes = 2): void {
  for (let p = 0; p < passes; p++) {
    let prev = data[0];
    for (let i = 1; i < data.length; i++) {
      const curr = data[i];
      data[i] = prev * 0.3 + curr * 0.7;
      prev = curr;
    }
  }
}

/** Add a note to the buffer at given time with envelope */
function addNote(
  data: Float32Array,
  startTime: number,
  duration: number,
  freq: number,
  amplitude: number,
  waveform: "sine" | "triangle" | "square" = "sine",
): void {
  const start = Math.floor(startTime * SAMPLE_RATE);
  const len = Math.floor(duration * SAMPLE_RATE);
  const attack = Math.min(Math.floor(0.01 * SAMPLE_RATE), len);
  const release = Math.min(Math.floor(0.05 * SAMPLE_RATE), len);

  for (let i = 0; i < len && start + i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    let env = 1;
    if (i < attack) env = i / attack;
    if (i > len - release) env = (len - i) / release;

    let sample: number;
    switch (waveform) {
      case "triangle":
        sample = triangle(t, freq);
        break;
      case "square":
        sample = softSquare(t, freq);
        break;
      default:
        sample = sine(t, freq);
    }

    data[start + i] += sample * amplitude * env;
  }
}

/** Add a chord (multiple notes) */
function addChord(
  data: Float32Array,
  startTime: number,
  duration: number,
  freqs: number[],
  amplitude: number,
  waveform: "sine" | "triangle" | "square" = "sine",
): void {
  const perNote = amplitude / Math.sqrt(freqs.length);
  for (const freq of freqs) {
    addNote(data, startTime, duration, freq, perNote, waveform);
  }
}

/** Add vinyl crackle noise (lo-fi aesthetic) */
function addVinylCrackle(data: Float32Array, amplitude: number): void {
  for (let i = 0; i < data.length; i++) {
    if (Math.random() < 0.0003) {
      const crackleLen = Math.floor(SAMPLE_RATE * 0.001);
      for (let j = 0; j < crackleLen && i + j < data.length; j++) {
        data[i + j] += (Math.random() * 2 - 1) * amplitude * Math.exp(-j / (crackleLen * 0.3));
      }
    }
  }
}

// Musical note frequencies (C4 = middle C)
const NOTE = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25,
  // Flats/sharps
  Bb3: 233.08, Eb4: 311.13, Ab3: 207.65, Bb4: 466.16, Db4: 277.18,
  Gb3: 185.00, Gb4: 370.00,
};

/**
 * Happy/excited — upbeat lo-fi with bright major chords and bouncy rhythm.
 * Key: C major, tempo ~80 BPM.
 */
export function generateHappyTrack(ctx: AudioContext): AudioBuffer {
  const duration = 12.0;
  const samples = Math.floor(SAMPLE_RATE * duration);
  const buffer = ctx.createBuffer(1, samples, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  const beat = 60 / 80; // ~0.75s per beat

  // Chord progression: Cmaj7 → Am7 → Fmaj7 → G7 (lo-fi classic)
  const chords = [
    [NOTE.C3, NOTE.E4, NOTE.G4, NOTE.B4],   // Cmaj7
    [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.G4],   // Am7
    [NOTE.F3, NOTE.A3, NOTE.C4, NOTE.E4],   // Fmaj7
    [NOTE.G3, NOTE.B3, NOTE.D4, NOTE.F4],   // G7
  ];

  // 4 bars × 4 beats = 16 beats, each chord lasts 4 beats
  for (let bar = 0; bar < 4; bar++) {
    const chord = chords[bar % chords.length];
    const barStart = bar * 4 * beat;

    // Pad chords (warm triangle wave)
    addChord(data, barStart, 4 * beat * 0.95, chord, 0.06, "triangle");

    // Simple bass (root note, octave lower feel)
    addNote(data, barStart, beat * 2, chord[0], 0.08, "sine");
    addNote(data, barStart + beat * 2, beat * 2, chord[0] * 0.75, 0.06, "sine");

    // Melody: simple pentatonic riff on beats 2 and 4
    const melodyNotes = [NOTE.E5, NOTE.G4, NOTE.C5, NOTE.D5];
    addNote(data, barStart + beat, beat * 0.7, melodyNotes[bar % 4], 0.04, "square");
    addNote(data, barStart + beat * 3, beat * 0.5, melodyNotes[(bar + 2) % 4], 0.03, "square");
  }

  addVinylCrackle(data, 0.015);
  smoothBuffer(data, 3);

  return buffer;
}

/**
 * Calm/content — warm, gentle lo-fi with soft pads.
 * Key: F major, tempo ~70 BPM.
 */
export function generateCalmTrack(ctx: AudioContext): AudioBuffer {
  const duration = 14.0;
  const samples = Math.floor(SAMPLE_RATE * duration);
  const buffer = ctx.createBuffer(1, samples, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  const beat = 60 / 70;

  // Fmaj7 → Dm7 → Bbmaj7 → C7
  const chords = [
    [NOTE.F3, NOTE.A3, NOTE.C4, NOTE.E4],
    [NOTE.D3, NOTE.F3, NOTE.A3, NOTE.C4],
    [NOTE.Bb3, NOTE.D4, NOTE.F4, NOTE.A4],
    [NOTE.C3, NOTE.E4, NOTE.G4, NOTE.Bb4],
  ];

  for (let bar = 0; bar < 4; bar++) {
    const chord = chords[bar];
    const barStart = bar * 4 * beat;

    // Very soft pads
    addChord(data, barStart, 4 * beat * 0.98, chord, 0.05, "sine");

    // Gentle bass
    addNote(data, barStart, beat * 3, chord[0], 0.06, "sine");

    // Sparse melody — one note per bar
    const melodyNotes = [NOTE.C5, NOTE.A4, NOTE.F4, NOTE.G4];
    addNote(data, barStart + beat * 1.5, beat * 1.5, melodyNotes[bar], 0.03, "triangle");
  }

  addVinylCrackle(data, 0.01);
  smoothBuffer(data, 4);

  return buffer;
}

/**
 * Curious/contemplative — quirky, playful with chromatic touches.
 * Key: G mixolydian, tempo ~75 BPM.
 */
export function generateCuriousTrack(ctx: AudioContext): AudioBuffer {
  const duration = 12.0;
  const samples = Math.floor(SAMPLE_RATE * duration);
  const buffer = ctx.createBuffer(1, samples, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  const beat = 60 / 75;

  // Gmaj → Em → Cmaj → D
  const chords = [
    [NOTE.G3, NOTE.B3, NOTE.D4],
    [NOTE.E3, NOTE.G3, NOTE.B3],
    [NOTE.C3, NOTE.E3, NOTE.G3],
    [NOTE.D3, NOTE.Gb3, NOTE.A3],
  ];

  for (let bar = 0; bar < 4; bar++) {
    const chord = chords[bar];
    const barStart = bar * 4 * beat;

    addChord(data, barStart, 4 * beat * 0.9, chord, 0.04, "triangle");

    // Quirky melody — arpeggiated, slightly off-beat
    const arpNotes = [NOTE.B4, NOTE.D5, NOTE.G4, NOTE.E5, NOTE.A4, NOTE.C5];
    for (let n = 0; n < 3; n++) {
      const noteTime = barStart + beat * (0.5 + n * 1.2);
      if (noteTime < duration) {
        addNote(data, noteTime, beat * 0.4, arpNotes[(bar * 3 + n) % arpNotes.length], 0.035, "square");
      }
    }

    // Bass
    addNote(data, barStart, beat * 2, chord[0], 0.06, "sine");
  }

  addVinylCrackle(data, 0.012);
  smoothBuffer(data, 3);

  return buffer;
}

/**
 * Tense/anxious — minor key, sparse, slightly dissonant.
 * Key: A minor, tempo ~65 BPM.
 */
export function generateTenseTrack(ctx: AudioContext): AudioBuffer {
  const duration = 14.0;
  const samples = Math.floor(SAMPLE_RATE * duration);
  const buffer = ctx.createBuffer(1, samples, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  const beat = 60 / 65;

  // Am → Dm → Fmaj → E (minor progression)
  const chords = [
    [NOTE.A3, NOTE.C4, NOTE.E4],
    [NOTE.D3, NOTE.F3, NOTE.A3],
    [NOTE.F3, NOTE.A3, NOTE.C4],
    [NOTE.E3, NOTE.Ab3, NOTE.B3],  // E major (with G#)
  ];

  for (let bar = 0; bar < 4; bar++) {
    const chord = chords[bar];
    const barStart = bar * 4 * beat;

    // Sparse pad, slightly longer attack
    addChord(data, barStart + 0.1, 4 * beat * 0.85, chord, 0.04, "sine");

    // Deep bass
    addNote(data, barStart, beat * 4, chord[0] * 0.5, 0.05, "sine");

    // Minimal melody — one or two notes
    if (bar % 2 === 0) {
      addNote(data, barStart + beat * 2, beat, NOTE.E5, 0.025, "triangle");
    }
  }

  // Less crackle for tense mood
  addVinylCrackle(data, 0.008);
  smoothBuffer(data, 5);

  return buffer;
}

/**
 * Bored — slow, minimal, slightly detuned piano feel.
 * Key: D minor, tempo ~60 BPM.
 */
export function generateBoredTrack(ctx: AudioContext): AudioBuffer {
  const duration = 16.0;
  const samples = Math.floor(SAMPLE_RATE * duration);
  const buffer = ctx.createBuffer(1, samples, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  const beat = 60 / 60; // 1s per beat

  // Very sparse: just a few notes with long silences
  const notes = [
    { time: 0, freq: NOTE.D4, dur: 2.0 },
    { time: 2.5, freq: NOTE.F4, dur: 1.5 },
    { time: 5.0, freq: NOTE.A3, dur: 2.5 },
    { time: 8.0, freq: NOTE.C4, dur: 2.0 },
    { time: 11.0, freq: NOTE.D4, dur: 1.5 },
    { time: 13.0, freq: NOTE.E4, dur: 2.0 },
  ];

  for (const n of notes) {
    // Slightly detuned for that sad lo-fi feel
    addNote(data, n.time, n.dur, n.freq, 0.05, "triangle");
    addNote(data, n.time, n.dur, n.freq * 1.003, 0.02, "sine"); // subtle detune
  }

  // Very quiet bass drone
  addNote(data, 0, duration, NOTE.D3 * 0.5, 0.02, "sine");

  addVinylCrackle(data, 0.008);
  smoothBuffer(data, 4);

  return buffer;
}

/** Mood category to track key mapping */
export type MusicMood = "happy" | "calm" | "curious" | "tense" | "bored";

/** Map overall moods to music mood categories */
export function moodToMusicMood(mood: string): MusicMood {
  switch (mood) {
    case "happy":
    case "excited":
      return "happy";
    case "curious":
    case "contemplative":
      return "curious";
    case "anxious":
    case "frustrated":
      return "tense";
    case "bored":
      return "bored";
    case "content":
    case "neutral":
    default:
      return "calm";
  }
}

/** Track key prefix for each music mood */
export const MUSIC_TRACK_KEYS: Record<MusicMood, string> = {
  happy: "music_happy",
  calm: "music_calm",
  curious: "music_curious",
  tense: "music_tense",
  bored: "music_bored",
};

/** Generator function for each music mood */
const MUSIC_GENERATORS: Record<MusicMood, (ctx: AudioContext) => AudioBuffer> = {
  happy: generateHappyTrack,
  calm: generateCalmTrack,
  curious: generateCuriousTrack,
  tense: generateTenseTrack,
  bored: generateBoredTrack,
};

/**
 * Generate all background music tracks and register in Phaser audio cache.
 * Call during scene create(), after Phaser sound system is initialized.
 */
export function generateAllMusicTracks(scene: Phaser.Scene): void {
  const soundManager = scene.sound as Phaser.Sound.WebAudioSoundManager;
  if (!soundManager || !soundManager.context) {
    console.warn("[ProceduralMusic] WebAudio not available, skipping music generation");
    return;
  }

  const ctx = soundManager.context;

  for (const [mood, key] of Object.entries(MUSIC_TRACK_KEYS)) {
    if (scene.cache.audio.exists(key)) continue;
    try {
      const buffer = MUSIC_GENERATORS[mood as MusicMood](ctx);
      scene.cache.audio.add(key, buffer);
    } catch (err) {
      console.warn(`[ProceduralMusic] Failed to generate ${key}:`, err);
    }
  }
}
