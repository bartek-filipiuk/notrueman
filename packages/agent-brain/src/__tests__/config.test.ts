import { describe, it, expect } from "vitest";
import { loadConfig, TrumanConfigSchema } from "../config.js";
import { resolve } from "path";

describe("config system (T2.9)", () => {
  const configPath = resolve(__dirname, "../../../../config/truman-config.json");

  it("loads and validates truman-config.json", () => {
    const config = loadConfig(configPath);
    expect(config.tickIntervalMs).toBe(45000);
    expect(config.models.think).toBe("deepseek/deepseek-chat");
    expect(config.models.classify).toBe("mistralai/mistral-small-latest");
  });

  it("config has valid failure rate (0-1)", () => {
    const config = loadConfig(configPath);
    expect(config.failureRate).toBeGreaterThanOrEqual(0);
    expect(config.failureRate).toBeLessThanOrEqual(1);
    expect(config.failureRate).toBe(0.25);
  });

  it("config has valid emotion defaults", () => {
    const config = loadConfig(configPath);
    expect(config.emotions.happiness).toBe(0.6);
    expect(config.emotions.curiosity).toBe(0.7);
    expect(config.emotions.frustration).toBe(0.1);
    for (const [, value] of Object.entries(config.emotions)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("config has valid variety penalty thresholds", () => {
    const config = loadConfig(configPath);
    expect(config.varietyPenalty.veryRecentHours).toBeLessThan(config.varietyPenalty.recentHours);
    expect(config.varietyPenalty.recentHours).toBeLessThan(config.varietyPenalty.moderateHours);
  });

  it("rejects invalid config", () => {
    expect(() =>
      TrumanConfigSchema.parse({
        tickIntervalMs: 5, // too low
        models: { think: "", classify: "" },
        failureRate: 2, // > 1
        maxRetries: 0,
        varietyPenalty: { veryRecentHours: 0, recentHours: 0, moderateHours: 0 },
        emotions: { happiness: 0, curiosity: 0, anxiety: 0, boredom: 0, excitement: 0, contentment: 0, frustration: 0 },
      }),
    ).toThrow();
  });

  it("throws on missing file", () => {
    expect(() => loadConfig("/nonexistent/config.json")).toThrow();
  });

  it("config has maxRetries setting", () => {
    const config = loadConfig(configPath);
    expect(config.maxRetries).toBe(3);
  });
});
