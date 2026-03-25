import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, ROOM_OBJECTS, ROOM_WALL_BOTTOM_Y, ROOM_FLOOR_TOP_Y, ROOM_FLOOR_BOTTOM_Y } from "@nts/shared";
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
import { buildNavMeshPolygons, getObstacles } from "../config/NavMeshConfig";
import { ParticleManager } from "../systems/ParticleManager";
import { AudioMixer } from "../systems/AudioMixer";
import { AmbientManager } from "../systems/AmbientManager";
import { generateAllAmbientSounds } from "../systems/ProceduralAudio";
import { generateAllMusicTracks } from "../systems/ProceduralMusic";
import { MusicManager } from "../systems/MusicManager";
import { initVisualConfig, getVisualConfig } from "../config/VisualConfig";
import { TTSManager } from "../systems/TTSManager";

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
/** @deprecated replaced by ROOM_FLOOR_TOP_Y from shared constants */
const FLOOR_Y = ROOM_FLOOR_TOP_Y;

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
  private ambientManager!: AmbientManager;
  private musicManager!: MusicManager;
  private ttsManager: TTSManager | null = null;

  constructor() {
    super({ key: "RoomScene" });
  }

  create(): void {
    // Initialize visual FX config (respects ?fx=off URL param)
    initVisualConfig();

    // Generate pixel art textures for room objects and particles
    generateAllTextures(this);
    ParticleManager.generateTextures(this);

    // No fade — room appears instantly and bright

    this.createBackground();
    this.createRoomObjects();
    this.createTruman();
    this.createNavMeshDebug();
  }

  /** Debug overlay for navmesh — enabled via ?debug=nav URL param */
  private navDebugGraphics: Phaser.GameObjects.Graphics | null = null;

  private createNavMeshDebug(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") !== "nav") return;

    this.navDebugGraphics = this.add.graphics();
    this.navDebugGraphics.setDepth(95);
    this.drawNavMeshDebug();
  }

  private drawNavMeshDebug(): void {
    if (!this.navDebugGraphics) return;
    const g = this.navDebugGraphics;
    g.clear();

    // Draw walkable polygons (green outlines)
    const polys = buildNavMeshPolygons();
    g.lineStyle(1, 0x00ff00, 0.3);
    for (const poly of polys) {
      g.beginPath();
      g.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) g.lineTo(poly[i].x, poly[i].y);
      g.closePath();
      g.strokePath();
    }

    // Draw obstacles (red filled)
    const obstacles = getObstacles();
    g.fillStyle(0xff0000, 0.15);
    for (const ob of obstacles) {
      g.fillRect(ob.x, ob.y, ob.w, ob.h);
    }
    g.lineStyle(1, 0xff0000, 0.5);
    for (const ob of obstacles) {
      g.strokeRect(ob.x, ob.y, ob.w, ob.h);
    }
  }

  /** CRT scanline overlay — alternating dark lines for retro TV feel */
  private createCRTScanlines(): void {
    const g = this.add.graphics();
    for (let y = 0; y < GAME_HEIGHT; y += 2) {
      g.fillStyle(0x000000, 0.07);
      g.fillRect(0, y, GAME_WIDTH, 1);
    }
    g.generateTexture("crt_scanlines", GAME_WIDTH, GAME_HEIGHT);
    g.destroy();
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "crt_scanlines")
      .setDepth(98)
      .setScrollFactor(0);
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
        } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
      },
    );
    emitter.setDepth(3);
  }

  /** Camera PostFX disabled — room stays clean and bright */
  private applyCameraFX(): void {
    // All PostFX (vignette, bloom) disabled to keep room bright and clear.
    // Can be re-enabled later via VisualConfig when brightness is confirmed.
  }

  private glowFrameCounter = 0;
  private lastGlowedId: string | null = null;

  update(time: number, delta: number): void {
    this.movement.update(time, delta);
    this.activityRenderer.update();
    this.hud.updateTime();

    // Depth sort by feet position: Truman Container origin is center,
    // feet are ~40px below. Objects use origin(0.5,1) so depth=obj.y = bottom edge.
    this.truman.setDepth(this.truman.y + 40);

    // Object glow disabled — furniture is baked into background image
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
    this.ambientManager.destroy();
    this.musicManager.destroy();
    this.audioMixer.destroy();
    this.ttsManager?.destroy();
  }

  private createTruman(): void {
    // Spawn Truman at center of walkable floor area (3/4 view)
    this.truman = new TrumanSprite(this, 480, 400);
    this.movement = new MovementSystem(this, this.truman);
    this.activityRenderer = new ActivityRenderer(this, this.truman);
    this.activityManager = new ActivityManager(this, this.truman, this.movement, this.activityRenderer);

    this.hud = new HUD(this);
    this.thoughtBubble = new ThoughtBubble(this);

    // WindowView and LightingSystem disabled — room background is self-contained
    // and always bright. No overlays needed.

    // Audio mixer with three channels (voice, ambient, music)
    this.audioMixer = new AudioMixer(this);
    this.hud.setAudioMixer(this.audioMixer);

    // Generate procedural ambient sounds and start ambient system
    generateAllAmbientSounds(this);
    this.ambientManager = new AmbientManager(this, this.audioMixer);
    this.ambientManager.start();

    // Generate procedural music tracks and start music system
    generateAllMusicTracks(this);
    this.musicManager = new MusicManager(this, this.audioMixer);
    this.musicManager.start("neutral");

    // Wire activity changes to ambient manager
    this.activityManager.setOnActivityChange((activity, state) => {
      this.hud.updateActivity(activity ? `${activity} (${state})` : "Idle");
      // Only play ambient when performing, stop when idle/moving
      this.ambientManager.onActivityChange(state === "performing" ? activity : null);
    });

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

  /** Show a speech bubble above Truman (triggers TTS if enabled) */
  showSpeech(text: string, mood: string): void {
    this.thoughtBubble.showSpeech(text, mood, this.truman.x, this.truman.y);
  }

  getThoughtBubble(): ThoughtBubble {
    return this.thoughtBubble;
  }

  /** Set TTSManager for speech audio playback */
  setTTSManager(tts: TTSManager): void {
    this.ttsManager = tts;
    // Wire speech bubble callback to TTS
    this.thoughtBubble.onSpeechBubbleShow = (bubbleText, bubbleMood) => {
      void this.ttsManager?.speak(bubbleText, bubbleMood);
    };
    // Wire TTS playback to Truman mouth animation (audio-visual sync)
    tts.onSpeechStart = () => {
      this.truman.startTalking();
    };
    tts.onSpeechEnd = () => {
      this.truman.stopTalking();
    };
  }

  getTTSManager(): TTSManager | null {
    return this.ttsManager;
  }

  getHUD(): HUD {
    return this.hud;
  }

  getAudioMixer(): AudioMixer {
    return this.audioMixer;
  }

  getMusicManager(): MusicManager {
    return this.musicManager;
  }

  private createBackground(): void {
    // Priority: AI-generated 3/4 background > programmatic 3/4
    if (this.textures.exists("room_background_34")) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "room_background_34");
      bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      bg.setDepth(0);
      return;
    }

    // Programmatic 3/4 top-down room background
    const g = this.add.graphics();

    // === BACK WALL (top portion) ===
    g.fillStyle(WALL_BASE);
    g.fillRect(0, 0, GAME_WIDTH, ROOM_WALL_BOTTOM_Y);

    // Wall shading — darker at top
    g.fillStyle(WALL_TOP_SHADE, 0.3);
    g.fillRect(0, 0, GAME_WIDTH, 30);

    // Wallpaper pattern — subtle diamond grid on wall
    g.fillStyle(WALL_PATTERN, 0.2);
    const spacing = 20;
    for (let wy = 20; wy < ROOM_WALL_BOTTOM_Y - 10; wy += spacing) {
      const offset = ((wy - 20) / spacing) % 2 === 0 ? 0 : spacing / 2;
      for (let wx = offset + 10; wx < GAME_WIDTH - 10; wx += spacing) {
        g.fillRect(wx - 1, wy - 1, 2, 2);
      }
    }

    // Baseboard at wall-floor junction
    g.fillStyle(BASEBOARD_COLOR);
    g.fillRect(0, ROOM_WALL_BOTTOM_Y - 6, GAME_WIDTH, 6);
    g.fillStyle(BASEBOARD_TOP);
    g.fillRect(0, ROOM_WALL_BOTTOM_Y - 6, GAME_WIDTH, 2);

    // === WOODEN FLOOR (3/4 top-down view) ===
    const floorTop = ROOM_FLOOR_TOP_Y;
    const floorBot = GAME_HEIGHT;
    const floorH = floorBot - floorTop;

    // Base floor color
    g.fillStyle(FLOOR_PLANK_BASE);
    g.fillRect(0, floorTop, GAME_WIDTH, floorH);

    // Plank lines — horizontal planks (viewed from above)
    const plankH = 24;
    const plankColors = [FLOOR_PLANK_BASE, FLOOR_PLANK_DARK, FLOOR_PLANK_LIGHT, FLOOR_PLANK_BASE, FLOOR_PLANK_DARK];
    for (let py = floorTop; py < floorBot; py += plankH) {
      const ci = Math.floor((py - floorTop) / plankH);
      g.fillStyle(plankColors[ci % plankColors.length]);
      g.fillRect(0, py, GAME_WIDTH, plankH);

      // Gap line between planks
      g.fillStyle(FLOOR_GAP, 0.6);
      g.fillRect(0, py, GAME_WIDTH, 1);

      // Wood grain — short horizontal dashes
      g.fillStyle(FLOOR_GRAIN, 0.2);
      for (let gx = 4 + (ci * 13) % 20; gx < GAME_WIDTH; gx += 30 + (ci * 7) % 15) {
        g.fillRect(gx, py + 6 + (ci * 3) % 8, 12 + (ci * 5) % 10, 1);
      }
    }

    // Perspective — floor slightly darker toward front (bottom)
    g.fillStyle(0x000000, 0.06);
    g.fillRect(0, floorBot - 20, GAME_WIDTH, 20);

    // Corner shadows on wall
    g.fillStyle(0x000000, 0.05);
    g.fillRect(0, 0, 40, ROOM_WALL_BOTTOM_Y);
    g.fillRect(GAME_WIDTH - 40, 0, 40, ROOM_WALL_BOTTOM_Y);

    // Convert to Image (required for future Light2D pipeline)
    g.generateTexture("room_bg_34_gen", GAME_WIDTH, GAME_HEIGHT);
    g.destroy();
    const bgImg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "room_bg_34_gen");
    bgImg.setDepth(0);
  }

  private createRoomObjects(): void {
    for (const obj of ROOM_OBJECTS) {
      // Try AI 3/4 sprite, then programmatic sprite, then skip
      const texKey34 = `obj_34_${obj.id}`;
      const texKeyProg = `obj_${obj.id}`;
      let texKey: string | null = null;
      if (this.textures.exists(texKey34)) texKey = texKey34;
      else if (this.textures.exists(texKeyProg)) texKey = texKeyProg;

      if (texKey) {
        const img = this.add.image(obj.x, obj.y, texKey);
        img.setDisplaySize(obj.displayWidth, obj.displayHeight);

        if (obj.wallMounted) {
          // Wall objects: centered origin, fixed depth behind everything
          img.setOrigin(0.5, 0.5);
          img.setDepth(1);
        } else {
          // Floor objects: origin at bottom-center for Y-based depth sorting
          img.setOrigin(0.5, 1);
          img.setDepth(obj.y);
        }

        this.roomObjects.set(obj.id, img);
      } else {
        // No texture available — invisible zone fallback
        const zone = this.add.zone(obj.x, obj.y, obj.displayWidth, obj.displayHeight);
        this.roomObjects.set(obj.id, zone as unknown as Phaser.GameObjects.Image);
      }
    }
  }

  getRoomObject(id: InteractiveObjectId): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | undefined {
    return this.roomObjects.get(id);
  }
}
