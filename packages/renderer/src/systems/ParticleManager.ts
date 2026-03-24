import Phaser from "phaser";
import type { ActivityType } from "@nts/shared";

/**
 * Particle texture keys generated for reuse.
 * Each texture is a tiny pixel art shape (4-8px).
 */
const TEX = {
  STEAM: "particle_steam",
  SPARK_GREEN: "particle_spark_green",
  SPARK_BLUE: "particle_spark_blue",
  ZZZ: "particle_zzz",
  SWEAT: "particle_sweat",
  DUST: "particle_dust",
  PAINT_RED: "particle_paint_red",
  PAINT_CYAN: "particle_paint_cyan",
  PAINT_PINK: "particle_paint_pink",
} as const;

/** Exported for tests */
export const PARTICLE_TEXTURE_KEYS = TEX;

/**
 * Manages Phaser particle emitters for activity visual effects.
 * Replaces Graphics API rectangles with proper particle emitters.
 */
export class ParticleManager {
  private scene: Phaser.Scene;
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private static texturesGenerated = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Generate all tiny particle textures — call once during scene create */
  static generateTextures(scene: Phaser.Scene): void {
    if (ParticleManager.texturesGenerated) return;

    const g = scene.add.graphics();

    // Steam — soft white circle (6px)
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 3);
    g.generateTexture(TEX.STEAM, 6, 6);

