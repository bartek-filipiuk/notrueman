import type { RendererHandler } from "@nts/agent-brain";
import type { InteractiveObjectId } from "@nts/shared";
import type { RoomScene } from "../scenes/RoomScene";

/**
 * Adapts RoomScene to the RendererHandler interface expected by BrainLoop.
 * This is the bridge between AI decisions and Phaser visual execution.
 */
export class SceneHandler implements RendererHandler {
  private scene: RoomScene;

  constructor(scene: RoomScene) {
    this.scene = scene;
  }

  async moveTo(objectId: InteractiveObjectId): Promise<void> {
    const movement = this.scene.getMovement();
    await movement.moveToObject(objectId);
  }

  playActivity(activity: string): void {
    const activityRenderer = this.scene.getActivityRenderer();
    activityRenderer.playActivity(activity as any);
  }

  showThought(text: string, mood: string): void {
    this.scene.showThought(text, mood);
  }

  updateHUD(update: { mood?: string; activity?: string; time?: string }): void {
    const hud = this.scene.getHUD();
    if (update.mood) {
      hud.updateMood(update.mood);
      // Update Truman's facial expression based on mood
      this.scene.getTruman().setMood(update.mood);
    }
    if (update.activity) hud.updateActivity(update.activity);
  }
}
