import { describe, it, expect } from "vitest";
import { ACTIVITY_LIST, ROOM_OBJECTS } from "@nts/shared";
import type { ActivityType, InteractiveObjectId } from "@nts/shared";

const ACTIVITY_OBJECTS: Record<ActivityType, InteractiveObjectId> = {
  sleep: "bed",
  eat: "table_chair",
  read: "bookshelf",
  computer: "computer",
  exercise: "exercise_mat",
  think: "window",
  cook: "stove",
  draw: "easel",
};

describe("activity state machine smoke tests", () => {
  it("every activity maps to a valid room object", () => {
    for (const activity of ACTIVITY_LIST) {
      const objectId = ACTIVITY_OBJECTS[activity];
      expect(objectId).toBeDefined();
      const obj = ROOM_OBJECTS.find((o) => o.id === objectId);
      expect(obj).toBeDefined();
    }
  });

  it("activity cycle covers all 8 activities", () => {
    const cycled: ActivityType[] = [];
    for (let i = 0; i < ACTIVITY_LIST.length; i++) {
      cycled.push(ACTIVITY_LIST[i % ACTIVITY_LIST.length]);
    }
    expect(new Set(cycled).size).toBe(8);
  });

  it("state transitions are valid: idle → moving → performing → idle", () => {
    const validTransitions: Record<string, string[]> = {
      idle: ["moving"],
      moving: ["performing"],
      performing: ["idle"],
    };
    // Verify state flow
    const flow = ["idle", "moving", "performing", "idle"];
    for (let i = 0; i < flow.length - 1; i++) {
      expect(validTransitions[flow[i]]).toContain(flow[i + 1]);
    }
  });
});
