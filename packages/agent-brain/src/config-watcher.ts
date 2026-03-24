import { watch, type FSWatcher } from "fs";
import { loadConfig, type TrumanConfig } from "./config.js";

export interface ConfigWatcherOptions {
  onChange?: (config: TrumanConfig) => void;
  onError?: (error: Error) => void;
}

/**
 * Config hot-reload watcher (T4.8).
 * Watches truman-config.json for changes and reloads without restart.
 * Invalid configs are rejected — old valid config is kept.
 */
export class ConfigWatcher {
  private configPath: string;
  private config: TrumanConfig;
  private watcher: FSWatcher | null = null;
  private onChange?: (config: TrumanConfig) => void;
  private onError?: (error: Error) => void;

  constructor(configPath: string, options?: ConfigWatcherOptions) {
    this.configPath = configPath;
    this.onChange = options?.onChange;
    this.onError = options?.onError;
    this.config = loadConfig(configPath);
  }

  /** Get current config */
  getConfig(): TrumanConfig {
    return this.config;
  }

  /** Start watching the config file for changes */
  start(): void {
    if (this.watcher) return;

    this.watcher = watch(this.configPath, (eventType) => {
      if (eventType === "change") {
        this.reload();
      }
    });
  }

  /** Stop watching */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /** Manually reload config from disk */
  reload(): void {
    try {
      const newConfig = loadConfig(this.configPath);
      this.config = newConfig;
      this.onChange?.(newConfig);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.onError?.(err);
      // Keep old valid config
    }
  }
}
