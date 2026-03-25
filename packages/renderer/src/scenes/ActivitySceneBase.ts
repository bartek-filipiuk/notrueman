import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";

export interface ActivitySceneData {
  duration: number;
  mood: string;
  onComplete: () => void;
}

/**
 * Base class for activity close-up scenes.
 * Handles: background loading, fade in/out, timer, cleanup.
 * Subclasses override addOverlays() for activity-specific effects.
 */
export abstract class ActivitySceneBase extends Phaser.Scene {
  protected duration = 12000;
  protected onComplete: (() => void) | null = null;
  private activityTimer?: Phaser.Time.TimerEvent;
  protected abstract bgKey: string;
  protected abstract label: string;
  protected abstract labelColor: string;

  init(data: ActivitySceneData): void {
    this.duration = data?.duration || 12000;
    this.onComplete = data?.onComplete || null;
  }

  create(): void {
    // Background
    if (this.textures.exists(this.bgKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.bgKey)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    } else {
      this.cameras.main.setBackgroundColor("#1a1a2e");
    }

    // Activity-specific overlays
    this.addOverlays();

    // HUD label
    this.add.text(GAME_WIDTH - 16, 12, this.label, {
      fontSize: "8px",
      fontFamily: "'Press Start 2P', monospace",
      color: this.labelColor,
    }).setOrigin(1, 0).setAlpha(0.4);

    // Fade in
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // End timer
    this.activityTimer = this.time.delayedCall(this.duration, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.onComplete?.();
      });
    });
  }

  /** Override to add activity-specific visual effects */
  protected abstract addOverlays(): void;

  /** Helper: create a particle texture */
  protected makeParticle(key: string, color: number, alpha = 0.5, size = 2): void {
    const g = this.add.graphics();
    g.fillStyle(color, alpha);
    g.fillCircle(size / 2, size / 2, size / 2);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  shutdown(): void {
    this.activityTimer?.destroy();
  }
}
