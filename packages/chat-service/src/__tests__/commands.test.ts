import { describe, it, expect } from "vitest";
import { dispatchCommand, handleStatus, handleMood, handleActivity } from "../commands.js";
import type { AgentStateProvider } from "../agent-state-provider.js";

function mockState(overrides: Partial<AgentStateProvider> = {}): AgentStateProvider {
  return {
    getCurrentActivity: () => "read",
    getCurrentMood: () => "curious",
    getRecentActivities: () => [
      { activity: "computer", completedSecondsAgo: 300 },
      { activity: "eat", completedSecondsAgo: 900 },
    ],
    getTickCount: () => 42,
    isRunning: () => true,
    ...overrides,
  };
}

describe("commands", () => {
  describe("!status", () => {
    it("returns activity, mood, and tick count", () => {
      const result = handleStatus(mockState());
      expect(result.response).toContain("reading a book");
      expect(result.response).toContain("curious");
      expect(result.response).toContain("42");
    });

    it("shows offline when not running", () => {
      const result = handleStatus(mockState({ isRunning: () => false }));
      expect(result.response).toContain("offline");
    });

    it("shows idle when no activity", () => {
      const result = handleStatus(mockState({ getCurrentActivity: () => null }));
      expect(result.response).toContain("idle");
    });
  });

  describe("!mood", () => {
    it("returns current mood", () => {
      const result = handleMood(mockState());
      expect(result.response).toContain("curious");
      expect(result.response).toContain("🧐");
    });
  });

  describe("!activity", () => {
    it("returns current and recent activities", () => {
      const result = handleActivity(mockState());
      expect(result.response).toContain("reading a book");
      expect(result.response).toContain("computer");
      expect(result.response).toContain("5m ago");
    });

    it("shows idle when no current activity", () => {
      const result = handleActivity(mockState({ getCurrentActivity: () => null }));
      expect(result.response).toContain("idle");
    });
  });

  describe("dispatchCommand", () => {
    it("dispatches known commands", () => {
      const state = mockState();
      expect(dispatchCommand("!status", state)).not.toBeNull();
      expect(dispatchCommand("!mood", state)).not.toBeNull();
      expect(dispatchCommand("!activity", state)).not.toBeNull();
    });

    it("returns null for unknown commands", () => {
      expect(dispatchCommand("!unknown", mockState())).toBeNull();
      expect(dispatchCommand("hello", mockState())).toBeNull();
    });

    it("is case-insensitive", () => {
      expect(dispatchCommand("!STATUS", mockState())).not.toBeNull();
      expect(dispatchCommand("!Mood", mockState())).not.toBeNull();
    });
  });
});
