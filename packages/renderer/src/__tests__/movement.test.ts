import { describe, it, expect } from "vitest";
import { ROOM_OBJECTS } from "@nts/shared";

describe("movement system data tests", () => {
  it("all room objects have valid target positions (center-bottom)", () => {
    for (const obj of ROOM_OBJECTS) {
      const targetX = obj.x + obj.width / 2;
      const targetY = obj.y + obj.height;
      expect(targetX).toBeGreaterThan(0);
      expect(targetY).toBeGreaterThan(0);
      expect(targetX).toBeLessThanOrEqual(960);
      expect(targetY).toBeLessThanOrEqual(540);
    }
  });

  it("distance between any two objects is calculable", () => {
    const bed = ROOM_OBJECTS.find((o) => o.id === "bed")!;
    const desk = ROOM_OBJECTS.find((o) => o.id === "desk")!;
    const dx = (desk.x + desk.width / 2) - (bed.x + bed.width / 2);
    const dy = (desk.y + desk.height) - (bed.y + bed.height);
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeGreaterThan(0);
  });

  it("walk speed of 80px/s covers room in reasonable time", () => {
    const WALK_SPEED = 80;
    // Max diagonal: ~sqrt(960^2 + 540^2) ≈ 1101 px
    const maxDist = Math.sqrt(960 * 960 + 540 * 540);
    const maxTime = maxDist / WALK_SPEED;
    // Should take less than 15 seconds to cross the entire room
    expect(maxTime).toBeLessThan(15);
  });
});
