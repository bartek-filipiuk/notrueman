import { describe, it, expect } from "vitest";
import { GAME_WIDTH, GAME_HEIGHT, APP_NAME } from "@nts/shared";

/**
 * T1.12: Dev server integration smoke tests.
 * Validates that shared constants needed by the Vite dev server entry point are correct.
 * Structural checks (index.html, vite.config.ts, turbo dev task) verified via build pipeline.
 */
describe("dev server integration (T1.12)", () => {
  it("APP_NAME is set for page title", () => {
    expect(APP_NAME).toBe("No True Man Show");
  });

  it("game dimensions are valid for Vite canvas rendering", () => {
    expect(GAME_WIDTH).toBeGreaterThan(0);
    expect(GAME_HEIGHT).toBeGreaterThan(0);
    expect(GAME_WIDTH).toBe(960);
    expect(GAME_HEIGHT).toBe(540);
  });

  it("shared module exports are importable (Vite resolves @nts/shared)", () => {
    // If this test runs, Vite/Vitest can resolve the @nts/shared workspace dependency
    expect(typeof GAME_WIDTH).toBe("number");
    expect(typeof APP_NAME).toBe("string");
  });
});
