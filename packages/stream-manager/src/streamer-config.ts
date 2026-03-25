import { z } from "zod";

/**
 * Streamer configuration schema — validates env vars for the streaming pipeline.
 * Used by the Docker container entrypoint and the stream-manager orchestrator.
 */
export const StreamerConfigSchema = z.object({
  /** RTMP ingest URL (e.g., rtmp://live.twitch.tv/app/STREAM_KEY) */
  rtmpUrl: z.string().min(1, "RTMP_URL is required").startsWith("rtmp://"),
  /** URL of the Phaser renderer to capture */
  streamUrl: z
    .string()
    .url()
    .default("http://localhost:5173"),
  /** Capture resolution (WIDTHxHEIGHT) */
  resolution: z
    .string()
    .regex(/^\d+x\d+$/, "Resolution must be WIDTHxHEIGHT (e.g., 960x540)")
    .default("960x540"),
  /** Capture framerate */
  framerate: z.coerce.number().int().min(1).max(60).default(30),
  /** Video bitrate (e.g., "4500k") */
  videoBitrate: z
    .string()
    .regex(/^\d+k$/, "Video bitrate must be like '4500k'")
    .default("4500k"),
  /** Audio bitrate (e.g., "160k") */
  audioBitrate: z
    .string()
    .regex(/^\d+k$/, "Audio bitrate must be like '160k'")
    .default("160k"),
  /** Chromium recycle interval in seconds */
  recycleIntervalS: z.coerce.number().int().min(300).max(86400).default(14400),
  /** Max Chromium memory in MB before forced recycle */
  maxMemoryMb: z.coerce.number().int().min(512).max(8192).default(2048),
});

export type StreamerConfig = z.infer<typeof StreamerConfigSchema>;

/** Parse streamer config from environment variables */
export function parseStreamerConfigFromEnv(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): StreamerConfig {
  return StreamerConfigSchema.parse({
    rtmpUrl: env.RTMP_URL,
    streamUrl: env.STREAM_URL,
    resolution: env.STREAM_RESOLUTION,
    framerate: env.STREAM_FRAMERATE,
    videoBitrate: env.STREAM_VIDEO_BITRATE,
    audioBitrate: env.STREAM_AUDIO_BITRATE,
    recycleIntervalS: env.BROWSER_RECYCLE_INTERVAL,
    maxMemoryMb: env.BROWSER_MAX_MEMORY_MB,
  });
}

/** Build the FFmpeg command args from config */
export function buildFfmpegArgs(config: StreamerConfig): string[] {
  const [width, height] = config.resolution.split("x");
  const bitrateNum = parseInt(config.videoBitrate, 10);
  const gopSize = config.framerate * 2;

  return [
    "-hide_banner",
    "-loglevel", "warning",
    // Video input: X11 framebuffer
    "-f", "x11grab",
    "-video_size", config.resolution,
    "-framerate", String(config.framerate),
    "-i", ":99",
    // Audio input: PulseAudio virtual sink
    "-f", "pulse",
    "-i", "default",
    // Video encoding
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-b:v", config.videoBitrate,
    "-maxrate", config.videoBitrate,
    "-bufsize", `${bitrateNum * 2}k`,
    "-g", String(gopSize),
    "-sc_threshold", "0",
    "-pix_fmt", "yuv420p",
    // Audio encoding
    "-c:a", "aac",
    "-b:a", config.audioBitrate,
    "-ar", "44100",
    // Output
    "-f", "flv",
    config.rtmpUrl,
  ];
}

/** Build Chromium launch args from config */
export function buildChromeArgs(config: StreamerConfig): string[] {
  const [width, height] = config.resolution.split("x");
  return [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-extensions",
    "--disable-component-update",
    "--disable-translate",
    "--no-first-run",
    "--autoplay-policy=no-user-gesture-required",
    `--window-size=${width},${height}`,
    "--window-position=0,0",
    "--kiosk",
    config.streamUrl,
  ];
}
