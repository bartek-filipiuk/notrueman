/**
 * TTSClient — calls OpenAI gpt-4o-mini-tts API to generate speech audio.
 *
 * Returns raw PCM/mp3 ArrayBuffer for playback via Web Audio API.
 * Browser-only (fetch API). No Node.js dependencies.
 */

/** Available TTS voices (OpenAI gpt-4o-mini-tts) */
export const TTS_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"] as const;
export type TTSVoice = (typeof TTS_VOICES)[number];

/** Default voice for Truman */
export const DEFAULT_VOICE: TTSVoice = "echo";

/** Mood-to-instruction mapping for emotional TTS direction */
const MOOD_INSTRUCTIONS: Record<string, string> = {
  happy: "Speak with warmth and a gentle smile in your voice. Upbeat but not over the top.",
  curious: "Speak with wonder and interest, slightly questioning tone. Thoughtful pauses.",
  anxious: "Speak with slight hesitation, a bit breathless. Uncertain but trying to stay calm.",
  excited: "Speak with enthusiasm and energy. Quick pace, bright tone.",
  frustrated: "Speak with mild irritation, sighing. Not angry, just mildly annoyed.",
  content: "Speak with calm satisfaction. Relaxed, peaceful, unhurried.",
  contemplative: "Speak slowly and thoughtfully. Reflective, almost philosophical tone.",
  bored: "Speak with low energy, slightly monotone. Dragging words a bit.",
  neutral: "Speak naturally, conversational tone. Neither too high nor too low energy.",
};

export interface TTSClientConfig {
  apiKey: string;
  voice?: TTSVoice;
  model?: string;
}

/**
 * Generates speech audio from text using OpenAI TTS API.
 *
 * @param text - Text to speak
 * @param mood - Current mood for emotional direction
 * @param config - API key, voice, model
 * @returns ArrayBuffer of mp3 audio data
 */
export async function generateSpeech(
  text: string,
  mood: string,
  config: TTSClientConfig,
): Promise<ArrayBuffer> {
  const voice = config.voice ?? DEFAULT_VOICE;
  const model = config.model ?? "gpt-4o-mini-tts";
  const instructions = MOOD_INSTRUCTIONS[mood] ?? MOOD_INSTRUCTIONS["neutral"];

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      instructions,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`TTS API error ${response.status}: ${errorText}`);
  }

  return response.arrayBuffer();
}

/** Validate that a string is a known TTS voice */
export function isValidVoice(voice: string): voice is TTSVoice {
  return TTS_VOICES.includes(voice as TTSVoice);
}
