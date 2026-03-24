/**
 * ProceduralAudio — generates ambient sound AudioBuffers using Web Audio API.
 *
 * Each function creates a short audio loop that can be registered with
 * Phaser's audio cache and played via AudioMixer.
 *
 * All sounds are designed to loop seamlessly.
 */

const SAMPLE_RATE = 44100;

/** Fill a buffer with white noise */
function fillNoise(data: Float32Array, amplitude: number): void {
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * amplitude;
  }
}

/** Apply a simple low-pass filter to a buffer (moving average) */
function lowPass(data: Float32Array, windowSize: number): void {
  const copy = new Float32Array(data);
  for (let i = windowSize; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += copy[i - j];
    }
    data[i] = sum / windowSize;
  }
}

/** Apply an amplitude envelope: attack-sustain-release */
function applyEnvelope(
  data: Float32Array,
  attackSamples: number,
  releaseSamples: number,
): void {
  const len = data.length;
  // Attack
  for (let i = 0; i < Math.min(attackSamples, len); i++) {
    data[i] *= i / attackSamples;
  }
  // Release
  for (let i = 0; i < Math.min(releaseSamples, len); i++) {
    const idx = len - 1 - i;
    if (idx >= 0) data[idx] *= i / releaseSamples;
  }
}

/**
 * Clock tick — short mechanical click, repeating every ~1 second.
 * Duration: 2 seconds (2 ticks).
 */
