import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";

interface ComputerSceneData {
  duration: number;
  mood: string;
  onComplete: () => void;
}

/**
 * Close-up scene: Truman at desk, typing on computer.
 * Layered approach:
 * - Layer 0: Desk background (static, FLUX generated)
 * - Layer 1: Truman body (sprite, breathing tween)
 * - Layer 2: Truman head (sprite, typing head-bob tween)
 * - Layer 3: Hands on keyboard (sprite, typing tween)
 * - Layer 4: Screen content (animated text), particles, overlays
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
    // === LAYER 0: Background (desk, monitors, room) ===
    if (this.textures.exists("scene_computer_bg")) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "scene_computer_bg");
      bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      bg.setDepth(0);
    } else {
      this.cameras.main.setBackgroundColor("#1a1a2e");
    }

    // === LAYER 1: Truman body (sitting, breathing bob) ===
    if (this.textures.exists("scene_computer_body")) {
      const body = this.add.image(380, 320, "scene_computer_body");
      body.setDisplaySize(280, 280);
      body.setDepth(10);

      // Breathing — subtle vertical bob
      this.tweens.add({
        targets: body,
        y: { from: 320, to: 317 },
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // === LAYER 2: Head (typing head-bob, faster than breathing) ===
    if (this.textures.exists("scene_computer_head")) {
      const head = this.add.image(390, 195, "scene_computer_head");
      head.setDisplaySize(90, 90);
      head.setDepth(15);

      // Head bob — quick nod rhythm following typing
      this.tweens.add({
        targets: head,
        y: { from: 195, to: 192 },
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      // Occasional deeper nod (every 3 seconds)
      this.time.addEvent({
        delay: 3000,
        loop: true,
        callback: () => {
          this.tweens.add({
            targets: head,
            y: { from: head.y, to: head.y + 4 },
            duration: 200,
            yoyo: true,
            ease: "Quad.easeOut",
          });
        },
      });
    }

    // === LAYER 3: Hands on keyboard (typing motion) ===
    if (this.textures.exists("scene_computer_hands")) {
      const hands = this.add.image(430, 380, "scene_computer_hands");
      hands.setDisplaySize(80, 40);
      hands.setDepth(20);

      // Typing motion — hands shift left/right alternating
      this.tweens.add({
        targets: hands,
        x: { from: 428, to: 435 },
        duration: 250,
        yoyo: true,
        repeat: -1,
        ease: "Stepped",
        // Stepped ease = instant snap between positions (pixel art feel)
      });

      // Slight vertical tap
      this.tweens.add({
        targets: hands,
        y: { from: 380, to: 382 },
        duration: 150,
        yoyo: true,
        repeat: -1,
        delay: 100,
      });
    }

    // === LAYER 4: Screen overlays ===

    // Monitor glow (pulsing)
    const glow1 = this.add.rectangle(620, 230, 160, 120, 0x55efc4, 0.05);
    glow1.setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    this.tweens.add({
      targets: glow1,
      alpha: { from: 0.03, to: 0.08 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });

    const glow2 = this.add.rectangle(170, 220, 130, 110, 0x55efc4, 0.04);
    glow2.setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    this.tweens.add({
      targets: glow2,
      alpha: { from: 0.02, to: 0.06 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      delay: 700,
    });

    // Typing cursor blink
    const cursor = this.add.rectangle(660, 270, 6, 10, 0x55efc4, 0.8);
    cursor.setDepth(6);
    this.tweens.add({
      targets: cursor,
      alpha: { from: 0.8, to: 0 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Scrolling code text on monitor (creates "living screen" effect)
    const codeLines = [
      "function think() {",
      "  const mood = getMood();",
      "  if (mood === 'curious') {",
      "    explore(world);",
      "  }",
      "  return reflect();",
      "}",
      "",
      "// What am I doing here?",
      "const life = observe();",
    ];
    let lineIdx = 0;
    const codeText = this.add.text(580, 200, "", {
      fontSize: "7px",
      fontFamily: "'Press Start 2P', monospace",
      color: "#55efc4",
      lineSpacing: 4,
    }).setDepth(6).setAlpha(0.6);

    this.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => {
        lineIdx = (lineIdx + 1) % codeLines.length;
        const visible = codeLines.slice(Math.max(0, lineIdx - 5), lineIdx + 1);
        codeText.setText(visible.join("\n"));
      },
    });

    // Coffee steam particles
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(1, 1, 2);
    g.generateTexture("cs_steam", 4, 4);
    g.destroy();

    this.add.particles(730, 330, "cs_steam", {
      speed: { min: 3, max: 8 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.4, end: 0.1 },
      alpha: { start: 0.25, end: 0 },
      lifespan: { min: 1500, max: 3000 },
      frequency: 500,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(25);

    // === HUD ===
    this.add.text(GAME_WIDTH - 20, 16, "coding...", {
      fontSize: "9px",
      fontFamily: "'Press Start 2P', monospace",
      color: "#55efc4",
    }).setOrigin(1, 0).setAlpha(0.5).setDepth(50);

    // === FADE IN ===
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // === END TIMER ===
    this.activityTimer = this.time.delayedCall(this.duration, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.onComplete?.();
      });
    });
  }

  shutdown(): void {
    if (this.activityTimer) {
      this.activityTimer.destroy();
    }
  }
}
