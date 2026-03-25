import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";

interface ComputerSceneData {
  duration: number;
  mood: string;
  onComplete: () => void;
}

/**
 * Close-up scene: Truman sitting at desk, typing on computer.
 * Launched when Truman performs "computer" activity.
 * Shows detailed desk view with typing animation.
 */
export class ComputerScene extends Phaser.Scene {
  private duration = 12000;
  private onComplete: (() => void) | null = null;
  private trumanSprite!: Phaser.GameObjects.Image;
  private activityTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: "ComputerScene" });
  }

  init(data: ComputerSceneData): void {
    this.duration = data?.duration || 12000;
    this.onComplete = data?.onComplete || null;
  }

  create(): void {
    // Background — close-up desk scene
    if (this.textures.exists("scene_computer_bg")) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "scene_computer_bg");
      bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    } else {
      // Fallback: dark background
      this.cameras.main.setBackgroundColor("#1a1a2e");
    }

    // Truman sprite — sitting at desk, typing
    if (this.textures.exists("truman_scene_computer")) {
      this.trumanSprite = this.add.image(300, 340, "truman_scene_computer");
      this.trumanSprite.setDisplaySize(220, 220);
    }

    // Typing bob animation (subtle up/down)
    if (this.trumanSprite) {
      this.tweens.add({
        targets: this.trumanSprite,
        y: { from: 340, to: 336 },
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Screen glow particle effect
    const g = this.add.graphics();
    g.fillStyle(0x55efc4, 0.8);
    g.fillRect(0, 0, 3, 3);
    g.generateTexture("scene_typing_particle", 3, 3);
    g.destroy();

    this.add.particles(GAME_WIDTH / 2 + 50, GAME_HEIGHT / 2 - 40, "scene_typing_particle", {
      speed: { min: 5, max: 20 },
      angle: { min: 240, max: 300 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 2000,
      frequency: 500,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });

    // Fade in
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // HUD — activity label
    this.add.text(GAME_WIDTH - 20, 20, "computer", {
      fontSize: "10px",
      fontFamily: "'Press Start 2P', monospace",
      color: "#55efc4",
    }).setOrigin(1, 0).setAlpha(0.7);

    // End timer
    this.activityTimer = this.time.delayedCall(this.duration, () => {
      this.endScene();
    });
  }

  private endScene(): void {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      if (this.onComplete) {
        this.onComplete();
      }
    });
  }

  shutdown(): void {
    if (this.activityTimer) {
      this.activityTimer.destroy();
    }
  }
}
