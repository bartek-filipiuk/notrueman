import { describe, it, expect } from "vitest";
import { computeBackoff } from "./ws-client.js";

describe("MindFeedClient backoff (TM.6)", () => {
  it("computes exponential backoff", () => {
    expect(computeBackoff(0)).toBe(1000);
    expect(computeBackoff(1)).toBe(2000);
    expect(computeBackoff(2)).toBe(4000);
    expect(computeBackoff(3)).toBe(8000);
    expect(computeBackoff(4)).toBe(16000);
  });

  it("caps at max delay", () => {
    expect(computeBackoff(10, 1000, 30000)).toBe(30000);
    expect(computeBackoff(20, 1000, 30000)).toBe(30000);
  });

  it("respects custom initial delay", () => {
    expect(computeBackoff(0, 500)).toBe(500);
    expect(computeBackoff(1, 500)).toBe(1000);
    expect(computeBackoff(2, 500)).toBe(2000);
  });

  it("respects custom max delay", () => {
    expect(computeBackoff(5, 1000, 10000)).toBe(10000);
  });
});
