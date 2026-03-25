import { describe, it, expect } from "vitest";
import {
  handleWeatherChange,
  handleSendLetter,
  dispatchReward,
} from "../channel-points.js";

describe("channel-points", () => {
  describe("handleWeatherChange", () => {
    it("accepts valid weather options", () => {
      const result = handleWeatherChange("u1", "User1", "sunny");
      expect(result.accepted).toBe(true);
      expect(result.event).toBeDefined();
      expect(result.event!.type).toBe("channel_points");
      expect(result.event!.metadata.weather).toBe("sunny");
    });

    it("accepts weather in a sentence", () => {
      const result = handleWeatherChange("u1", "User1", "make it rainy please");
      expect(result.accepted).toBe(true);
      expect(result.event!.metadata.weather).toBe("rainy");
    });

    it("rejects invalid weather", () => {
      const result = handleWeatherChange("u1", "User1", "tornado");
      expect(result.accepted).toBe(false);
      expect(result.message).toContain("Invalid");
    });
  });

  describe("handleSendLetter", () => {
    it("accepts valid letters", () => {
      const result = handleSendLetter("u1", "User1", "Dear Truman, you are great!");
      expect(result.accepted).toBe(true);
      expect(result.event).toBeDefined();
      expect(result.event!.type).toBe("letter");
      expect(result.event!.content).toBe("Dear Truman, you are great!");
    });

    it("rejects too short letters", () => {
      const result = handleSendLetter("u1", "User1", "Hi");
      expect(result.accepted).toBe(false);
      expect(result.message).toContain("too short");
    });

    it("rejects too long letters", () => {
      const result = handleSendLetter("u1", "User1", "x".repeat(201));
      expect(result.accepted).toBe(false);
      expect(result.message).toContain("too long");
    });
  });

  describe("dispatchReward", () => {
    it("dispatches weather rewards", () => {
      const result = dispatchReward("Change weather", "u1", "User1", "cloudy");
      expect(result).not.toBeNull();
      expect(result!.accepted).toBe(true);
    });

    it("dispatches letter rewards", () => {
      const result = dispatchReward("Send letter to Truman", "u1", "User1", "Hello there Truman!");
      expect(result).not.toBeNull();
      expect(result!.accepted).toBe(true);
    });

    it("returns null for unknown rewards", () => {
      const result = dispatchReward("Unknown reward", "u1", "User1", "test");
      expect(result).toBeNull();
    });
  });
});