export function generateClockTick(ctx: AudioContext): AudioBuffer {
  const duration = 2.0;
  const samples = Math.floor(SAMPLE_RATE * duration);
  const buffer = ctx.createBuffer(1, samples, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  // Two ticks: at 0s and 1s
  for (let tick = 0; tick < 2; tick++) {
    const start = Math.floor(tick * SAMPLE_RATE);
    const tickLen = Math.floor(SAMPLE_RATE * 0.008); // 8ms click

    for (let i = 0; i < tickLen && start + i < samples; i++) {
      // Sharp high-freq impulse with quick decay
      const t = i / SAMPLE_RATE;
      const env = Math.exp(-t * 800);
      data[start + i] = env * Math.sin(2 * Math.PI * 3200 * t) * 0.3;
      // Add a lower "tock" component
      data[start + i] += env * Math.sin(2 * Math.PI * 800 * t) * 0.15;
    }
  }

  return buffer;
}

/**
 * Keyboard typing — rapid random key clicks.
 * Duration: 3 seconds of typing sounds.
 */
export function generateTyping(ctx: AudioContext): AudioBuffer {
  const duration = 3.0;
  const samples = Math.floor(SAMPLE_RATE * duration);
  const buffer = ctx.createBuffer(1, samples, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  // ~8 keystrokes per second, slightly randomized
  const avgInterval = SAMPLE_RATE / 8;
  let pos = Math.floor(Math.random() * 200);

  while (pos < samples) {
    const clickLen = Math.floor(SAMPLE_RATE * 0.006); // 6ms per click
    const freq = 1800 + Math.random() * 2400; // varied pitch per key

    for (let i = 0; i < clickLen && pos + i < samples; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.exp(-t * 1200);
      data[pos + i] += env * (Math.random() * 2 - 1) * 0.15;
      data[pos + i] += env * Math.sin(2 * Math.PI * freq * t) * 0.08;
    }

    // Random interval between keys (human-like rhythm)
    pos += Math.floor(avgInterval * (0.5 + Math.random()));
  }

  // Smooth loop boundary
  applyEnvelope(data, 200, 200);

  return buffer;
}

/**
 * Cooking sizzle — continuous frying sound (filtered noise).
 * Duration: 4 seconds.
 */
export function generateSizzle(ctx: AudioContext): AudioBuffer {
  const duration = 4.0;
  const samples = Math.floor(SAMPLE_RATE * duration);
  const buffer = ctx.createBuffer(1, samples, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  // White noise base
  fillNoise(data, 0.25);

  // Bandpass-like filter: low pass + slight amplitude modulation
  lowPass(data, 3);

  // Crackle: random louder pops
  for (let i = 0; i < samples; i++) {
    if (Math.random() < 0.002) {
      const popLen = Math.floor(SAMPLE_RATE * 0.003);
      for (let j = 0; j < popLen && i + j < samples; j++) {
        data[i + j] += (Math.random() * 2 - 1) * 0.3 * Math.exp(-j / (popLen * 0.3));
      }
    }
  }

  // Amplitude modulation for "bubbling" effect
  for (let i = 0; i < samples; i++) {
    const t = i / SAMPLE_RATE;
    const mod = 0.7 + 0.3 * Math.sin(2 * Math.PI * 3.5 * t + Math.sin(2 * Math.PI * 1.2 * t));
    data[i] *= mod;
  }

  applyEnvelope(data, 500, 500);

  return buffer;
}

/**
 * Page turning — swooshy paper sound.
 * Duration: 4 seconds (with 2 page turns).
 */
export function generatePageTurn(ctx: AudioContext): AudioBuffer {
  const duration = 4.0;
  const samples = Math.floor(SAMPLE_RATE * duration);
  const buffer = ctx.createBuffer(1, samples, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  // Two page turns at ~1s and ~3s
  for (let turn = 0; turn < 2; turn++) {
    const start = Math.floor((1.0 + turn * 2.0) * SAMPLE_RATE);
    const turnLen = Math.floor(SAMPLE_RATE * 0.25); // 250ms swoosh

    for (let i = 0; i < turnLen && start + i < samples; i++) {
      const t = i / turnLen;
      // Bell-shaped envelope
      const env = Math.sin(Math.PI * t) * 0.2;
      // High-freq noise filtered
      const noise = (Math.random() * 2 - 1);
      data[start + i] = noise * env;
    }
  }

  // Gentle high-pass to make it papery
  for (let i = 1; i < samples; i++) {
    data[i] = data[i] - data[i - 1] * 0.3;
  }

  return buffer;
}

/**
 * Exercise breathing — rhythmic inhale/exhale.
 * Duration: 4 seconds (2 breath cycles).
 */
export function generateBreathing(ctx: AudioContext): AudioBuffer {
  const duration = 4.0;
  const samples = Math.floor(SAMPLE_RATE * duration);
  const buffer = ctx.createBuffer(1, samples, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  // Low-freq noise shaped as breath
  fillNoise(data, 0.15);
  lowPass(data, 8); // heavy low-pass for breathy sound

  // Breath rhythm: inhale 0.8s, pause 0.2s, exhale 1.0s, pause 0.2s (×2)
  for (let i = 0; i < samples; i++) {
    const t = (i / SAMPLE_RATE) % 2.0; // 2s per breath cycle
    let env = 0;
    if (t < 0.8) {
      // Inhale: rising
      env = Math.sin((t / 0.8) * Math.PI * 0.5);
    } else if (t < 1.0) {
      // Hold
      env = 0.05;
    } else if (t < 2.0) {
      // Exhale: falling, slightly longer and louder
      const et = (t - 1.0) / 1.0;
      env = Math.cos(et * Math.PI * 0.5) * 1.1;
    }
    data[i] *= env;
  }

  return buffer;
}

/**
 * Pencil scratching — quick scratchy strokes.
 * Duration: 3 seconds.
 */
export function generatePencilScratch(ctx: AudioContext): AudioBuffer {
  const duration = 3.0;
  const samples = Math.floor(SAMPLE_RATE * duration);
  const buffer = ctx.createBuffer(1, samples, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  // Series of scratch strokes
  let pos = Math.floor(Math.random() * 500);
  const strokeInterval = SAMPLE_RATE * 0.4; // ~2.5 strokes/sec

  while (pos < samples) {
    const strokeLen = Math.floor(SAMPLE_RATE * (0.1 + Math.random() * 0.15));

    for (let i = 0; i < strokeLen && pos + i < samples; i++) {
      const t = i / strokeLen;
      // Bell envelope
      const env = Math.sin(Math.PI * t) * 0.12;
      // High-freq noise (scratchy)
      data[pos + i] += (Math.random() * 2 - 1) * env;
    }

    pos += Math.floor(strokeInterval * (0.7 + Math.random() * 0.6));
  }

  // High-pass for scratchiness
  for (let i = 1; i < samples; i++) {
    data[i] = data[i] - data[i - 1] * 0.5;
  }

  applyEnvelope(data, 300, 300);

  return buffer;
}

/**
 * Night crickets — chirping high-frequency tones.
 * Duration: 4 seconds.
 */
export function generateCrickets(ctx: AudioContext): AudioBuffer {
  const duration = 4.0;
  const samples = Math.floor(SAMPLE_RATE * duration);
  const buffer = ctx.createBuffer(1, samples, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  // Multiple cricket chirps at different frequencies
  const chirps = [
    { freq: 4200, interval: 0.6, phase: 0 },
    { freq: 4800, interval: 0.85, phase: 0.3 },
    { freq: 3900, interval: 1.1, phase: 0.15 },
  ];

  for (const chirp of chirps) {
    let t = chirp.phase;
    while (t < duration) {
      const start = Math.floor(t * SAMPLE_RATE);
      const chirpLen = Math.floor(SAMPLE_RATE * 0.06); // 60ms chirp

      for (let i = 0; i < chirpLen && start + i < samples; i++) {
        const s = i / SAMPLE_RATE;
        const env = Math.sin((i / chirpLen) * Math.PI) * 0.08;
        data[start + i] += env * Math.sin(2 * Math.PI * chirp.freq * s);
      }

      t += chirp.interval * (0.8 + Math.random() * 0.4);
    }
  }

  applyEnvelope(data, 400, 400);

  return buffer;
}

/** Sound key to generator function mapping */
const GENERATORS: Record<string, (ctx: AudioContext) => AudioBuffer> = {
  ambient_clock: generateClockTick,
  ambient_typing: generateTyping,
  ambient_sizzle: generateSizzle,
  ambient_page_turn: generatePageTurn,
  ambient_breathing: generateBreathing,
  ambient_pencil: generatePencilScratch,
  ambient_crickets: generateCrickets,
};

/**
 * Generate all ambient sounds and register them in the Phaser audio cache.
 * Call this during scene create(), after Phaser sound system is initialized.
 */
export function generateAllAmbientSounds(scene: Phaser.Scene): void {
  const soundManager = scene.sound as Phaser.Sound.WebAudioSoundManager;
  if (!soundManager || !soundManager.context) {
    console.warn("[ProceduralAudio] WebAudio not available, skipping ambient sound generation");
    return;
  }

  const ctx = soundManager.context;

  for (const [key, generator] of Object.entries(GENERATORS)) {
    if (scene.cache.audio.exists(key)) continue; // already generated
    try {
      const buffer = generator(ctx);
      scene.cache.audio.add(key, buffer);
    } catch (err) {
      console.warn(`[ProceduralAudio] Failed to generate ${key}:`, err);
    }
  }
}
