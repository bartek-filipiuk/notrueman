import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, ROOM_OBJECTS } from "@nts/shared";
import type { InteractiveObjectId, RoomZone } from "@nts/shared";
import { TrumanSprite } from "../entities/TrumanSprite";
import { MovementSystem } from "../systems/MovementSystem";
import { ActivityRenderer } from "../systems/ActivityRenderer";
import { ActivityManager } from "../systems/ActivityManager";
import { HUD } from "../ui/HUD";
import { ThoughtBubble } from "../ui/ThoughtBubble";

/** Zone-based color palette for placeholder objects */
const ZONE_COLORS: Record<RoomZone, number> = {
  sleep: 0x3949ab,    // indigo
  kitchen: 0xef6c00,  // orange
  work: 0x558b2f,     // green
  creative: 0xad1457,  // pink
  exercise: 0x00838f, // cyan
  reading: 0x6a1b9a,  // purple
  window: 0xfdd835,   // yellow
  door: 0x795548,     // brown
};

/** Floor and wall colors */
const WALL_COLOR = 0x2c2c54;
const FLOOR_COLOR = 0x474787;
const FLOOR_Y = 460;

/** Window glow color for ambient lighting — exported for tests */
export const WINDOW_GLOW_COLOR = 0xfdd835;

export class RoomScene extends Phaser.Scene {
  private roomObjects = new Map<InteractiveObjectId, Phaser.GameObjects.Rectangle>();
  private truman!: TrumanSprite;
  private movement!: MovementSystem;
  private activityRenderer!: ActivityRenderer;
  private activityManager!: ActivityManager;
  private hud!: HUD;
  private thoughtBubble!: ThoughtBubble;

  constructor() {
    super({ key: "RoomScene" });
  }

  create(): void {
    this.createBackground();
    this.createRoomObjects();
    this.createObjectLabels();
    this.createTruman();
  }

  update(time: number, delta: number): void {
    this.movement.update(time, delta);
    this.activityRenderer.update();
    this.hud.updateTime();
  }

  /** Clean up all timers and tweens when scene shuts down */
  shutdown(): void {
    this.activityManager.stopLoop();
    this.activityRenderer.stopActivity();
    this.thoughtBubble.hide();
  }

  private createTruman(): void {
    this.truman = new TrumanSprite(this, GAME_WIDTH / 2, 400);
    this.movement = new MovementSystem(this, this.truman);
    this.activityRenderer = new ActivityRenderer(this, this.truman);
    this.activityManager = new ActivityManager(this, this.truman, this.movement, this.activityRenderer);

    this.hud = new HUD(this);
    this.thoughtBubble = new ThoughtBubble(this);
    this.activityManager.setOnActivityChange((activity, state) => {
      this.hud.updateActivity(activity ? `${activity} (${state})` : "Idle");
    });

    this.activityManager.startLoop();
  }

  getTruman(): TrumanSprite {
    return this.truman;
  }

  getMovement(): MovementSystem {
    return this.movement;
  }

  getActivityRenderer(): ActivityRenderer {
    return this.activityRenderer;
  }

  getActivityManager(): ActivityManager {
    return this.activityManager;
  }

  /** Show a thought bubble above Truman */
  showThought(text: string, mood: string): void {
    this.thoughtBubble.showThought(text, mood, this.truman.x, this.truman.y);
  }

  getThoughtBubble(): ThoughtBubble {
    return this.thoughtBubble;
  }

  getHUD(): HUD {
    return this.hud;
  }

  private createBackground(): void {
    // Wall
    this.add.rectangle(GAME_WIDTH / 2, FLOOR_Y / 2, GAME_WIDTH, FLOOR_Y, WALL_COLOR).setOrigin(0.5);

    // Subtle wall shading (darker at top for depth)
    this.add.rectangle(GAME_WIDTH / 2, 20, GAME_WIDTH, 40, 0x1a1a3e).setOrigin(0.5).setAlpha(0.3);

    // Floor
    this.add
      .rectangle(GAME_WIDTH / 2, FLOOR_Y + (GAME_HEIGHT - FLOOR_Y) / 2, GAME_WIDTH, GAME_HEIGHT - FLOOR_Y, FLOOR_COLOR)
      .setOrigin(0.5);

    // Floor highlight (subtle lighter stripe for depth)
    this.add
      .rectangle(GAME_WIDTH / 2, FLOOR_Y + 8, GAME_WIDTH, 4, 0x5a57a0)
      .setOrigin(0.5)
      .setAlpha(0.4);

    // Floor line
    this.add
      .line(0, 0, 0, FLOOR_Y, GAME_WIDTH, FLOOR_Y, 0x706fd3)
      .setOrigin(0);

    // Window ambient glow (soft light spilling from window into room)
    const windowObj = ROOM_OBJECTS.find((o) => o.id === "window");
    if (windowObj) {
      const glow = this.add.graphics();
      glow.fillStyle(WINDOW_GLOW_COLOR, 0.06);
      glow.fillTriangle(
        windowObj.x + windowObj.width / 2, windowObj.y + windowObj.height,
        windowObj.x - 40, FLOOR_Y,
        windowObj.x + windowObj.width + 40, FLOOR_Y,
      );
      glow.setDepth(0);
    }
  }

  private createRoomObjects(): void {
    for (const obj of ROOM_OBJECTS) {
      const color = ZONE_COLORS[obj.zone];
      const rect = this.add
        .rectangle(obj.x, obj.y, obj.width, obj.height, color, 0.8)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0xffffff, 0.3);

      this.roomObjects.set(obj.id, rect);
    }
  }

  private createObjectLabels(): void {
    for (const obj of ROOM_OBJECTS) {
      this.add
        .text(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.label, {
          fontSize: "9px",
          color: "#ffffff",
          fontFamily: "monospace",
          align: "center",
        })
        .setOrigin(0.5);
    }
  }

  getRoomObject(id: InteractiveObjectId): Phaser.GameObjects.Rectangle | undefined {
    return this.roomObjects.get(id);
  }
}
