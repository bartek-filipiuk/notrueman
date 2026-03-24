import { describe, it, expect, beforeEach } from "vitest";
import { PhysicalStateEngine } from "../physical-state.js";

describe("PhysicalStateEngine (T4.5)", () => {
  let engine: PhysicalStateEngine;

  beforeEach(() => {
    engine = new PhysicalStateEngine();
  });

  it("starts with default physical state", () => {
    const state = engine.getState();
    expect(state.energy).toBe(0.8);
    expect(state.hunger).toBe(0.3);
    expect(state.tiredness).toBe(0.2);
  });

  it("eating reduces hunger", () => {
    engine.setState({ energy: 0.5, hunger: 0.7, tiredness: 0.3 });
    engine.applyActivity("eat");
    expect(engine.getState().hunger).toBeLessThan(0.7);
  });

  it("sleeping reduces tiredness", () => {
    engine.setState({ energy: 0.3, hunger: 0.4, tiredness: 0.8 });
    engine.applyActivity("sleep");
    expect(engine.getState().tiredness).toBeLessThan(0.8);
  });

  it("sleeping restores energy", () => {
    engine.setState({ energy: 0.2, hunger: 0.4, tiredness: 0.8 });
    engine.applyActivity("sleep");
    expect(engine.getState().energy).toBeGreaterThan(0.2);
  });

  it("exercise reduces energy", () => {
    engine.setState({ energy: 0.8, hunger: 0.3, tiredness: 0.3 });
    engine.applyActivity("exercise");
    expect(engine.getState().energy).toBeLessThan(0.8);
  });

  it("exercise increases tiredness", () => {
    engine.setState({ energy: 0.8, hunger: 0.3, tiredness: 0.3 });
    engine.applyActivity("exercise");
    expect(engine.getState().tiredness).toBeGreaterThan(0.3);
  });

  it("natural drift increases hunger over time", () => {
    const initial = engine.getState().hunger;
    engine.applyTimeDrift(1); // 1 hour
    expect(engine.getState().hunger).toBeGreaterThan(initial);
  });

  it("natural drift increases tiredness over time", () => {
    const initial = engine.getState().tiredness;
    engine.applyTimeDrift(2); // 2 hours
    expect(engine.getState().tiredness).toBeGreaterThan(initial);
  });

  it("natural drift slightly reduces energy over time", () => {
    const initial = engine.getState().energy;
    engine.applyTimeDrift(3); // 3 hours
    expect(engine.getState().energy).toBeLessThan(initial);
  });

  it("values are clamped to 0-1 range", () => {
    engine.setState({ energy: 0.95, hunger: 0.05, tiredness: 0.05 });
    // Sleep should boost energy but not exceed 1.0
    engine.applyActivity("sleep");
    expect(engine.getState().energy).toBeLessThanOrEqual(1.0);

    // Set hunger very low, eat should not go below 0
    engine.setState({ energy: 0.5, hunger: 0.05, tiredness: 0.5 });
    engine.applyActivity("eat");
    expect(engine.getState().hunger).toBeGreaterThanOrEqual(0);
  });

  it("cooking increases hunger slightly (smelling food)", () => {
    const before = engine.getState().hunger;
    engine.applyActivity("cook");
    expect(engine.getState().hunger).toBeGreaterThanOrEqual(before);
  });

  it("computer work increases tiredness slightly", () => {
    const before = engine.getState().tiredness;
    engine.applyActivity("computer");
    expect(engine.getState().tiredness).toBeGreaterThan(before);
  });

  it("getActivitySuitability returns lower scores for energy-demanding activities when tired", () => {
    engine.setState({ energy: 0.1, hunger: 0.3, tiredness: 0.9 });
    const suitability = engine.getActivitySuitability();
    expect(suitability["exercise"]).toBeLessThan(suitability["sleep"]);
  });

  it("getActivitySuitability suggests eating when hungry", () => {
    engine.setState({ energy: 0.5, hunger: 0.9, tiredness: 0.3 });
    const suitability = engine.getActivitySuitability();
    expect(suitability["eat"]).toBeGreaterThan(suitability["exercise"]);
  });
});
