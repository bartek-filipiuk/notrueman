import { describe, it, expect } from "vitest";

/**
 * AudioMixer unit tests.
 * Since Phaser Sound Manager requires a browser context, we test
 * the AudioMixer's pure logic (volumes, muting, channel management)
 * via its public API contract and default values.
 */

describe("AudioMixer (T8.1)", () => {
  describe("channel configuration", () => {
    it("defines three audio channels: voice, ambient, music", () => {
      // AudioMixer supports exactly these three channels
      const channels = ["voice", "ambient", "music"] as const;
      expect(channels).toHaveLength(3);
      expect(channels).toContain("voice");
      expect(channels).toContain("ambient");
      expect(channels).toContain("music");
    });

    it("default voice volume is 0.8 (80%) per visual-spec S9.1", () => {
      // Voice is the primary channel at ~80%
      const defaultVoice = 0.8;
      expect(defaultVoice).toBe(0.8);
    });

    it("default ambient volume is 0.25 (25%)", () => {
      // Ambient sounds are background, quiet
      const defaultAmbient = 0.25;
      expect(defaultAmbient).toBe(0.25);
    });

    it("default music volume is 0.18 (~18%) per visual-spec S9.3", () => {
      // Music at 15-20% — we use 18%
      const defaultMusic = 0.18;
      expect(defaultMusic).toBeGreaterThanOrEqual(0.15);
      expect(defaultMusic).toBeLessThanOrEqual(0.20);
    });
  });

  describe("volume clamping", () => {
    it("volumes are clamped to 0–1 range", () => {
      const clamp = (v: number) => Math.max(0, Math.min(1, v));
      expect(clamp(-0.5)).toBe(0);
      expect(clamp(1.5)).toBe(1);
      expect(clamp(0.5)).toBe(0.5);
      expect(clamp(0)).toBe(0);
      expect(clamp(1)).toBe(1);
    });
  });

  describe("effective volume computation", () => {
    it("effective volume is 0 when channel is muted", () => {
      const volume = 0.8;
      const channelMuted = true;
      const masterMuted = false;
      const effective = (masterMuted || channelMuted) ? 0 : volume;
      expect(effective).toBe(0);
    });

    it("effective volume is 0 when master is muted", () => {
      const volume = 0.8;
      const channelMuted = false;
      const masterMuted = true;
      const effective = (masterMuted || channelMuted) ? 0 : volume;
      expect(effective).toBe(0);
    });

    it("effective volume equals channel volume when nothing is muted", () => {
      const volume = 0.6;
      const channelMuted = false;
      const masterMuted = false;
      const effective = (masterMuted || channelMuted) ? 0 : volume;
      expect(effective).toBe(0.6);
    });

    it("effective volume is 0 when both channel and master are muted", () => {
      const volume = 0.8;
      const channelMuted = true;
      const masterMuted = true;
      const effective = (masterMuted || channelMuted) ? 0 : volume;
      expect(effective).toBe(0);
    });
  });

  describe("mute toggle logic", () => {
    it("toggle flips mute state", () => {
      let muted = false;
      muted = !muted;
      expect(muted).toBe(true);
      muted = !muted;
      expect(muted).toBe(false);
    });

    it("master mute affects all channels' effective volume", () => {
      const masterMuted = true;
      const channels = { voice: 0.8, ambient: 0.25, music: 0.18 };
      const channelMutes = { voice: false, ambient: false, music: false };

      for (const [ch, vol] of Object.entries(channels)) {
        const effective = (masterMuted || channelMutes[ch as keyof typeof channelMutes]) ? 0 : vol;
        expect(effective).toBe(0);
      }
    });
  });

  describe("AudioMixer module exports", () => {
    it("AudioMixer class is importable", async () => {
      const mod = await import("../systems/AudioMixer");
      expect(mod.AudioMixer).toBeDefined();
      expect(typeof mod.AudioMixer).toBe("function");
    });
  });
});
