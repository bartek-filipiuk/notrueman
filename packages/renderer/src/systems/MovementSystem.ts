import Phaser from "phaser";
import type { Position, InteractiveObjectId, ActivityType } from "@nts/shared";
import { ROOM_OBJECTS, ACTIVITY_ANCHORS, ROOM_FLOOR_TOP_Y, ROOM_FLOOR_BOTTOM_Y } from "@nts/shared";
import { TrumanSprite } from "../entities/TrumanSprite";
import { NavMeshSystem } from "./NavMeshSystem";

const WALK_SPEED = 90; // pixels per second (slightly faster for larger floor)

/**
 * Movement system with NavMesh pathfinding and easing.
 * Truman follows waypoints around obstacles with smooth acceleration/deceleration.
 */
export class MovementSystem {
  private scene: Phaser.Scene;
  private truman: TrumanSprite;
  private navMesh: NavMeshSystem;
  private moveResolve: (() => void) | null = null;
  private isMoving = false;

  /** Waypoints to follow (from navmesh pathfinding) */
  private waypoints: Position[] = [];
  /** Total path length for easing calculation */
  private totalPathLength = 0;
  /** Distance traveled so far */
  private distanceTraveled = 0;

  constructor(scene: Phaser.Scene, truman: TrumanSprite) {
    this.scene = scene;
    this.truman = truman;
    this.navMesh = new NavMeshSystem();
  }

  /** Move Truman to a specific position via navmesh pathfinding. */
  moveTo(target: Position): Promise<void> {
    if (this.isMoving && this.moveResolve) {
      this.moveResolve();
    }

    return new Promise<void>((resolve) => {
      this.moveResolve = resolve;

      // Find path via navmesh
      const from = { x: this.truman.x, y: this.truman.y };
      const path = this.navMesh.findPath(from, target);

      if (path && path.length > 1) {
        // Use navmesh path (skip first point = current position)
        this.waypoints = path.slice(1);
      } else {
        // Fallback: direct line to target
        this.waypoints = [target];
      }

      // Calculate total path length for easing
      this.totalPathLength = this.calculatePathLength(from, this.waypoints);
      this.distanceTraveled = 0;
      this.isMoving = true;

      const dx = this.waypoints[0].x - this.truman.x;
      const direction = dx > 0 ? "right" : "left";
      this.truman.playWalk(direction);
    });
  }

  /** Move Truman to a room object by ID. */
  moveToObject(objectId: InteractiveObjectId): Promise<void> {
    const obj = ROOM_OBJECTS.find((o) => o.id === objectId);
    if (!obj) return Promise.resolve();
    return this.moveTo({ x: obj.x, y: obj.y });
  }

  /** Move Truman to an activity anchor point. */
  moveToAnchor(activity: ActivityType): Promise<void> {
    const anchor = ACTIVITY_ANCHORS[activity];
    if (!anchor) return Promise.resolve();
    return this.moveTo({ x: anchor.x, y: anchor.y });
  }

  /** Call this in the scene's update loop */
  update(_time: number, delta: number): void {
    if (!this.isMoving || this.waypoints.length === 0) return;

    const target = this.waypoints[0];
    const dx = target.x - this.truman.x;
    const dy = target.y - this.truman.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Arrived at current waypoint
    if (dist < 4) {
      this.truman.x = target.x;
      this.truman.y = target.y;
      this.waypoints.shift();

      if (this.waypoints.length === 0) {
        // Reached final destination
        this.isMoving = false;
        this.truman.playIdle();
        if (this.moveResolve) {
          this.moveResolve();
          this.moveResolve = null;
        }
        return;
      }

      // Update facing for next waypoint
      const nextDx = this.waypoints[0].x - this.truman.x;
      if (Math.abs(nextDx) > 1) {
        const newFacing = nextDx > 0 ? "right" : "left";
        if (this.truman.getFacing() !== newFacing) {
          this.truman.playWalk(newFacing);
        }
      }
      return;
    }

    // Easing: ease-in for first 20%, ease-out for last 20% of total path
    const progress = this.totalPathLength > 0
      ? this.distanceTraveled / this.totalPathLength
      : 0.5;
    const speedMultiplier = this.getEasingMultiplier(progress);

    const step = (WALK_SPEED * speedMultiplier * delta) / 1000;
    const nx = dx / dist;
    const ny = dy / dist;
    const actualStep = Math.min(step, dist); // don't overshoot

    this.truman.x = Phaser.Math.Clamp(this.truman.x + nx * actualStep, 50, 910);
    this.truman.y = Phaser.Math.Clamp(
      this.truman.y + ny * actualStep,
      ROOM_FLOOR_TOP_Y + 20,
      ROOM_FLOOR_BOTTOM_Y - 10,
    );
    this.distanceTraveled += actualStep;

    // Update facing direction
    if (Math.abs(dx) > 1) {
      const newFacing = dx > 0 ? "right" : "left";
      if (this.truman.getFacing() !== newFacing) {
        this.truman.playWalk(newFacing);
      }
    }
  }

  /** Easing profile: slow start, full speed middle, slow end */
  private getEasingMultiplier(progress: number): number {
    if (progress < 0.2) {
      // Ease-in (0→1 over first 20%)
      const t = progress / 0.2;
      return 0.3 + 0.7 * Phaser.Math.Easing.Sine.Out(t);
    } else if (progress > 0.8) {
      // Ease-out (1→0.3 over last 20%)
      const t = (progress - 0.8) / 0.2;
      return 1.0 - 0.7 * Phaser.Math.Easing.Sine.In(t);
    }
    return 1.0; // Full speed in middle
  }

  /** Calculate total length of a path */
  private calculatePathLength(start: Position, waypoints: Position[]): number {
    let length = 0;
    let prev = start;
    for (const wp of waypoints) {
      length += Phaser.Math.Distance.Between(prev.x, prev.y, wp.x, wp.y);
      prev = wp;
    }
    return length;
  }

  getIsMoving(): boolean {
    return this.isMoving;
  }

  /** Get navmesh system for debug overlay */
  getNavMesh(): NavMeshSystem {
    return this.navMesh;
  }
}
