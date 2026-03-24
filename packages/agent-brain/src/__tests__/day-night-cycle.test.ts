import { describe, it, expect, vi, beforeEach } from "vitest";
import { DayNightCycle } from "../day-night-cycle.js";

describe("DayNightCycle (T4.3)", () => {
  let cycle: DayNightCycle;

  beforeEach(() => {
    cycle = new DayNightCycle({
      sleepDurationHours: 5,
      wakeHour: 7,
    });
  });

  it("defaults to awake state", () => {
    expect(cycle.isSleeping()).toBe(false);
  });

  it("reports sleeping when within sleep window", () => {
    // Set bedtime and simulate going to sleep
    cycle.goToSleep();
    expect(cycle.isSleeping()).toBe(true);
  });

  it("wakes up after sleep duration", () => {
    cycle.goToSleep();
    expect(cycle.isSleeping()).toBe(true);

    // Simulate passage of sleep duration
    cycle.checkWakeUp(hoursFromNow(6));
    expect(cycle.isSleeping()).toBe(false);
  });

  it("does not wake up before sleep duration passes", () => {
    cycle.goToSleep();

    cycle.checkWakeUp(hoursFromNow(3));
    expect(cycle.isSleeping()).toBe(true);
  });

  it("shouldSleep returns true at night hours (after 22:00)", () => {
    const lateNight = new Date();
    lateNight.setHours(23, 0, 0, 0);
    expect(cycle.shouldSleep(lateNight)).toBe(true);
  });

  it("shouldSleep returns false during day hours", () => {
    const midday = new Date();
    midday.setHours(14, 0, 0, 0);
    expect(cycle.shouldSleep(midday)).toBe(false);
  });

  it("getPhase returns correct phase", () => {
    expect(cycle.getPhase()).toBe("awake");

    cycle.goToSleep();
    expect(cycle.getPhase()).toBe("sleeping");
  });

  it("getSleepHoursRemaining returns 0 when awake", () => {
    expect(cycle.getSleepHoursRemaining()).toBe(0);
  });

  it("getSleepHoursRemaining returns positive when sleeping", () => {
    cycle.goToSleep();
    const remaining = cycle.getSleepHoursRemaining();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(5);
  });

  it("getHUDLabel returns 'Sleeping...' when asleep", () => {
    cycle.goToSleep();
    expect(cycle.getHUDLabel()).toBe("Sleeping...");
  });

  it("getHUDLabel returns empty when awake", () => {
    expect(cycle.getHUDLabel()).toBe("");
  });

  it("sleep duration is configurable", () => {
    const shortCycle = new DayNightCycle({
      sleepDurationHours: 4,
      wakeHour: 8,
    });

    shortCycle.goToSleep();
    shortCycle.checkWakeUp(hoursFromNow(3));
    expect(shortCycle.isSleeping()).toBe(true);

    shortCycle.checkWakeUp(hoursFromNow(5));
    expect(shortCycle.isSleeping()).toBe(false);
  });

  it("tracks sleep/wake timestamps", () => {
    const beforeSleep = new Date();
    cycle.goToSleep();

    const state = cycle.getState();
    expect(state.sleepStartedAt).toBeDefined();
    expect(state.sleepStartedAt!.getTime()).toBeGreaterThanOrEqual(beforeSleep.getTime());
  });
});

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
