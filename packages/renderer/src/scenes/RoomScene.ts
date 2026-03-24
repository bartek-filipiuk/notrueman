import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, ROOM_OBJECTS } from "@nts/shared";
import type { InteractiveObjectId } from "@nts/shared";
import { TrumanSprite } from "../entities/TrumanSprite";
import { MovementSystem } from "../systems/MovementSystem";
import { ActivityRenderer } from "../systems/ActivityRenderer";
import { ActivityManager } from "../systems/ActivityManager";
import { HUD } from "../ui/HUD";
import { ThoughtBubble } from "../ui/ThoughtBubble";
import { LightingSystem } from "../systems/LightingSystem";
import { WindowView } from "../systems/WindowView";
import { generateAllTextures } from "../sprites/RoomObjectSprites";
import { ParticleManager } from "../systems/ParticleManager";
import { AudioMixer } from "../systems/AudioMixer";
import { initVisualConfig, getVisualConfig } from "../config/VisualConfig";

/** Warm room color palette (SNES / Stardew Valley warmth) */
const WALL_BASE = 0xd4c5a9;        // warm beige wall
const WALL_PATTERN = 0xc9b898;     // subtle darker beige for wallpaper pattern
const WALL_TOP_SHADE = 0xbfb08a;   // slightly darker at ceiling
const CEILING_COLOR = 0xe8dcc8;    // light cream ceiling strip
const CEILING_FRIEZE = 0x8b7355;   // dark wood trim at ceiling
const BASEBOARD_COLOR = 0x6b4e2e;  // dark wood baseboard
const BASEBOARD_TOP = 0x7d5f3f;    // baseboard highlight
const FLOOR_PLANK_BASE = 0x9e7e56; // medium warm wood
const FLOOR_PLANK_DARK = 0x8b6d45; // darker plank variation
const FLOOR_PLANK_LIGHT = 0xb08f65;// lighter plank variation
const FLOOR_GRAIN = 0x906e48;      // wood grain lines
const FLOOR_GAP = 0x5c3d1e;        // gap between planks
const FLOOR_Y = 460;

/** Window glow color for ambient lighting — exported for tests */
export const WINDOW_GLOW_COLOR = 0xfdd835;

export class RoomScene extends Phaser.Scene {
  private roomObjects = new Map<InteractiveObjectId, Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle>();
  private truman!: TrumanSprite;
  private movement!: MovementSystem;
  private activityRenderer!: ActivityRenderer;
  private activityManager!: ActivityManager;
  private hud!: HUD;
  private thoughtBubble!: ThoughtBubble;
  private lighting!: LightingSystem;
  private windowView!: WindowView;
  private audioMixer!: AudioMixer;

  constructor() {
    super({ key: "RoomScene" });
  }

  create(): void {
    // Initialize visual FX config (respects ?fx=off URL param)
    initVisualConfig();

    // Generate pixel art textures for room objects and particles
    generateAllTextures(this);
    ParticleManager.generateTextures(this);

    // Fade in from black (coming from BootScene)
    this.cameras.main.fadeIn(800, 10, 10, 26);

    this.createBackground();
    this.createRoomObjects();
    this.createTruman();

    // Apply camera PostFX (WebGL only)
    this.applyCameraFX();

    // Ambient dust particles in window light
    if (getVisualConfig().ambientParticles) {
      this.createAmbientDust();
    }
  }

  /** Floating dust motes in sunlight from window */
  private createAmbientDust(): void {
    const windowObj = ROOM_OBJECTS.find((o) => o.id === "window");
    if (!windowObj) return;

    // Generate tiny warm-gold particle texture
    const g = this.add.graphics();
    g.fillStyle(0xffd54f, 0.8);
    g.fillRect(0, 0, 2, 2);
    g.generateTexture("particle_dust_ambient", 2, 2);
    g.destroy();

    // Emitter in the window light cone area
    const emitter = this.add.particles(
      windowObj.x + windowObj.width / 2,
      windowObj.y + windowObj.height,
      "particle_dust_ambient",
      {
        speed: { min: 3, max: 10 },
        angle: { min: 150, max: 210 },
        scale: { start: 0.5, end: 0.1 },
        alpha: { start: 0.35, end: 0 },
        lifespan: { min: 4000, max: 8000 },
        frequency: 900,
        quantity: 1,
        blendMode: Phaser.BlendModes.ADD,
        emitZone: {
          type: "random",
          source: new Phaser.Geom.Rectangle(-30, 0, 60, 80),
        },
      },
    );
    emitter.setDepth(3);
  }

  /** Apply pro-level camera PostFX effects */
  private applyCameraFX(): void {
    const fx = getVisualConfig();
    const cam = this.cameras.main;

    if (fx.vignette && cam.postFX) {
      cam.postFX.addVignette(0.5, 0.5, 0.88, 0.35);
    }
    if (fx.bloom && cam.postFX) {
      cam.postFX.addBloom(0xffffff, 0.8, 0.8, 0.4, 1.1, 4);
    }
  }

  private glowFrameCounter = 0;
  private lastGlowedId: string | null = null;

