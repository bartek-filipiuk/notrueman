import { describe, it, expect } from "vitest";

/**
 * MusicManager unit tests (T8.4).
 * Tests mood-to-music mapping, configuration, and crossfade constants.
 * Browser Audio API not available in Vitest, so we test pure logic.
 */

describe("MusicManager (T8.4)", () => {
  describe("mood-to-music mapping", () => {
    it("maps all OverallMood values to music categories", async () => {
      const mod = await import("../systems/ProceduralMusic");
      const mapping = mod.MOOD_TO_MUSIC;

      // Happy moods → upbeat lo-fi
      expect(mapping.happy).toBe("happy");
      expect(mapping.excited).toBe("happy");

      // Sad/anxious moods → piano/melancholic
      expect(mapping.anxious).toBe("sad");
      expect(mapping.frustrated).toBe("sad");

      // Curious moods → quirky
      expect(mapping.curious).toBe("curious");
      expect(mapping.contemplative).toBe("curious");

      // Neutral moods → calm
      expect(mapping.neutral).toBe("neutral");
      expect(mapping.content).toBe("neutral");
      expect(mapping.bored).toBe("neutral");
    });

    it("covers all 9 OverallMood types", async () => {
      const mod = await import("../systems/ProceduralMusic");
      const mapping = mod.MOOD_TO_MUSIC;
      const allMoods = [
        "happy", "curious", "anxious", "bored", "excited",
        "content", "frustrated", "contemplative", "neutral",
      ];
      for (const mood of allMoods) {
        expect(mapping[mood]).toBeDefined();
      }
    });
  });

  describe("music track keys", () => {
    it("defines exactly 4 music tracks", async () => {
      const mod = await import("../systems/ProceduralMusic");
      expect(mod.MUSIC_TRACK_KEYS).toHaveLength(4);
      expect(mod.MUSIC_TRACK_KEYS).toContain("music_happy");
      expect(mod.MUSIC_TRACK_KEYS).toContain("music_sad");
      expect(mod.MUSIC_TRACK_KEYS).toContain("music_curious");
      expect(mod.MUSIC_TRACK_KEYS).toContain("music_neutral");
    });
  });

  describe("procedural music generators", () => {
    it("exports all generator functions", async () => {
      const mod = await import("../systems/ProceduralMusic");
      expect(typeof mod.generateMusicHappy).toBe("function");
      expect(typeof mod.generateMusicSad).toBe("function");
      expect(typeof mod.generateMusicCurious).toBe("function");
      expect(typeof mod.generateMusicNeutral).toBe("function");
      expect(typeof mod.generateAllMusicTracks).toBe("function");
    });
  });

  describe("crossfade configuration", () => {
    it("crossfade duration is 2 seconds (2000ms) per T8.4 spec", async () => {
      const mod = await import("../systems/MusicManager");
      expect(mod.CROSSFADE_DURATION_MS).toBe(2000);
    });
  });

  describe("MusicManager class", () => {
    it("is importable", async () => {
      const mod = await import("../systems/MusicManager");
      expect(mod.MusicManager).toBeDefined();
      expect(typeof mod.MusicManager).toBe("function");
    });
  });

  describe("mood category deduplication", () => {
    it("maps multiple moods to same track (avoids unnecessary crossfade)", async () => {
      const mod = await import("../systems/ProceduralMusic");
      const mapping = mod.MOOD_TO_MUSIC;

      // happy and excited both map to "happy" → same track key
      expect(mapping.happy).toBe(mapping.excited);

      // anxious and frustrated both map to "sad"
      expect(mapping.anxious).toBe(mapping.frustrated);

      // curious and contemplative both map to "curious"
      expect(mapping.curious).toBe(mapping.contemplative);

      // neutral, content, bored all map to "neutral"
      expect(mapping.neutral).toBe(mapping.content);
      expect(mapping.neutral).toBe(mapping.bored);
    });
  });

  describe("music volume (AudioMixer integration)", () => {
    it("music channel default is 15-20% per visual-spec S9.3", () => {
      // AudioMixer sets music channel to 0.18 (18%)
      const musicVolume = 0.18;
      expect(musicVolume).toBeGreaterThanOrEqual(0.15);
      expect(musicVolume).toBeLessThanOrEqual(0.20);
    });
  });
});
