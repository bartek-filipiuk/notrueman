import { describe, it, expect } from "vitest";
import {
  StreamerConfigSchema,
  parseStreamerConfigFromEnv,
  buildFfmpegArgs,
  buildChromeArgs,
} from "../streamer-config";

describe("StreamerConfigSchema", () => {
  it("parses valid config with all fields", () => {
    const result = StreamerConfigSchema.parse({
      rtmpUrl: "rtmp://live.twitch.tv/app/live_123",
      streamUrl: "http://localhost:5173",
      resolution: "960x540",
      framerate: 30,
      videoBitrate: "4500k",
      audioBitrate: "160k",
      recycleIntervalS: 14400,
      maxMemoryMb: 2048,
    });
    expect(result.rtmpUrl).toBe("rtmp://live.twitch.tv/app/live_123");
    expect(result.framerate).toBe(30);
  });

  it("applies defaults for optional fields", () => {
    const result = StreamerConfigSchema.parse({
      rtmpUrl: "rtmp://live.twitch.tv/app/key",
    });
    expect(result.resolution).toBe("960x540");
    expect(result.framerate).toBe(30);
    expect(result.videoBitrate).toBe("4500k");
    expect(result.audioBitrate).toBe("160k");
    expect(result.recycleIntervalS).toBe(14400);
    expect(result.maxMemoryMb).toBe(2048);
  });

  it("rejects missing rtmpUrl", () => {
    expect(() => StreamerConfigSchema.parse({})).toThrow();
  });

  it("rejects invalid RTMP URL (not rtmp://)", () => {
    expect(() =>
      StreamerConfigSchema.parse({ rtmpUrl: "http://not-rtmp.com/stream" }),
    ).toThrow("rtmp://");
  });

  it("rejects invalid resolution format", () => {
    expect(() =>
      StreamerConfigSchema.parse({
        rtmpUrl: "rtmp://live.twitch.tv/app/key",
        resolution: "1080p",
      }),
    ).toThrow("WIDTHxHEIGHT");
  });

  it("rejects framerate out of range", () => {
    expect(() =>
      StreamerConfigSchema.parse({
        rtmpUrl: "rtmp://live.twitch.tv/app/key",
        framerate: 120,
      }),
    ).toThrow();
  });

  it("coerces string numbers for framerate", () => {
    const result = StreamerConfigSchema.parse({
      rtmpUrl: "rtmp://live.twitch.tv/app/key",
      framerate: "25",
    });
    expect(result.framerate).toBe(25);
  });
});

describe("parseStreamerConfigFromEnv", () => {
  it("parses from env-like object", () => {
    const config = parseStreamerConfigFromEnv({
      RTMP_URL: "rtmp://live.twitch.tv/app/live_test",
      STREAM_URL: "http://app:5173",
      STREAM_RESOLUTION: "1920x1080",
      STREAM_FRAMERATE: "30",
      STREAM_VIDEO_BITRATE: "6000k",
      STREAM_AUDIO_BITRATE: "192k",
      BROWSER_RECYCLE_INTERVAL: "7200",
      BROWSER_MAX_MEMORY_MB: "3072",
    });
    expect(config.rtmpUrl).toBe("rtmp://live.twitch.tv/app/live_test");
    expect(config.resolution).toBe("1920x1080");
    expect(config.framerate).toBe(30);
    expect(config.videoBitrate).toBe("6000k");
    expect(config.recycleIntervalS).toBe(7200);
    expect(config.maxMemoryMb).toBe(3072);
  });

  it("uses defaults when env vars are missing", () => {
    const config = parseStreamerConfigFromEnv({
      RTMP_URL: "rtmp://live.twitch.tv/app/key",
    });
    expect(config.resolution).toBe("960x540");
    expect(config.framerate).toBe(30);
  });
});

describe("buildFfmpegArgs", () => {
  it("builds correct FFmpeg args", () => {
    const config = StreamerConfigSchema.parse({
      rtmpUrl: "rtmp://live.twitch.tv/app/testkey",
      resolution: "960x540",
      framerate: 30,
      videoBitrate: "4500k",
      audioBitrate: "160k",
    });
    const args = buildFfmpegArgs(config);

    expect(args).toContain("-f");
    expect(args).toContain("x11grab");
    expect(args).toContain("-video_size");
    expect(args).toContain("960x540");
    expect(args).toContain("-framerate");
    expect(args).toContain("30");
    expect(args).toContain("-preset");
    expect(args).toContain("veryfast");
    expect(args).toContain("-tune");
    expect(args).toContain("zerolatency");
    expect(args).toContain("-b:v");
    expect(args).toContain("4500k");
    expect(args).toContain("-bufsize");
    expect(args).toContain("9000k"); // 4500 * 2
    expect(args).toContain("-g");
    expect(args).toContain("60"); // 30 * 2
    // Output: -f flv <rtmp_url>
    expect(args[args.length - 3]).toBe("-f");
    expect(args[args.length - 2]).toBe("flv");
    expect(args[args.length - 1]).toBe("rtmp://live.twitch.tv/app/testkey");
  });

  it("calculates GOP size from framerate", () => {
    const config = StreamerConfigSchema.parse({
      rtmpUrl: "rtmp://live.twitch.tv/app/key",
      framerate: 25,
    });
    const args = buildFfmpegArgs(config);
    const gopIdx = args.indexOf("-g");
    expect(args[gopIdx + 1]).toBe("50"); // 25 * 2
  });
});

describe("buildChromeArgs", () => {
  it("builds correct Chrome launch args", () => {
    const config = StreamerConfigSchema.parse({
      rtmpUrl: "rtmp://live.twitch.tv/app/key",
      streamUrl: "http://localhost:5173/?apiKey=test",
      resolution: "1920x1080",
    });
    const args = buildChromeArgs(config);

    expect(args).toContain("--no-sandbox");
    expect(args).toContain("--disable-dev-shm-usage");
    expect(args).toContain("--autoplay-policy=no-user-gesture-required");
    expect(args).toContain("--window-size=1920,1080");
    expect(args).toContain("--kiosk");
    expect(args[args.length - 1]).toBe("http://localhost:5173/?apiKey=test");
  });

  it("includes security-critical flags", () => {
    const config = StreamerConfigSchema.parse({
      rtmpUrl: "rtmp://live.twitch.tv/app/key",
    });
    const args = buildChromeArgs(config);

    // Must have these for Docker stability
    expect(args).toContain("--disable-background-timer-throttling");
    expect(args).toContain("--disable-backgrounding-occluded-windows");
    expect(args).toContain("--disable-renderer-backgrounding");
  });
});
