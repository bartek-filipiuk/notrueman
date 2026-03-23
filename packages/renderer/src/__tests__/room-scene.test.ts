import { describe, it, expect } from "vitest";
import { ROOM_OBJECTS, GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";

describe("RoomScene data smoke tests", () => {
  it("all 14 room objects have valid positions within game bounds", () => {
    expect(ROOM_OBJECTS).toHaveLength(14);
    for (const obj of ROOM_OBJECTS) {
      expect(obj.x).toBeGreaterThanOrEqual(0);
      expect(obj.x + obj.width).toBeLessThanOrEqual(GAME_WIDTH);
      expect(obj.y).toBeGreaterThanOrEqual(0);
      expect(obj.y + obj.height).toBeLessThanOrEqual(GAME_HEIGHT);
    }
  });

  it("all room zones are covered", () => {
    const zones = new Set(ROOM_OBJECTS.map((o) => o.zone));
    expect(zones.has("sleep")).toBe(true);
    expect(zones.has("kitchen")).toBe(true);
    expect(zones.has("work")).toBe(true);
    expect(zones.has("creative")).toBe(true);
    expect(zones.has("exercise")).toBe(true);
    expect(zones.has("reading")).toBe(true);
    expect(zones.has("window")).toBe(true);
    expect(zones.has("door")).toBe(true);
  });

  it("no objects overlap excessively", () => {
    // Basic check: no two objects share the exact same position
    for (let i = 0; i < ROOM_OBJECTS.length; i++) {
      for (let j = i + 1; j < ROOM_OBJECTS.length; j++) {
        const a = ROOM_OBJECTS[i];
        const b = ROOM_OBJECTS[j];
        const samePos = a.x === b.x && a.y === b.y;
        expect(samePos).toBe(false);
      }
    }
  });
});
