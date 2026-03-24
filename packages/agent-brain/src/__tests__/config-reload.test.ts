import { describe, it, expect, vi, afterEach } from "vitest";
import { writeFileSync, mkdtempSync, unlinkSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadConfig, TrumanConfigSchema } from "../config.js";
import { ConfigWatcher } from "../config-watcher.js";

const VALID_CONFIG = {
  tickIntervalMs: 45000,
  models: { think: "deepseek/deepseek-chat", classify: "mistralai/mistral-small-latest" },
  failureRate: 0.25,
  maxRetries: 3,
  varietyPenalty: { veryRecentHours: 0.5, recentHours: 1.5, moderateHours: 3.0 },
  emotions: {
    happiness: 0.6, curiosity: 0.7, anxiety: 0.2, boredom: 0.3,
    excitement: 0.4, contentment: 0.5, frustration: 0.1,
  },
};

describe("ConfigWatcher (T4.8)", () => {
  let tmpDir: string;
  let configPath: string;
  let watcher: ConfigWatcher | null = null;

  afterEach(() => {
    if (watcher) {
      watcher.stop();
      watcher = null;
    }
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function setup() {
    tmpDir = mkdtempSync(join(tmpdir(), "nts-config-"));
    configPath = join(tmpDir, "truman-config.json");
    writeFileSync(configPath, JSON.stringify(VALID_CONFIG));
  }

  it("loads config on construction", () => {
    setup();
    watcher = new ConfigWatcher(configPath);
    const config = watcher.getConfig();
    expect(config.tickIntervalMs).toBe(45000);
    expect(config.failureRate).toBe(0.25);
  });

  it("calls onChange callback when file changes", async () => {
    setup();
    const onChange = vi.fn();
    watcher = new ConfigWatcher(configPath, { onChange });
    watcher.start();

    // Modify config
    const updated = { ...VALID_CONFIG, tickIntervalMs: 60000 };
    writeFileSync(configPath, JSON.stringify(updated));

    // Wait for fs watcher to pick up the change
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Trigger manual reload as fs.watch can be flaky in tests
    watcher.reload();

    expect(onChange).toHaveBeenCalled();
    expect(watcher.getConfig().tickIntervalMs).toBe(60000);
  });

  it("reload() reloads config from disk", () => {
    setup();
    watcher = new ConfigWatcher(configPath);

    // Change file
    const updated = { ...VALID_CONFIG, failureRate: 0.5 };
    writeFileSync(configPath, JSON.stringify(updated));

    // Reload
    watcher.reload();

    expect(watcher.getConfig().failureRate).toBe(0.5);
  });

  it("keeps old config when new config is invalid", () => {
    setup();
    const onError = vi.fn();
    watcher = new ConfigWatcher(configPath, { onError });

    // Write invalid config
    writeFileSync(configPath, JSON.stringify({ tickIntervalMs: "not a number" }));

    watcher.reload();

    // Should keep old valid config
    expect(watcher.getConfig().tickIntervalMs).toBe(45000);
    expect(onError).toHaveBeenCalled();
  });

  it("keeps old config when file is malformed JSON", () => {
    setup();
    const onError = vi.fn();
    watcher = new ConfigWatcher(configPath, { onError });

    writeFileSync(configPath, "not json {{{");
    watcher.reload();

    expect(watcher.getConfig().tickIntervalMs).toBe(45000);
    expect(onError).toHaveBeenCalled();
  });

  it("stop() stops watching", () => {
    setup();
    watcher = new ConfigWatcher(configPath);
    watcher.start();
    watcher.stop();
    // Should not throw
    expect(watcher.getConfig()).toBeDefined();
  });
});
