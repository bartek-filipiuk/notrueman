import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, ROOM_OBJECTS } from "@nts/shared";
import type { InteractiveObjectId, RoomZone } from "@nts/shared";
import { TrumanSprite } from "../entities/TrumanSprite";
import { MovementSystem } from "../systems/MovementSystem";
import { ActivityRenderer } from "../systems/ActivityRenderer";
import { ActivityManager } from "../systems/ActivityManager";
import { HUD } from "../ui/HUD";

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

export class RoomScene extends Phaser.Scene {
  private roomObjects = new Map<InteractiveObjectId, Phaser.GameObjects.Rectangle>();
  private truman!: TrumanSprite;
  private movement!: MovementSystem;
  private activityRenderer!: ActivityRenderer;
  private activityManager!: ActivityManager;
  private hud!: HUD;

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

  private createTruman(): void {
    this.truman = new TrumanSprite(this, GAME_WIDTH / 2, 400);
    this.movement = new MovementSystem(this, this.truman);
    this.activityRenderer = new ActivityRenderer(this, this.truman);
    this.activityManager = new ActivityManager(this, this.truman, this.movement, this.activityRenderer);

    this.hud = new HUD(this);
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

  private createBackground(): void {
    // Wall
    this.add.rectangle(GAME_WIDTH / 2, FLOOR_Y / 2, GAME_WIDTH, FLOOR_Y, WALL_COLOR).setOrigin(0.5);

    // Floor
    this.add
      .rectangle(GAME_WIDTH / 2, FLOOR_Y + (GAME_HEIGHT - FLOOR_Y) / 2, GAME_WIDTH, GAME_HEIGHT - FLOOR_Y, FLOOR_COLOR)
      .setOrigin(0.5);

    // Floor line
    this.add
      .line(0, 0, 0, FLOOR_Y, GAME_WIDTH, FLOOR_Y, 0x706fd3)
      .setOrigin(0);
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
