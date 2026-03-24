import Phaser from "phaser";
import type { ActivityType, InteractiveObjectId } from "@nts/shared";
import { ACTIVITY_LIST, ROOM_OBJECTS } from "@nts/shared";
import { MovementSystem } from "./MovementSystem";
import { ActivityRenderer } from "./ActivityRenderer";
import { TrumanSprite } from "../entities/TrumanSprite";

/** Maps activity types to the room object where they take place */
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

/** Activity durations in ms for the test/demo loop */
const ACTIVITY_DURATION_MS = 12_000;
const MOVE_TO_IDLE_MS = 1_000;

type ActivityState = "idle" | "moving" | "performing";

/**
 * Manages the activity lifecycle: idle → move to object → perform activity → idle.
 * In this demo version, cycles through a hardcoded sequence every 15 seconds.
 */
export class ActivityManager {
  private scene: Phaser.Scene;
  private truman: TrumanSprite;
  private movement: MovementSystem;
  private activityRenderer: ActivityRenderer;

  private state: ActivityState = "idle";
  private currentActivity: ActivityType | null = null;
  private activityIndex = 0;
  private activityTimer?: Phaser.Time.TimerEvent;

  private onActivityChange?: (activity: ActivityType | null, state: ActivityState) => void;

  constructor(
    scene: Phaser.Scene,
    truman: TrumanSprite,
    movement: MovementSystem,
    activityRenderer: ActivityRenderer,
  ) {
    this.scene = scene;
    this.truman = truman;
    this.movement = movement;
    this.activityRenderer = activityRenderer;
  }

  /** Start the automated activity loop */
  startLoop(): void {
    this.scheduleNextActivity();
  }

  /** Stop the loop */
  stopLoop(): void {
    if (this.activityTimer) {
      this.activityTimer.destroy();
      this.activityTimer = undefined;
    }
    this.activityRenderer.stopActivity();
    this.state = "idle";
    this.currentActivity = null;
  }

  /** Manually trigger a specific activity */
  async doActivity(type: ActivityType): Promise<void> {
    this.state = "moving";
    this.currentActivity = type;
    this.notifyChange();

    const targetObject = ACTIVITY_OBJECTS[type];
    await this.movement.moveToObject(targetObject);

    this.state = "performing";
    this.notifyChange();
    this.activityRenderer.playActivity(type);
  }

  /** Register a callback for activity changes */
  setOnActivityChange(cb: (activity: ActivityType | null, state: ActivityState) => void): void {
    this.onActivityChange = cb;
  }

  private scheduleNextActivity(): void {
    // Pick next activity from the list (cycling)
    const activity = ACTIVITY_LIST[this.activityIndex % ACTIVITY_LIST.length];
    this.activityIndex++;

    // Start the activity after a small idle pause
    this.activityTimer = this.scene.time.delayedCall(MOVE_TO_IDLE_MS, () => {
      this.doActivity(activity)
        .then(() => {
          // After performing, schedule end
          this.activityTimer = this.scene.time.delayedCall(ACTIVITY_DURATION_MS, () => {
            this.activityRenderer.stopActivity();
            this.truman.playIdle();
            this.state = "idle";
            this.currentActivity = null;
            this.notifyChange();
            this.scheduleNextActivity();
          });
        })
        .catch(() => {
          // Graceful recovery: reset to idle and continue loop
          this.activityRenderer.stopActivity();
          this.truman.playIdle();
          this.state = "idle";
          this.currentActivity = null;
          this.notifyChange();
          this.scheduleNextActivity();
        });
    });
  }

  private notifyChange(): void {
    if (this.onActivityChange) {
      this.onActivityChange(this.currentActivity, this.state);
    }
  }

  /** Get current state */
  getState(): ActivityState {
    return this.state;
  }

  /** Get current activity */
  getCurrentActivity(): ActivityType | null {
    return this.currentActivity;
  }
}
