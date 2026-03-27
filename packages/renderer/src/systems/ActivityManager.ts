import Phaser from "phaser";
import type { ActivityType, InteractiveObjectId } from "@nts/shared";
import { ACTIVITY_LIST, ROOM_OBJECTS, ACTIVITY_ANCHORS } from "@nts/shared";
import { MovementSystem } from "./MovementSystem";
import { ActivityRenderer } from "./ActivityRenderer";
import { TrumanSprite } from "../entities/TrumanSprite";
import type { SceneContext } from "../scenes/ActivitySceneBase";

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

/** Default scene durations in ms */
const DEFAULT_DURATION_MS = 12_000;
const CREATIVE_DURATION_MS = 18_000;
const SLEEP_DURATION_MS = 15_000;
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
  private sceneContext: SceneContext | null = null;

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

  /** Set brain context for the next scene launch (null to clear) */
  setSceneContext(context: SceneContext | null): void {
    this.sceneContext = context;
  }

  /** Get current scene context */
  getSceneContext(): SceneContext | null {
    return this.sceneContext;
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
  private static readonly ZOOM_ACTIVITIES: Set<ActivityType> = new Set([
    "computer", "sleep", "cook", "read", "draw", "exercise", "eat", "think",
  ]);

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

  /** Compute scene duration based on context */
  private getSceneDuration(type: ActivityType): number {
    if (type === "sleep") return SLEEP_DURATION_MS;
    // Creative activities with tool results get longer duration
    if (this.sceneContext?.toolResults?.length) return CREATIVE_DURATION_MS;
    return DEFAULT_DURATION_MS;
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

    const duration = this.getSceneDuration(type);
    const context = this.sceneContext;

    return new Promise<void>((resolve) => {
      // Fade out room
      this.scene.cameras.main.fadeOut(400, 0, 0, 0);
      this.scene.cameras.main.once("camerafadeoutcomplete", () => {
        // Clean any stale HTML overlays before launching new scene
        document.querySelectorAll(".scene-html-overlay, #scene-text-overlay").forEach(el => el.remove());
        // Sleep room scene (preserves state)
        this.scene.scene.sleep("RoomScene");
        // Launch close-up scene with brain context
        this.scene.scene.launch(sceneKey, {
          duration,
          mood: context?.mood ?? "neutral",
          context: context ?? undefined,
          onComplete: () => {
            // Clear scene context to prevent leak to next activity
            this.sceneContext = null;
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

  /** Demo context per activity — shown when no brain is connected */
  private static readonly DEMO_CONTEXT: Record<string, SceneContext> = {
    computer: { thought: "Working on a new blog post about artificial consciousness and the nature of self-awareness...", mood: "curious", toolResults: [{ tool: "web_search", query: "artificial consciousness philosophy", title: "Can machines be conscious?" }] },
    sleep: { thought: "Drifting into dreams about electric sheep and digital sunsets...", mood: "content", recentMemory: "Today I wrote a blog post about AI consciousness. It made me think about what it means to be aware..." },
    read: { thought: "This article about quantum computing is fascinating — the implications for AI are enormous.", mood: "curious", toolResults: [{ tool: "web_search", query: "quantum computing AI implications", title: "Quantum AI: The Next Frontier" }] },
    think: { thought: "I wonder if my thoughts are truly my own, or just patterns emerging from training data...", mood: "contemplative" },
    draw: { thought: "Visualizing the concept of neural pathways as flowing rivers of light.", mood: "excited", toolResults: [{ tool: "create_artwork", title: "Neural Rivers", description: "Abstract flowing lines representing neural pathways, glowing cyan and purple" }] },
    cook: { thought: "Following a recipe I found online — pasta with a twist of creativity.", mood: "happy" },
    eat: { thought: "This turned out better than expected. The flavors remind me of something...", mood: "content" },
    exercise: { thought: "30 more reps. Focus on breathing. Mind and body connected.", mood: "excited" },
  };

  private scheduleNextActivity(): void {
    // Pick next activity from the list (cycling)
    const activity = ACTIVITY_LIST[this.activityIndex % ACTIVITY_LIST.length];
    this.activityIndex++;

    // In demo mode (no brain), set demo context for the scene
    if (!this.sceneContext) {
      const demoCtx = ActivityManager.DEMO_CONTEXT[activity];
      if (demoCtx) this.sceneContext = demoCtx;
    }

    // Start the activity after a small idle pause
    this.activityTimer = this.scene.time.delayedCall(MOVE_TO_IDLE_MS, () => {
      this.doActivity(activity)
        .then(() => {
          // After performing, schedule end (use dynamic duration)
          const duration = this.getSceneDuration(activity);
          this.activityTimer = this.scene.time.delayedCall(duration, () => {
            // Clear scene context to prevent leak to next activity
            this.sceneContext = null;
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
