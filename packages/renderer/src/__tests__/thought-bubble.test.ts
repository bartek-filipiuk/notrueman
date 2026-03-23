import { describe, it, expect } from "vitest";
import {
  TYPEWRITER_CHAR_MS,
  BUBBLE_DISPLAY_MS,
  BUBBLE_FADE_MS,
  MOOD_BUBBLE_STYLES,
} from "@nts/shared";

describe("thought bubble config smoke tests", () => {
  it("typewriter speed is 50ms per character", () => {
    expect(TYPEWRITER_CHAR_MS).toBe(50);
  });

  it("bubble display duration is 8-10 seconds", () => {
    expect(BUBBLE_DISPLAY_MS).toBeGreaterThanOrEqual(8000);
    expect(BUBBLE_DISPLAY_MS).toBeLessThanOrEqual(10000);
  });

  it("bubble fade duration is 1 second", () => {
    expect(BUBBLE_FADE_MS).toBe(1000);
  });

  it("all 7 mood styles have required properties", () => {
    const moods = Object.keys(MOOD_BUBBLE_STYLES);
    expect(moods.length).toBeGreaterThanOrEqual(7);
    for (const mood of moods) {
      const style = MOOD_BUBBLE_STYLES[mood];
      expect(style.bubbleColor).toBeDefined();
      expect(style.textColor).toBeDefined();
      expect(style.border).toBeDefined();
      // Colors should be hex strings
      expect(style.bubbleColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(style.textColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
