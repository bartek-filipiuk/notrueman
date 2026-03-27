import { describe, it, expect } from "vitest";
import {
  ROOM_OBJECTS,
  ACTIVITY_LIST,
  type Position,
  type AnimationState,
  type RoomObject,
  type ActivityType,
} from "../index.js";

describe("Position type", () => {
  it("has x and y number fields", () => {
    const pos: Position = { x: 100, y: 200 };
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
  });
});

describe("AnimationState type", () => {
  it("has key, frameRate, and loop fields", () => {
    const anim: AnimationState = { key: "idle", frameRate: 4, loop: true };
    expect(anim.key).toBe("idle");
    expect(anim.frameRate).toBe(4);
    expect(anim.loop).toBe(true);
  });
});

describe("ROOM_OBJECTS constant", () => {
  it("contains room objects (some may be hidden off-screen)", () => {
    // 13 objects (window removed, computer+door hidden at x:-999)
    expect(ROOM_OBJECTS.length).toBeGreaterThanOrEqual(10);
  });

  it("every object has required fields", () => {
    for (const obj of ROOM_OBJECTS) {
      expect(obj.id).toBeDefined();
      expect(typeof obj.x).toBe("number");
      expect(typeof obj.y).toBe("number");
      expect(typeof obj.width).toBe("number");
      expect(typeof obj.height).toBe("number");
      expect(obj.label).toBeDefined();
      expect(obj.zone).toBeDefined();
    }
  });

  it("contains core furniture objects", () => {
    const ids = ROOM_OBJECTS.map((o) => o.id);
    expect(ids).toContain("bed");
    expect(ids).toContain("desk");
    expect(ids).toContain("bookshelf");
    expect(ids).toContain("fridge");
    expect(ids).toContain("stove");
    expect(ids).toContain("table_chair");
    expect(ids).toContain("easel");
    expect(ids).toContain("exercise_mat");
    expect(ids).toContain("clock");
    expect(ids).toContain("plant");
    expect(ids).toContain("poster");
  });

  it("visible objects have valid positions within game bounds", () => {
    for (const obj of ROOM_OBJECTS) {
      // Skip hidden objects (x:-999 = intentionally off-screen)
      if (obj.x < 0) continue;
      expect(obj.x).toBeGreaterThanOrEqual(0);
      expect(obj.x + obj.width).toBeLessThanOrEqual(960);
      expect(obj.y).toBeGreaterThanOrEqual(0);
      expect(obj.y).toBeLessThanOrEqual(540);
    }
  });
});

describe("ACTIVITY_LIST constant", () => {
  it("contains all 8 activity types", () => {
    expect(ACTIVITY_LIST).toHaveLength(8);
  });

  it("contains sleep, eat, read, computer, exercise, think, cook, draw", () => {
    const activities: ActivityType[] = [
      "sleep", "eat", "read", "computer",
      "exercise", "think", "cook", "draw",
    ];
    for (const act of activities) {
      expect(ACTIVITY_LIST).toContain(act);
    }
  });
});
