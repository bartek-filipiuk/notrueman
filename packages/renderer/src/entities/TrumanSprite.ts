import Phaser from "phaser";

/** Drop shadow opacity — exported for tests */
export const SHADOW_ALPHA = 0.25;

/** Target display height for Truman sprite */
const TARGET_HEIGHT = 145;

/**
 * Truman character — extends Image directly (no Container overhead).
 * Supports 4-directional walk (spritesheet frames) and idle breathing.
 */
export class TrumanSprite extends Phaser.GameObjects.Image {
  private shadow: Phaser.GameObjects.Ellipse;
  private facing: "left" | "right" = "right";
  private animTimer?: Phaser.Time.TimerEvent;
  private walkTween: Phaser.Tweens.Tween | null = null;
  private currentAnim = "idle";
  private frameIndex = 0;
  private currentMood = "neutral";
  private walkScale = 0;
  private idleScale = 0;
  private baseY = 0; // remember Y for walk tween reset

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Find best initial texture
    const hasNewSprites = scene.textures.exists("truman_idle_side_0");
    const hasLegacy = scene.textures.exists("truman_idle");
    const initKey = hasNewSprites ? "truman_idle_side_0" : hasLegacy ? "truman_idle" : "__DEFAULT";

    super(scene, x, y, initKey);

    // Anchor at feet
    // Use default center origin (0.5, 0.5) — avoids rendering issues with bottom-anchored origin
    // Truman's Y position represents his CENTER, not feet

    // Scale to target height
    this.idleScale = TARGET_HEIGHT / this.texture.getSourceImage().height;
    this.setScale(this.idleScale);
    this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    // Pre-calculate walk scale
    if (scene.textures.exists("truman_walk_side_0")) {
      const walkTex = scene.textures.get("truman_walk_side_0");
      this.walkScale = TARGET_HEIGHT / walkTex.getSourceImage().height;
    } else {
      this.walkScale = this.idleScale;
    }

    // Shadow disabled for debugging
    this.shadow = scene.add.ellipse(x, y + 4, 40, 10, 0x000000, 0);
    this.shadow.setVisible(false);

    scene.add.existing(this);
    this.setDepth(900);

    this.baseY = y;

    // DEBUG: intercept y setter to catch who modifies it
    let _internalY = y;
    Object.defineProperty(this, 'y', {
      get: () => _internalY,
      set: (val: number) => {
        if (Math.abs(val - _internalY) > 2) {
          console.warn(`[TRUMAN Y SET] ${_internalY.toFixed(1)} → ${val.toFixed(1)}`);
          console.trace();
        }
        _internalY = val;
      },
      configurable: true,
    });

    this.playIdle();
  }

  // Override setPosition to move shadow too
  setPosition(x?: number, y?: number): this {
    super.setPosition(x, y);
    if (this.shadow) {
      this.shadow.setPosition(x ?? this.x, (y ?? this.y) + 4);
    }
    return this;
  }

  preUpdate(time: number, delta: number): void {
    // Keep shadow in sync (in case x/y set directly)
    if (this.shadow) {
      this.shadow.setPosition(this.x, this.y + 4);
    }
  }

  playIdle(): void {
    this.stopAnim();
    this.currentAnim = "idle";
    this.frameIndex = 0;

    const hasIdleFrames = this.scene.textures.exists("truman_idle_side_0");
    if (hasIdleFrames) {
      this.setTexture("truman_idle_side_0");
      this.setScale(this.idleScale);
      this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.setFlipX(false);
      this.setAngle(0);

      this.animTimer = this.scene.time.addEvent({
        delay: 200,
        loop: true,
        callback: () => {
          this.frameIndex = (this.frameIndex + 1) % 25;
          this.setTexture(`truman_idle_side_${this.frameIndex}`);
          this.setScale(this.idleScale);
          this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        },
      });
    }
  }

  playWalk(direction: "left" | "right" | "up" | "down"): void {
    this.stopAnim();
    if (direction === "left" || direction === "right") this.facing = direction;
    this.currentAnim = "walk";
    this.frameIndex = 0;

    const isSide = direction === "left" || direction === "right";
    const hasWalkFrames = this.scene.textures.exists("truman_walk_side_0");

    if (isSide && hasWalkFrames) {
      const flipX = direction === "left";
      this.setTexture("truman_walk_side_0");
      this.setScale(this.walkScale);
      this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.setFlipX(flipX);
      this.setAngle(0);

      this.animTimer = this.scene.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          this.frameIndex = (this.frameIndex + 1) % 25;
          this.setTexture(`truman_walk_side_${this.frameIndex}`);
          this.setScale(this.walkScale);
          this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
          this.setFlipX(flipX);
        },
      });
    } else {
      // Front/back: use same side walk animation (flipped based on last facing)
      // Most top-down games do this — side walk for all directions
      const flipX = this.facing === "left";
      this.setTexture("truman_walk_side_0");
      this.setScale(this.walkScale);
      this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.setFlipX(flipX);

      this.animTimer = this.scene.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          this.frameIndex = (this.frameIndex + 1) % 25;
          this.setTexture(`truman_walk_side_${this.frameIndex}`);
          this.setScale(this.walkScale);
          this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
          this.setFlipX(flipX);
        },
      });
    }
  }

  stopAnim(): void {
    this.animTimer?.destroy();
    this.animTimer = undefined;
    this.walkTween?.destroy();
    this.walkTween = null;
    this.setAngle(0);
  }

  getCurrentAnim(): string { return this.currentAnim; }
  getFacing(): "left" | "right" { return this.facing; }

  setFacing(dir: "left" | "right"): void {
    this.facing = dir;
    this.setFlipX(dir === "left");
  }

  setMood(mood: string): void { this.currentMood = mood; }
  setActivityPose(activity: string | null): void {
    if (!activity) this.playIdle();
  }

  // Talking stubs
  private isTalking = false;
  private talkTimer?: Phaser.Time.TimerEvent;
  getIsTalking(): boolean { return this.isTalking; }
  startTalking(): void {
    if (this.isTalking) return;
    this.isTalking = true;
    this.talkTimer = this.scene.time.addEvent({
      delay: 150, loop: true,
      callback: () => { this.setAngle(this.angle === 0 ? 1 : 0); },
    });
  }
  stopTalking(): void {
    this.isTalking = false;
    this.talkTimer?.destroy();
    this.talkTimer = undefined;
    this.setAngle(0);
  }
}
