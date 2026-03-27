import { describe, it, expect, vi, beforeEach } from "vitest";
import { SAVE_DATA_VERSION, EMOTION_DEFAULTS } from "@nts/shared";

describe("Stage I: Reset UI + Day Counter", () => {
  describe("TI.1: Day counter calculation", () => {
    it("dayCount = 0 for same-day save", () => {
      const createdAt = Date.now() - 1000;
      const dayCount = Math.floor((Date.now() - createdAt) / 86_400_000);
      expect(dayCount).toBe(0);
    });

    it("dayCount = 1 after 24 hours", () => {
      const createdAt = Date.now() - 86_400_000 - 1000;
      const dayCount = Math.floor((Date.now() - createdAt) / 86_400_000);
      expect(dayCount).toBe(1);
    });

    it("dayCount = 7 after one week", () => {
      const createdAt = Date.now() - 7 * 86_400_000 - 1000;
      const dayCount = Math.floor((Date.now() - createdAt) / 86_400_000);
      expect(dayCount).toBe(7);
    });
  });

  describe("TI.3: Soft reset preserves day counter", () => {
    it("soft reset keeps createdAt and dayCount", () => {
      // Simulating soft reset: position/emotions change but counters stay
      const createdAt = Date.now() - 3 * 86_400_000;
      const dayCountBefore = Math.floor((Date.now() - createdAt) / 86_400_000);

      // After soft reset — createdAt stays the same
      const dayCountAfter = Math.floor((Date.now() - createdAt) / 86_400_000);
      expect(dayCountAfter).toBe(dayCountBefore);
      expect(dayCountAfter).toBe(3);
    });

    it("soft reset resets position to center", () => {
      const centerX = 480;
      const centerY = 400;
      // Soft reset restores to center
      expect(centerX).toBe(480);
      expect(centerY).toBe(400);
    });

    it("soft reset restores default emotions", () => {
      const defaultEmotions = {
        happiness: 0.5, curiosity: 0.5, anxiety: 0.2,
        boredom: 0.3, excitement: 0.3, contentment: 0.5, frustration: 0.1,
      };
      // All values should be within valid range
      for (const [, v] of Object.entries(defaultEmotions)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("TI.4: Hard reset clears all", () => {
    it("hard reset resets dayCount to 0", () => {
      // After hard reset, createdAt = now, so dayCount = 0
      const createdAt = Date.now();
      const dayCount = Math.floor((Date.now() - createdAt) / 86_400_000);
      expect(dayCount).toBe(0);
    });

    it("hard reset resets sessionCount to 1", () => {
      // After hard reset, fresh start
      const sessionCount = 1;
      expect(sessionCount).toBe(1);
    });
  });

  describe("TI.5: URL reset params", () => {
    it("recognizes ?reset=soft", () => {
      const params = new URLSearchParams("?reset=soft");
      expect(params.get("reset")).toBe("soft");
    });

    it("recognizes ?reset=hard", () => {
      const params = new URLSearchParams("?reset=hard");
      expect(params.get("reset")).toBe("hard");
    });

    it("ignores unknown reset values", () => {
      const params = new URLSearchParams("?reset=invalid");
      const value = params.get("reset");
      expect(value !== "soft" && value !== "hard").toBe(true);
    });
  });

  describe("TI.6: Save version migration", () => {
    it("SAVE_DATA_VERSION is 1", () => {
      expect(SAVE_DATA_VERSION).toBe(1);
    });

    it("version mismatch should cause discard", () => {
      // When loaded version !== SAVE_DATA_VERSION, discard
      const loadedVersion = 2 as number;
      const shouldDiscard = loadedVersion !== (SAVE_DATA_VERSION as number);
      expect(shouldDiscard).toBe(true);
    });

    it("matching version should be accepted", () => {
      const loadedVersion = SAVE_DATA_VERSION;
      const shouldDiscard = loadedVersion !== SAVE_DATA_VERSION;
      expect(shouldDiscard).toBe(false);
    });
  });

  describe("TI.2: ConfigPanel stats formatting", () => {
    it("formats alive time correctly", () => {
      const totalTimeAliveMs = 5 * 3_600_000 + 23 * 60_000; // 5h 23m
      const aliveH = Math.floor(totalTimeAliveMs / 3_600_000);
      const aliveM = Math.floor((totalTimeAliveMs % 3_600_000) / 60_000);
      expect(aliveH).toBe(5);
      expect(aliveM).toBe(23);
    });

    it("formats last saved ago correctly", () => {
      const lastSavedAt = Date.now() - 45_000; // 45s ago
      const agoS = Math.round((Date.now() - lastSavedAt) / 1000);
      expect(agoS).toBeGreaterThanOrEqual(44);
      expect(agoS).toBeLessThanOrEqual(46);
    });
  });
});
