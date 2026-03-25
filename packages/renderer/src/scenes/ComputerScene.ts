import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";

interface ComputerSceneData {
  duration: number;
  mood: string;
  onComplete: () => void;
}

/**
 * Close-up coding scene. Single FLUX image with Truman baked in.
 * Animated overlays bring the scene to life:
 * - Scrolling code on monitors
 * - Blinking cursor
 * - Coffee steam particles
 * - Monitor glow pulse
 * - Thought bubble after delay
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
    // === ONE BACKGROUND IMAGE (Truman baked in) ===
    if (this.textures.exists("scene_computer_bg")) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "scene_computer_bg")
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    } else {
      this.cameras.main.setBackgroundColor("#1a1a2e");
    }

    // === SCROLLING CODE on right monitor ===
    const codeLines = [
      "function think() {",
      "  const mood = getMood();",
      "  if (mood === 'curious') {",
      "    explore(world);",
      "  }",
      "  return reflect();",
      "}",
      "",
      "// I wonder what's",
      "// beyond that door...",
      "",
      "async function live() {",
      "  while (true) {",
      "    await decide();",
      "    act();",
      "    remember();",
      "  }",
      "}",
    ];
    let lineIdx = 0;
    const codeText = this.add.text(540, 160, "", {
      fontSize: "6px",
      fontFamily: "'Press Start 2P', monospace",
      color: "#44dd88",
      lineSpacing: 3,
      wordWrap: { width: 160 },
    }).setAlpha(0.7);

    // Typewriter effect — add one line at a time
    this.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => {
        lineIdx++;
        const start = Math.max(0, lineIdx - 8);
        const visible = codeLines.slice(start, lineIdx % codeLines.length + 1);
        codeText.setText(visible.join("\n"));
        if (lineIdx >= codeLines.length) lineIdx = 0;
      },
    });

    // === BLINKING CURSOR ===
    const cursor = this.add.rectangle(605, 240, 5, 8, 0x44dd88, 0.9);
    this.tweens.add({
      targets: cursor,
      alpha: { from: 0.9, to: 0 },
      duration: 530,
      yoyo: true,
      repeat: -1,
    });

    // === MONITOR GLOW (subtle pulse) ===
    const glow = this.add.rectangle(560, 210, 170, 120, 0x33cc77, 0.03);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.02, to: 0.06 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Left monitor glow
    const glow2 = this.add.rectangle(180, 200, 140, 110, 0x33cc77, 0.02);
    glow2.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: glow2,
      alpha: { from: 0.01, to: 0.04 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      delay: 800,
    });

    // === COFFEE STEAM ===
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(1, 1, 2);
    g.generateTexture("cs_steam", 4, 4);
    g.destroy();

    this.add.particles(170, 350, "cs_steam", {
      speed: { min: 2, max: 6 },
      angle: { min: 255, max: 285 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.2, end: 0 },
      lifespan: { min: 2000, max: 4000 },
      frequency: 600,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });

    // === SCREEN FLICKER (occasional, very subtle) ===
    this.time.addEvent({
      delay: 4000 + Math.random() * 3000,
      loop: true,
      callback: () => {
        const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x55efc4, 0.02);
        flash.setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          duration: 150,
          onComplete: () => flash.destroy(),
        });
      },
    });

    // === HUD ===
    this.add.text(GAME_WIDTH - 16, 12, "coding...", {
      fontSize: "8px",
      fontFamily: "'Press Start 2P', monospace",
      color: "#44dd88",
    }).setOrigin(1, 0).setAlpha(0.4);

    // === FADE IN ===
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // === END ===
    this.activityTimer = this.time.delayedCall(this.duration, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.onComplete?.();
      });
    });
  }

  shutdown(): void {
    this.activityTimer?.destroy();
  }
}
