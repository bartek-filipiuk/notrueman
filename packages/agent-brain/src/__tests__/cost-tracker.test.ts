import { describe, it, expect, vi, beforeEach } from "vitest";
import { CostTracker } from "../cost-tracker.js";

describe("CostTracker (S4.3)", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker({ dailyCapUsd: 1.0 });
  });

  it("starts with zero spend", () => {
    expect(tracker.getDailySpend()).toBe(0);
    expect(tracker.getCapPercentage()).toBe(0);
  });

  it("tracks spending", () => {
    tracker.recordSpend(0.25);
    expect(tracker.getDailySpend()).toBeCloseTo(0.25);
    expect(tracker.getCapPercentage()).toBeCloseTo(25);
  });

  it("warns at 80% threshold", () => {
    const onWarning = vi.fn();
    tracker = new CostTracker({ dailyCapUsd: 1.0, onWarning });

    tracker.recordSpend(0.81);

    expect(onWarning).toHaveBeenCalledWith(
      expect.objectContaining({ percentage: expect.any(Number) }),
    );
  });

  it("does not warn below 80%", () => {
    const onWarning = vi.fn();
    tracker = new CostTracker({ dailyCapUsd: 1.0, onWarning });

    tracker.recordSpend(0.5);

    expect(onWarning).not.toHaveBeenCalled();
  });

  it("hard stop at 100%", () => {
    tracker.recordSpend(1.01);
    expect(tracker.isCapReached()).toBe(true);
  });

  it("canSpend returns false when cap reached", () => {
    tracker.recordSpend(0.95);
    expect(tracker.canSpend()).toBe(true);

    tracker.recordSpend(0.06);
    expect(tracker.canSpend()).toBe(false);
  });

  it("resets daily counter", () => {
    tracker.recordSpend(0.5);
    tracker.resetDaily();
    expect(tracker.getDailySpend()).toBe(0);
    expect(tracker.canSpend()).toBe(true);
  });

  it("configurable daily cap", () => {
    tracker = new CostTracker({ dailyCapUsd: 5.0 });
    tracker.recordSpend(4.0);
    expect(tracker.getCapPercentage()).toBeCloseTo(80);
    expect(tracker.canSpend()).toBe(true);
  });
});
