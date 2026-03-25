import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, ROOM_OBJECTS } from "@nts/shared";

const TIPS = [
  "Truman doesn't know you're watching.",
  "Press ~ to open the debug panel.",
  "Add ?apiKey=... to the URL for AI mode.",
  "Truman's mood affects his thought bubbles.",
  "Every activity has a 25% chance of failure.",
  "Truman is a curious introvert with dry humor.",
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // Try to load AI-generated PNG sprites. If files don't exist, Phaser
    // silently fails and RoomScene falls back to programmatic sprites.
    for (const obj of ROOM_OBJECTS) {
      this.load.image(`png_${obj.id}`, `sprites/objects/${obj.id}.png`);
    }
    // Truman mood sprites
    const moods = ["idle", "mood_happy", "mood_curious", "mood_anxious", "mood_frustrated", "mood_excited", "mood_content", "mood_contemplative", "mood_bored"];
    // Activity pose sprites
    const poses = ["sleep", "computer", "eat", "read", "exercise", "think", "cook", "draw"];
    for (const pose of poses) {
      this.load.image(`truman_pose_${pose}`, `sprites/truman/pose_${pose}.png`);
    }
    for (const mood of moods) {
      this.load.image(`truman_${mood}`, `sprites/truman/${mood}.png`);
    }
    // Room background
    this.load.image("room_background", "sprites/room_background.png");
    // Close-up scene assets
    // Computer close-up scene (layered)
    this.load.image("scene_computer_bg", "sprites/scenes/computer_bg.png");
    this.load.image("scene_computer_body", "sprites/scenes/computer_body.png");
    this.load.image("scene_computer_head", "sprites/scenes/computer_head.png");
    this.load.image("scene_computer_hands", "sprites/scenes/computer_hands.png");
    this.load.image("truman_scene_computer", "sprites/truman/scene_computer.png");
    // Tiled room layout (object positions)
    this.load.tilemapTiledJSON("room-map", "tilemaps/room.json");
    // Tiles
    this.load.image("tile_floor", "sprites/tiles/floor.png");
    this.load.image("tile_wall", "sprites/tiles/wall.png");

    // Suppress load errors for missing files (graceful fallback)
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      // Silently ignore — programmatic sprites will be used
    });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Dark background
    this.cameras.main.setBackgroundColor("#0a0a1a");

    // Title with warm glow
    const title = this.add
      .text(cx, cy - 40, "No True Man Show", {
        fontSize: "20px",
        fontFamily: "'Press Start 2P', monospace",
        color: "#ffd93d",
        align: "center",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Subtitle
    const subtitle = this.add
      .text(cx, cy, "a life, observed", {
        fontSize: "10px",
        fontFamily: "'Press Start 2P', monospace",
        color: "#6ec6ff",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Loading dots (animated)
    const loading = this.add
      .text(cx, cy + 50, "...", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#555555",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Random tip
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    const tipText = this.add
      .text(cx, GAME_HEIGHT - 40, tip, {
        fontSize: "8px",
        fontFamily: "'Press Start 2P', monospace",
        color: "#444444",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Fade in sequence
    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 600,
      ease: "Power2",
    });

    this.tweens.add({
      targets: subtitle,
      alpha: 0.8,
      duration: 500,
      delay: 400,
      ease: "Power2",
    });

    this.tweens.add({
      targets: [loading, tipText],
      alpha: 0.6,
      duration: 400,
      delay: 700,
    });

    // Animate loading dots
    let dotFrame = 0;
    this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        dotFrame = (dotFrame + 1) % 4;
        loading.setText(".".repeat(dotFrame + 1));
      },
    });

    // Fade out and transition
    this.time.delayedCall(2000, () => {
      this.cameras.main.fadeOut(500, 10, 10, 26);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("RoomScene");
      });
    });
  }
}
