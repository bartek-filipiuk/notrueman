import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";

interface ComputerSceneData {
  duration: number;
  mood: string;
  onComplete: () => void;
}

/**
 * Close-up scene: Truman at desk, typing on computer.
 * One full-screen background image (Truman baked in) + animated overlays:
 * - Screen glow (pulsing green)
 * - Coffee steam (particles)
 * - Typing cursor blink
 * - Thought bubble after a few seconds
 */
export class ComputerScene extends Phaser.Scene {
  private duration = 12000;
  private onComplete: (() => void) | null = null;
  private activityTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: "ComputerScene" });
  }

  init(data: ComputerSceneData): void {
    this.duration = data?.duration || 12000;
    this.onComplete = data?.onComplete || null;
  }

  create(): void {
    // Full-screen background with Truman baked in
    if (this.textures.exists("scene_computer_bg")) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "scene_computer_bg");
      bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    } else {
      this.cameras.main.setBackgroundColor("#1a1a2e");
    }

    // === ANIMATED OVERLAYS ===

    // 1. Screen glow — pulsing green rectangle over monitor area
    const screenGlow = this.add.rectangle(580, 220, 180, 130, 0x55efc4, 0.06);
    screenGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: screenGlow,
      alpha: { from: 0.04, to: 0.10 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // 2. Second monitor glow (left side)
    const screenGlow2 = this.add.rectangle(150, 200, 140, 120, 0x55efc4, 0.05);
    screenGlow2.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: screenGlow2,
      alpha: { from: 0.03, to: 0.08 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: 500,
    });

    // 3. Typing cursor blink on monitor
    const cursor = this.add.rectangle(620, 260, 8, 12, 0x55efc4, 0.9);
    this.tweens.add({
      targets: cursor,
      alpha: { from: 0.9, to: 0 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // 4. Coffee steam particles
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(1, 1, 2);
    g.generateTexture("steam_particle", 4, 4);
    g.destroy();

    this.add.particles(200, 370, "steam_particle", {
      speed: { min: 3, max: 8 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.5, end: 0.1 },
      alpha: { start: 0.3, end: 0 },
      lifespan: { min: 1500, max: 3000 },
      frequency: 400,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });

    // 5. Lamp light flicker (very subtle)
    const lampGlow = this.add.circle(280, 160, 30, 0xffa726, 0.04);
    lampGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: lampGlow,
      alpha: { from: 0.03, to: 0.06 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // 6. Subtle head bob (Truman "typing" — move a thin overlay area)
    // We create a very subtle full-screen overlay that shifts slightly
    // to give illusion of movement without separate sprite
    const typingBob = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0);
    this.tweens.add({
      targets: typingBob,
      y: { from: GAME_HEIGHT / 2, to: GAME_HEIGHT / 2 - 1 },
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // === HUD ===
    this.add.text(GAME_WIDTH - 20, 16, "coding...", {
      fontSize: "9px",
      fontFamily: "'Press Start 2P', monospace",
      color: "#55efc4",
    }).setOrigin(1, 0).setAlpha(0.6);

    // === FADE IN ===
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // === END TIMER ===
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
