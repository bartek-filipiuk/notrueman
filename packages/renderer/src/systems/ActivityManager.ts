import Phaser from "phaser";
import type { ActivityType, InteractiveObjectId } from "@nts/shared";
import { ACTIVITY_LIST, ROOM_OBJECTS, ACTIVITY_ANCHORS } from "@nts/shared";
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

  /** Activities that trigger a close-up zoom scene */
  private static readonly ZOOM_ACTIVITIES: Set<ActivityType> = new Set(["computer"]);

  /** Manually trigger a specific activity */
  async doActivity(type: ActivityType): Promise<void> {
    this.state = "moving";
    this.currentActivity = type;
    this.notifyChange();

    // Move to anchor point (where Truman performs the activity)
    await this.movement.moveToAnchor(type);

    // Check if this activity has a close-up scene
    if (ActivityManager.ZOOM_ACTIVITIES.has(type)) {
      await this.launchZoomScene(type);
      return;
    }

    // Position at anchor + apply facing and offset
    const anchor = ACTIVITY_ANCHORS[type];
    if (anchor) {
      this.truman.setFacing(anchor.facing);
      if (anchor.poseOffsetX) this.truman.x += anchor.poseOffsetX;
      if (anchor.poseOffsetY) this.truman.y += anchor.poseOffsetY;
    }

    this.state = "performing";
    this.notifyChange();
    this.activityRenderer.playActivity(type);
    this.truman.setActivityPose(type);
  }

  /** Launch a close-up zoom scene for the activity */
  private async launchZoomScene(type: ActivityType): Promise<void> {
    this.state = "performing";
    this.notifyChange();

    const sceneKey = `${type.charAt(0).toUpperCase() + type.slice(1)}Scene`;

    // Check if scene exists
    if (!this.scene.scene.get(sceneKey)) {
      // Fallback to normal activity if scene not registered
      this.activityRenderer.playActivity(type);
      this.truman.setActivityPose(type);
      return;
    }

    return new Promise<void>((resolve) => {
      // Fade out room
      this.scene.cameras.main.fadeOut(400, 0, 0, 0);
      this.scene.cameras.main.once("camerafadeoutcomplete", () => {
        // Sleep room scene (preserves state)
        this.scene.scene.sleep("RoomScene");
        // Launch close-up scene
        this.scene.scene.launch(sceneKey, {
          duration: ACTIVITY_DURATION_MS,
          mood: "neutral",
          onComplete: () => {
            // Stop close-up scene
            this.scene.scene.stop(sceneKey);
            // Wake room scene
            this.scene.scene.wake("RoomScene");
            // Fade back in
            this.scene.cameras.main.fadeIn(400, 0, 0, 0);
            resolve();
          },
        });
      });
    });
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
            this.truman.setActivityPose(null); // revert to idle sprite
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
          this.truman.setActivityPose(null);
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
