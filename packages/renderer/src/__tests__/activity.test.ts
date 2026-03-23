import { describe, it, expect } from "vitest";
import { ACTIVITY_LIST, ACTIVITY_FAILURE_RATES } from "@nts/shared";

describe("activity renderer smoke tests", () => {
  it("all 8 activity types have defined failure rates", () => {
    for (const activity of ACTIVITY_LIST) {
      expect(ACTIVITY_FAILURE_RATES[activity]).toBeDefined();
      expect(typeof ACTIVITY_FAILURE_RATES[activity]).toBe("number");
    }
  });

  it("minimum 6 activities required by T1.8 (we have 8)", () => {
    expect(ACTIVITY_LIST.length).toBeGreaterThanOrEqual(6);
  });

  it("activity types match the ActivityType union", () => {
    const expected = ["sleep", "eat", "read", "computer", "exercise", "think", "cook", "draw"];
    expect([...ACTIVITY_LIST].sort()).toEqual(expected.sort());
  });
});
