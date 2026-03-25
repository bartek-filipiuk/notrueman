import Phaser from "phaser";
import type { Position, InteractiveObjectId, ActivityType } from "@nts/shared";
import { ROOM_OBJECTS, ACTIVITY_ANCHORS, ROOM_FLOOR_TOP_Y, ROOM_FLOOR_BOTTOM_Y } from "@nts/shared";
import { TrumanSprite } from "../entities/TrumanSprite";

const WALK_SPEED = 80; // pixels per second

/**
 * Movement system: moves Truman to target positions.
 * Uses simple linear interpolation (no complex pathfinding for MVP).
 */
export class MovementSystem {
  private scene: Phaser.Scene;
  private truman: TrumanSprite;
  private moveResolve: (() => void) | null = null;
  private targetX = 0;
  private targetY = 0;
  private isMoving = false;

  constructor(scene: Phaser.Scene, truman: TrumanSprite) {
    this.scene = scene;
    this.truman = truman;
  }

  /** Move Truman to a specific position. Returns a promise that resolves on arrival. */
  moveTo(target: Position): Promise<void> {
    if (this.isMoving && this.moveResolve) {
      // Cancel previous movement
      this.moveResolve();
    }

    return new Promise<void>((resolve) => {
      this.moveResolve = resolve;
      this.targetX = target.x;
      this.targetY = target.y;
      this.isMoving = true;

      const direction = target.x > this.truman.x ? "right" : "left";
      this.truman.playWalk(direction);
    });
  }

  /** Move Truman to a room object by ID. */
  moveToObject(objectId: InteractiveObjectId): Promise<void> {
    const obj = ROOM_OBJECTS.find((o) => o.id === objectId);
    if (!obj) {
      return Promise.resolve();
    }
    // Target: center-bottom of object (Truman stands in front)
    return this.moveTo({
      x: obj.x + obj.width / 2,
      y: obj.y + obj.height,
    });
  }

  /** Call this in the scene's update loop */
  update(_time: number, delta: number): void {
    if (!this.isMoving) return;

    const dx = this.targetX - this.truman.x;
    const dy = this.targetY - this.truman.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 3) {
      // Arrived
      this.truman.x = this.targetX;
      this.truman.y = this.targetY;
      this.isMoving = false;
      this.truman.playIdle();

      if (this.moveResolve) {
        this.moveResolve();
        this.moveResolve = null;
      }
      return;
    }

    const step = (WALK_SPEED * delta) / 1000;
    const nx = dx / dist;
    const ny = dy / dist;

    this.truman.x = Phaser.Math.Clamp(this.truman.x + nx * step, 50, 910);
    this.truman.y = Phaser.Math.Clamp(this.truman.y + ny * step, ROOM_FLOOR_TOP_Y + 20, ROOM_FLOOR_BOTTOM_Y - 10);

    // Update facing direction based on horizontal movement
    if (Math.abs(dx) > 1) {
      const newFacing = dx > 0 ? "right" : "left";
      if (this.truman.getFacing() !== newFacing) {
        this.truman.playWalk(newFacing);
      }
    }
  }

  /** Move Truman to an activity anchor point (where he performs the activity) */
  moveToAnchor(activity: ActivityType): Promise<void> {
    const anchor = ACTIVITY_ANCHORS[activity];
    if (!anchor) {
      return Promise.resolve();
    }
    return this.moveTo({ x: anchor.x, y: anchor.y });
  }

  /** Check if Truman is currently moving */
  getIsMoving(): boolean {
    return this.isMoving;
  }
}