  update(time: number, delta: number): void {
    this.movement.update(time, delta);
    this.activityRenderer.update();
    this.hud.updateTime();
    this.lighting.update();
    this.windowView.update();

    // Depth sort: Truman renders in front of objects below him, behind objects above
    this.truman.setDepth(this.truman.y);

    // Object glow on proximity (check every 10 frames for performance)
    this.glowFrameCounter++;
    if (this.glowFrameCounter % 10 === 0 && getVisualConfig().objectGlow) {
      this.updateObjectGlow();
    }
  }

  /** Add glow to nearest object when Truman is close */
  private updateObjectGlow(): void {
    let closestId: string | null = null;
    let closestDist = 60; // proximity threshold

    for (const obj of ROOM_OBJECTS) {
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      const dist = Phaser.Math.Distance.Between(this.truman.x, this.truman.y, cx, cy);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = obj.id;
      }
    }

    // Remove glow from previous object
    if (this.lastGlowedId && this.lastGlowedId !== closestId) {
      const prev = this.roomObjects.get(this.lastGlowedId as InteractiveObjectId);
      if (prev && "preFX" in prev && prev.preFX) {
        (prev.preFX as Phaser.GameObjects.Components.FX).clear();
      }
    }

    // Add glow to closest object
    if (closestId && closestId !== this.lastGlowedId) {
      const img = this.roomObjects.get(closestId as InteractiveObjectId);
      if (img && "preFX" in img && img.preFX) {
        (img.preFX as Phaser.GameObjects.Components.FX).addGlow(0xffffff, 2, 0, false, 0.06, 6);
      }
    }

