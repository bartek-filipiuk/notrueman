import { SaveDataSchema, SAVE_DATA_VERSION } from "@nts/shared";
import type { SaveData } from "@nts/shared";

const STORAGE_KEY = "nts_save_data";
const HEALTH_TIMEOUT_MS = 2000;

export interface SaveManagerConfig {
  backendUrl: string;
}

/**
 * SaveManager — dual persistence: REST API (primary) + localStorage (fallback).
 * Auto-detects backend availability on init.
 */
export class SaveManager {
  private backendUrl: string;
  private backendAvailable = false;

  constructor(config: SaveManagerConfig = { backendUrl: "http://localhost:3001" }) {
    this.backendUrl = config.backendUrl;
  }

  /** Probe backend health endpoint; set backendAvailable flag */
  async init(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      const res = await fetch(`${this.backendUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      this.backendAvailable = res.ok;
    } catch {
      this.backendAvailable = false;
    }
  }

  /** Save state — POST to backend, fallback to localStorage */
  async save(data: SaveData): Promise<void> {
    // Validate before saving
    const parsed = SaveDataSchema.safeParse(data);
    if (!parsed.success) {
      console.warn("[SaveManager] Invalid save data, skipping save:", parsed.error.issues);
      return;
    }

    // Always save to localStorage as backup
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.data));
    } catch (e) {
      console.warn("[SaveManager] localStorage save failed:", e);
    }

    // Try backend
    if (this.backendAvailable) {
      try {
        const res = await fetch(`${this.backendUrl}/state/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: "truman", state: parsed.data }),
        });
        if (!res.ok) {
          console.warn("[SaveManager] Backend save failed:", res.status);
        }
      } catch (e) {
        console.warn("[SaveManager] Backend save error:", e);
        this.backendAvailable = false;
      }
    }
  }

  /** Save via sendBeacon (for pagehide/unload — fire-and-forget) */
  saveBeacon(data: SaveData): void {
    const parsed = SaveDataSchema.safeParse(data);
    if (!parsed.success) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.data));
    } catch {
      // ignore
    }

    if (this.backendAvailable) {
      try {
        const blob = new Blob(
          [JSON.stringify({ agentId: "truman", state: parsed.data })],
          { type: "application/json" },
        );
        navigator.sendBeacon(`${this.backendUrl}/state/save`, blob);
      } catch {
        // ignore — best effort
      }
    }
  }

  /** Load state — GET from backend, fallback to localStorage, returns null if no save.
   *  Validates version — discards saves with version mismatch (TI.6). */
  async load(): Promise<SaveData | null> {
    // Try backend first
    if (this.backendAvailable) {
      try {
        const res = await fetch(`${this.backendUrl}/state/load/truman`);
        if (res.ok) {
          const json = await res.json();
          const parsed = SaveDataSchema.safeParse(json.state);
          if (parsed.success) {
            if (parsed.data.version !== SAVE_DATA_VERSION) {
              console.warn(`[SaveManager] Backend save version mismatch: got ${parsed.data.version}, expected ${SAVE_DATA_VERSION}. Discarding.`);
              return null;
            }
            return parsed.data;
          }
          console.warn("[SaveManager] Backend state invalid, trying localStorage");
        }
      } catch (e) {
        console.warn("[SaveManager] Backend load error:", e);
      }
    }

    // Fallback: localStorage
    return this.loadFromLocalStorage();
  }

  /** Check if any save exists */
  async hasSave(): Promise<boolean> {
    if (this.backendAvailable) {
      try {
        const res = await fetch(`${this.backendUrl}/state/load/truman`);
        if (res.ok) return true;
      } catch {
        // fall through
      }
    }
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  /** Reset saved state */
  async reset(mode: "soft" | "hard"): Promise<void> {
    if (mode === "hard") {
      localStorage.removeItem(STORAGE_KEY);
      // Note: DB state is not deleted — it's just superseded by new saves
      // A hard reset means next save will have fresh createdAt
    }
    // Soft reset: caller modifies the SaveData before saving (position→center, emotions→default)
    // No storage clearing needed for soft reset
  }

  /** Whether the backend API is available */
  get isBackendAvailable(): boolean {
    return this.backendAvailable;
  }

  private loadFromLocalStorage(): SaveData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = SaveDataSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        if (parsed.data.version !== SAVE_DATA_VERSION) {
          console.warn(`[SaveManager] localStorage save version mismatch: got ${parsed.data.version}, expected ${SAVE_DATA_VERSION}. Discarding.`);
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
        return parsed.data;
      }
      console.warn("[SaveManager] localStorage data invalid, discarding");
      localStorage.removeItem(STORAGE_KEY);
      return null;
    } catch {
      return null;
    }
  }
}