    // Green spark (4px)
    g.clear();
    g.fillStyle(0x55efc4, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture(TEX.SPARK_GREEN, 4, 4);

    // Blue spark (4px)
    g.clear();
    g.fillStyle(0x74b9ff, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture(TEX.SPARK_BLUE, 4, 4);

    // Zzz letter — small "Z" shape (8x8)
    g.clear();
    g.fillStyle(0xaaaaff, 1);
    // Top bar
    g.fillRect(1, 1, 6, 2);
    // Diagonal
    g.fillRect(5, 1, 2, 2);
    g.fillRect(4, 2, 2, 2);
    g.fillRect(3, 3, 2, 2);
    g.fillRect(2, 4, 2, 2);
    g.fillRect(1, 5, 2, 2);
    // Bottom bar
    g.fillRect(1, 5, 6, 2);
    g.generateTexture(TEX.ZZZ, 8, 8);

    // Sweat drop — blue teardrop (4x6)
    g.clear();
    g.fillStyle(0x88ccff, 1);
    g.fillCircle(2, 4, 2);
    g.fillRect(1, 2, 2, 2);
    g.generateTexture(TEX.SWEAT, 4, 6);

    // Dust — golden circle (4px)
    g.clear();
    g.fillStyle(0xffd54f, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture(TEX.DUST, 4, 4);

    // Paint splatter — red (4px)
    g.clear();
    g.fillStyle(0xff6b6b, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture(TEX.PAINT_RED, 4, 4);

    // Paint splatter — cyan (4px)
    g.clear();
    g.fillStyle(0x48dbfb, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture(TEX.PAINT_CYAN, 4, 4);

    // Paint splatter — pink (4px)
    g.clear();
    g.fillStyle(0xad1457, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture(TEX.PAINT_PINK, 4, 4);

    g.destroy();
    ParticleManager.texturesGenerated = true;
  }

  /** Start particle effects for given activity at position */
  startEffect(activity: ActivityType, x: number, y: number): void {
    this.stopAll();

    switch (activity) {
      case "cook":
        this.startCookSteam(x, y);
        break;
      case "computer":
        this.startComputerSparks(x, y);
        break;
      case "sleep":
        this.startSleepZzz(x, y);
        break;
      case "exercise":
        this.startExerciseSweat(x, y);
        break;
      case "read":
        this.startReadDust(x, y);
        break;
      case "draw":
        this.startDrawPaint(x, y);
        break;
      default:
        break;
    }
  }

  /** Stop and destroy all active emitters */
  stopAll(): void {
    for (const emitter of this.emitters) {
      emitter.stop();
      emitter.destroy();
    }
    this.emitters = [];
  }

  /** Update emitter positions to follow a target */
  updatePosition(x: number, y: number): void {
    for (const emitter of this.emitters) {
      if (emitter.active) {
        emitter.setPosition(
          x + (emitter.getData("offsetX") ?? 0),
          y + (emitter.getData("offsetY") ?? 0),
        );
      }
    }
  }

  /** Cooking steam — white particles rising from stove area */
  private startCookSteam(x: number, y: number): void {
    const emitter = this.scene.add.particles(x, y - 25, TEX.STEAM, {
      speed: { min: 8, max: 20 },
      angle: { min: -100, max: -80 },
      scale: { start: 0.8, end: 0.2 },
      alpha: { start: 0.5, end: 0 },
      lifespan: { min: 1200, max: 2000 },
      frequency: 300,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });
    emitter.setData("offsetX", 0);
    emitter.setData("offsetY", -25);
    this.emitters.push(emitter);
  }

  /** Computer sparks — green/blue particles flickering near screen */
  private startComputerSparks(x: number, y: number): void {
    const greenEmitter = this.scene.add.particles(x - 5, y - 25, TEX.SPARK_GREEN, {
      speed: { min: 10, max: 30 },
      angle: { min: -120, max: -60 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: { min: 400, max: 800 },
      frequency: 500,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });
    greenEmitter.setData("offsetX", -5);
    greenEmitter.setData("offsetY", -25);
    this.emitters.push(greenEmitter);

    const blueEmitter = this.scene.add.particles(x + 5, y - 25, TEX.SPARK_BLUE, {
      speed: { min: 10, max: 30 },
      angle: { min: -120, max: -60 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: { min: 400, max: 800 },
      frequency: 700,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });
    blueEmitter.setData("offsetX", 5);
    blueEmitter.setData("offsetY", -25);
    this.emitters.push(blueEmitter);
  }

  /** Sleep Zzz — "Z" sprites floating upward and fading */
  private startSleepZzz(x: number, y: number): void {
    const emitter = this.scene.add.particles(x + 15, y - 30, TEX.ZZZ, {
      speed: { min: 5, max: 12 },
      angle: { min: -110, max: -70 },
      scale: { start: 0.6, end: 1.2 },
      alpha: { start: 0.8, end: 0 },
      lifespan: { min: 2000, max: 3000 },
      frequency: 1200,
      quantity: 1,
      rotate: { min: -15, max: 15 },
    });
    emitter.setData("offsetX", 15);
    emitter.setData("offsetY", -30);
    this.emitters.push(emitter);
  }

  /** Exercise sweat — blue droplets with gravity */
  private startExerciseSweat(x: number, y: number): void {
    const emitter = this.scene.add.particles(x, y - 20, TEX.SWEAT, {
      speed: { min: 20, max: 50 },
      angle: { min: -150, max: -30 },
      scale: { start: 0.8, end: 0.3 },
      alpha: { start: 0.7, end: 0 },
      lifespan: { min: 600, max: 1000 },
      frequency: 600,
      quantity: 1,
      gravityY: 80,
    });
    emitter.setData("offsetX", 0);
    emitter.setData("offsetY", -20);
    this.emitters.push(emitter);
  }

  /** Reading dust — golden particles drifting from book */
  private startReadDust(x: number, y: number): void {
    const emitter = this.scene.add.particles(x + 15, y - 10, TEX.DUST, {
      speed: { min: 5, max: 15 },
      angle: { min: -130, max: -50 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: { min: 1000, max: 1800 },
      frequency: 500,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });
    emitter.setData("offsetX", 15);
    emitter.setData("offsetY", -10);
    this.emitters.push(emitter);
  }

  /** Drawing — colorful paint splatter particles */
  private startDrawPaint(x: number, y: number): void {
    const textures = [TEX.PAINT_RED, TEX.PAINT_CYAN, TEX.PAINT_PINK];
    for (let i = 0; i < textures.length; i++) {
      const offsetX = 15 + (i - 1) * 5;
      const emitter = this.scene.add.particles(x + offsetX, y - 12, textures[i], {
        speed: { min: 15, max: 40 },
        angle: { min: -160, max: -20 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.6, end: 0 },
        lifespan: { min: 500, max: 900 },
        frequency: 800 + i * 200,
        quantity: 1,
      });
      emitter.setData("offsetX", offsetX);
      emitter.setData("offsetY", -12);
      this.emitters.push(emitter);
    }
  }
}