    this.lastGlowedId = closestId;
  }

  /** Clean up all timers and tweens when scene shuts down */
  shutdown(): void {
    this.activityManager.stopLoop();
    this.activityRenderer.stopActivity();
    this.thoughtBubble.hide();
    this.audioMixer.destroy();
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

    this.windowView = new WindowView(this);
    this.lighting = new LightingSystem(this);

    // Audio mixer with three channels (voice, ambient, music)
    this.audioMixer = new AudioMixer(this);
    this.hud.setAudioMixer(this.audioMixer);

    // Keyboard shortcut: M toggles master mute
    this.input.keyboard?.on("keydown-M", () => {
      this.audioMixer.toggleMasterMute();
      // Re-sync HUD icon
      this.hud.setAudioMixer(this.audioMixer);
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

  getAudioMixer(): AudioMixer {
    return this.audioMixer;
  }

  private createBackground(): void {
    const bg = this.add.graphics();
    bg.setDepth(0);

    // === CEILING ===
    // Thin cream ceiling strip
    bg.fillStyle(CEILING_COLOR);
    bg.fillRect(0, 0, GAME_WIDTH, 12);
    // Ceiling frieze (thin decorative wood trim)
    bg.fillStyle(CEILING_FRIEZE);
    bg.fillRect(0, 12, GAME_WIDTH, 3);
    // Frieze highlight
    bg.fillStyle(BASEBOARD_TOP, 0.5);
    bg.fillRect(0, 12, GAME_WIDTH, 1);

    // === WALL ===
    // Base wall color — warm beige
    bg.fillStyle(WALL_BASE);
    bg.fillRect(0, 15, GAME_WIDTH, FLOOR_Y - 15);

    // Subtle top shading (darker near ceiling for depth)
    bg.fillStyle(WALL_TOP_SHADE, 0.3);
    bg.fillRect(0, 15, GAME_WIDTH, 30);

    // Wallpaper pattern — subtle diamond grid
    this.drawWallpaperPattern(bg);

    // Corner shadow — left (darker in corners)
    bg.fillStyle(0x000000, 0.06);
    bg.fillRect(0, 15, 60, FLOOR_Y - 15);
    bg.fillStyle(0x000000, 0.03);
    bg.fillRect(60, 15, 40, FLOOR_Y - 15);

    // Corner shadow — right
    bg.fillStyle(0x000000, 0.06);
    bg.fillRect(GAME_WIDTH - 50, 15, 50, FLOOR_Y - 15);
    bg.fillStyle(0x000000, 0.03);
    bg.fillRect(GAME_WIDTH - 90, 15, 40, FLOOR_Y - 15);

    // === BASEBOARD ===
    // Main baseboard
    bg.fillStyle(BASEBOARD_COLOR);
    bg.fillRect(0, FLOOR_Y - 8, GAME_WIDTH, 8);
    // Baseboard top edge highlight
    bg.fillStyle(BASEBOARD_TOP);
    bg.fillRect(0, FLOOR_Y - 8, GAME_WIDTH, 2);
    // Baseboard bottom shadow
    bg.fillStyle(0x4a3520);
    bg.fillRect(0, FLOOR_Y - 1, GAME_WIDTH, 1);

    // === WOODEN FLOOR ===
    this.drawWoodenFloor(bg);

    // === WINDOW AMBIENT GLOW ===
    const windowObj = ROOM_OBJECTS.find((o) => o.id === "window");
    if (windowObj) {
      const glow = this.add.graphics();
      glow.setDepth(0);
      // Warm sunlight trapezoid from window to floor
      glow.fillStyle(WINDOW_GLOW_COLOR, 0.06);
      glow.fillTriangle(
        windowObj.x + windowObj.width / 2, windowObj.y + windowObj.height,
        windowObj.x - 50, FLOOR_Y,
        windowObj.x + windowObj.width + 50, FLOOR_Y,
      );
      // Lighter patch on wall near window
      glow.fillStyle(0xfff8e1, 0.08);
      glow.fillRect(windowObj.x - 20, windowObj.y - 10, windowObj.width + 40, windowObj.height + 20);
      // Sunlight on floor below window
      glow.fillStyle(WINDOW_GLOW_COLOR, 0.05);
      glow.fillRect(windowObj.x - 30, FLOOR_Y, windowObj.width + 60, GAME_HEIGHT - FLOOR_Y);
    }
  }

  /** Draw subtle diamond wallpaper pattern on the wall */
  private drawWallpaperPattern(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(WALL_PATTERN, 0.25);
    const spacing = 24;
    const dotSize = 2;
    for (let y = 30; y < FLOOR_Y - 10; y += spacing) {
      const offset = ((y - 30) / spacing) % 2 === 0 ? 0 : spacing / 2;
      for (let x = offset + 12; x < GAME_WIDTH - 10; x += spacing) {
        // Small diamond dot
        g.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
      }
    }
    // Subtle horizontal wainscoting line at ~60% wall height
    const wainscotY = 15 + (FLOOR_Y - 15) * 0.62;
    g.fillStyle(BASEBOARD_TOP, 0.2);
    g.fillRect(0, wainscotY, GAME_WIDTH, 2);
    g.fillStyle(CEILING_COLOR, 0.15);
    g.fillRect(0, wainscotY - 1, GAME_WIDTH, 1);
  }

  /** Draw wooden plank floor with grain pattern */
  private drawWoodenFloor(g: Phaser.GameObjects.Graphics): void {
    const floorHeight = GAME_HEIGHT - FLOOR_Y;
    const plankWidth = 64;
    const plankHeight = floorHeight;
    const plankColors = [FLOOR_PLANK_BASE, FLOOR_PLANK_DARK, FLOOR_PLANK_LIGHT, FLOOR_PLANK_BASE, FLOOR_PLANK_DARK];

    // Draw planks left to right
    for (let i = 0; i * plankWidth < GAME_WIDTH; i++) {
      const x = i * plankWidth;
      const color = plankColors[i % plankColors.length];

      // Plank base
      g.fillStyle(color);
      g.fillRect(x, FLOOR_Y, plankWidth, plankHeight);

      // Gap line between planks
      if (i > 0) {
        g.fillStyle(FLOOR_GAP);
        g.fillRect(x, FLOOR_Y, 1, plankHeight);
      }

      // Wood grain lines (subtle horizontal dashes)
      g.fillStyle(FLOOR_GRAIN, 0.25);
      const grainOffset = (i * 7) % 5; // vary grain per plank
      for (let gy = FLOOR_Y + 4 + grainOffset; gy < GAME_HEIGHT; gy += 8) {
        const grainX = x + 3 + ((gy * 3 + i * 11) % 7);
        const grainLen = 12 + ((gy * 5 + i * 3) % 20);
        g.fillRect(grainX, gy, Math.min(grainLen, plankWidth - 6), 1);
      }

      // Subtle plank highlight at top edge
      g.fillStyle(0xffffff, 0.06);
      g.fillRect(x + 1, FLOOR_Y + 1, plankWidth - 2, 1);
    }

    // Perspective depth — floor gets slightly darker toward bottom
    g.fillStyle(0x000000, 0.08);
    g.fillRect(0, GAME_HEIGHT - 12, GAME_WIDTH, 12);
    g.fillStyle(0x000000, 0.04);
    g.fillRect(0, GAME_HEIGHT - 24, GAME_WIDTH, 12);
  }

  private createRoomObjects(): void {
    for (const obj of ROOM_OBJECTS) {
      const textureKey = `obj_${obj.id}`;

      if (this.textures.exists(textureKey)) {
        // Use pixel art sprite with depth based on bottom edge (Y sorting)
        const img = this.add.image(obj.x, obj.y, textureKey).setOrigin(0, 0);
        img.setDepth(obj.y + obj.height);
        // Add subtle shadow under furniture
        if (obj.zone !== "window" && obj.id !== "clock" && obj.id !== "poster") {
          this.add
            .ellipse(
              obj.x + obj.width / 2,
              obj.y + obj.height + 2,
              obj.width * 0.8,
              6,
              0x000000,
              0.12,
            )
            .setDepth(obj.y + obj.height - 1);
        }
        this.roomObjects.set(obj.id, img as any);
      } else {
        // Fallback: colored rectangle (safety net)
        const rect = this.add
          .rectangle(obj.x, obj.y, obj.width, obj.height, 0x888888, 0.6)
          .setOrigin(0, 0);
        this.roomObjects.set(obj.id, rect);
      }
    }
  }

  getRoomObject(id: InteractiveObjectId): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | undefined {
    return this.roomObjects.get(id);
  }
}
