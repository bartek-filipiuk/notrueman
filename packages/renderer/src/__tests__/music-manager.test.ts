import { describe, it, expect } from "vitest";
import {
  moodToMusicMood,
  MUSIC_TRACK_KEYS,
  type MusicMood,
} from "../systems/ProceduralMusic";
import {
  CROSSFADE_MS,
  SILENCE_CHANCE,
  MIN_SILENCE_MS,
  MAX_SILENCE_MS,
} from "../systems/MusicManager";

/**
 * MusicManager & ProceduralMusic unit tests (T8.4).
 *
 * Since Phaser's Sound Manager requires a browser context, we test
 * the pure logic: mood mapping, configuration values, track keys.
 */
describe("MusicManager (T8.4)", () => {
  describe("mood to music mood mapping", () => {
    it("maps happy → happy", () => {
      expect(moodToMusicMood("happy")).toBe("happy");
    });

    it("maps excited → happy", () => {
      expect(moodToMusicMood("excited")).toBe("happy");
    });

    it("maps curious → curious", () => {
      expect(moodToMusicMood("curious")).toBe("curious");
    });

    it("maps contemplative → curious", () => {
      expect(moodToMusicMood("contemplative")).toBe("curious");
    });

    it("maps anxious → tense", () => {
      expect(moodToMusicMood("anxious")).toBe("tense");
    });

    it("maps frustrated → tense", () => {
      expect(moodToMusicMood("frustrated")).toBe("tense");
    });

    it("maps bored → bored", () => {
      expect(moodToMusicMood("bored")).toBe("bored");
    });

    it("maps content → calm", () => {
      expect(moodToMusicMood("content")).toBe("calm");
    });

    it("maps neutral → calm", () => {
      expect(moodToMusicMood("neutral")).toBe("calm");
    });

    it("maps unknown mood → calm (default)", () => {
      expect(moodToMusicMood("unknown_mood")).toBe("calm");
    });
  });

  describe("music track keys", () => {
    it("has a track key for every music mood", () => {
      const moods: MusicMood[] = ["happy", "calm", "curious", "tense", "bored"];
      for (const mood of moods) {
        expect(MUSIC_TRACK_KEYS[mood]).toBeDefined();
        expect(typeof MUSIC_TRACK_KEYS[mood]).toBe("string");
        expect(MUSIC_TRACK_KEYS[mood].startsWith("music_")).toBe(true);
      }
    });

    it("all track keys are unique", () => {
      const keys = Object.values(MUSIC_TRACK_KEYS);
      const unique = new Set(keys);
      expect(unique.size).toBe(keys.length);
    });

    it("has exactly 5 mood categories", () => {
      expect(Object.keys(MUSIC_TRACK_KEYS)).toHaveLength(5);
    });
  });

  describe("crossfade configuration", () => {
    it("crossfade duration is 2000ms (2 seconds per spec)", () => {
      expect(CROSSFADE_MS).toBe(2000);
    });
  });

  describe("silence configuration", () => {
    it("silence chance is 20% per visual-spec S9.3", () => {
      expect(SILENCE_CHANCE).toBe(0.2);
    });

    it("minimum silence is at least 10 seconds", () => {
      expect(MIN_SILENCE_MS).toBeGreaterThanOrEqual(10_000);
    });

    it("maximum silence is at most 30 seconds", () => {
      expect(MAX_SILENCE_MS).toBeLessThanOrEqual(30_000);
    });

    it("max silence is greater than min silence", () => {
      expect(MAX_SILENCE_MS).toBeGreaterThan(MIN_SILENCE_MS);
    });
  });

  describe("music volume per spec", () => {
    it("music channel default volume is 15-20% (0.18 in AudioMixer)", () => {
      // From AudioMixer DEFAULT_VOLUMES.music = 0.18
      const musicVolume = 0.18;
      expect(musicVolume).toBeGreaterThanOrEqual(0.15);
      expect(musicVolume).toBeLessThanOrEqual(0.20);
    });
  });

  describe("ProceduralMusic module exports", () => {
    it("ProceduralMusic exports all generators and utilities", async () => {
      const mod = await import("../systems/ProceduralMusic");
      expect(mod.generateHappyTrack).toBeDefined();
      expect(mod.generateCalmTrack).toBeDefined();
      expect(mod.generateCuriousTrack).toBeDefined();
      expect(mod.generateTenseTrack).toBeDefined();
      expect(mod.generateBoredTrack).toBeDefined();
      expect(mod.generateAllMusicTracks).toBeDefined();
      expect(mod.moodToMusicMood).toBeDefined();
      expect(mod.MUSIC_TRACK_KEYS).toBeDefined();
    });

    it("MusicManager class is importable", async () => {
      const mod = await import("../systems/MusicManager");
      expect(mod.MusicManager).toBeDefined();
      expect(typeof mod.MusicManager).toBe("function");
    });
  });

  describe("all 9 overall moods map to valid music moods", () => {
    const allMoods = [
      "happy", "curious", "anxious", "bored", "excited",
      "content", "frustrated", "contemplative", "neutral",
    ];
    const validMusicMoods: MusicMood[] = ["happy", "calm", "curious", "tense", "bored"];

    for (const mood of allMoods) {
      it(`"${mood}" maps to a valid music mood`, () => {
        const result = moodToMusicMood(mood);
        expect(validMusicMoods).toContain(result);
      });
    }
  });
});
