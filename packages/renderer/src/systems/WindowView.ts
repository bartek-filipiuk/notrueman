import Phaser from "phaser";
import { ROOM_OBJECTS } from "@nts/shared";

/**
 * Dynamic window view — sky, clouds, stars, moon based on time of day.
 * Renders behind the window sprite. Updates every minute.
 */

const SKY_DAY = 0x87ceeb;
const SKY_SUNSET = 0xff7043;
const SKY_EVENING = 0x3949ab;
const SKY_NIGHT = 0x0d1b2a;
const CLOUD_WHITE = 0xffffff;
const STAR_COLOR = 0xfff9c4;
const MOON_COLOR = 0xfff8e1;
const SUN_COLOR = 0xffd54f;

function getSkyColor(hour: number): number {
  if (hour >= 6 && hour < 8) return SKY_DAY; // sunrise
  if (hour >= 8 && hour < 17) return SKY_DAY;
  if (hour >= 17 && hour < 19) return SKY_SUNSET;
  if (hour >= 19 && hour < 21) return SKY_EVENING;
  return SKY_NIGHT;
}

export class WindowView {
  private scene: Phaser.Scene;
  private skyRect: Phaser.GameObjects.Rectangle;
  private clouds: Phaser.GameObjects.Graphics;
  private stars: Phaser.GameObjects.Graphics;
  private celestial: Phaser.GameObjects.Graphics; // sun or moon
  private lastHour = -1;
  private windowX: number;
  private windowY: number;
  private windowW: number;
  private windowH: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const windowObj = ROOM_OBJECTS.find((o) => o.id === "window");
    if (!windowObj) {
      // No window in room — create dummy
      this.windowX = 0; this.windowY = 0;
      this.windowW = 0; this.windowH = 0;
      this.skyRect = scene.add.rectangle(0, 0, 0, 0).setVisible(false);
      this.clouds = scene.add.graphics().setVisible(false);
      this.stars = scene.add.graphics().setVisible(false);
      this.celestial = scene.add.graphics().setVisible(false);
      return;
    }

    // Window inner area (inside frame, before curtains)
    this.windowX = windowObj.x + 6;
    this.windowY = windowObj.y + 6;
    this.windowW = windowObj.width - 12;
    this.windowH = windowObj.height - 12;

    // Sky background (behind window sprite — depth -1)
    this.skyRect = scene.add
      .rectangle(this.windowX + this.windowW / 2, this.windowY + this.windowH / 2, this.windowW, this.windowH, SKY_DAY)
      .setDepth(-1);

    // Clouds layer
    this.clouds = scene.add.graphics().setDepth(-0.5);

    // Stars layer
    this.stars = scene.add.graphics().setDepth(-0.5);

    // Sun/moon
    this.celestial = scene.add.graphics().setDepth(-0.5);

    this.updateView();

    // Animate clouds drifting
    scene.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => this.animateClouds(),
    });
  }

  update(): void {
    const hour = new Date().getHours();
    if (hour !== this.lastHour) {
      this.lastHour = hour;
      this.updateView();
    }
  }

  private updateView(): void {
    const hour = new Date().getHours();
    const isNight = hour >= 21 || hour < 6;
    const isSunset = hour >= 17 && hour < 21;

    // Update sky color
    this.skyRect.setFillStyle(getSkyColor(hour));

    // Clear layers
    this.clouds.clear();
    this.stars.clear();
    this.celestial.clear();

    if (isNight) {
      this.drawStars();
      this.drawMoon();
    } else if (isSunset) {
      this.drawSunsetClouds();
    } else {
      this.drawDayClouds();
      this.drawSun();
    }
  }

  private drawDayClouds(): void {
    this.clouds.fillStyle(CLOUD_WHITE, 0.7);
    // Cloud 1
    this.clouds.fillCircle(this.windowX + 12, this.windowY + 14, 6);
    this.clouds.fillCircle(this.windowX + 20, this.windowY + 12, 8);
    this.clouds.fillCircle(this.windowX + 28, this.windowY + 14, 5);
    // Cloud 2 (lower)
    this.clouds.fillCircle(this.windowX + this.windowW - 16, this.windowY + 24, 5);
    this.clouds.fillCircle(this.windowX + this.windowW - 10, this.windowY + 22, 7);
  }

  private drawSunsetClouds(): void {
    this.clouds.fillStyle(0xff8a65, 0.6);
    this.clouds.fillCircle(this.windowX + 14, this.windowY + 16, 7);
    this.clouds.fillCircle(this.windowX + 24, this.windowY + 14, 9);
    this.clouds.fillStyle(0xffab91, 0.5);
    this.clouds.fillCircle(this.windowX + this.windowW - 14, this.windowY + 20, 6);
  }

  private drawStars(): void {
    this.stars.fillStyle(STAR_COLOR, 0.8);
    // Scattered stars
    const starPositions = [
      [8, 10], [22, 8], [36, 18], [14, 30], [42, 12],
      [30, 36], [6, 44], [44, 40], [18, 48], [38, 28],
    ];
    for (const [sx, sy] of starPositions) {
      if (sx < this.windowW && sy < this.windowH) {
        const twinkle = Math.random() > 0.3 ? 1 : 0.4;
        this.stars.fillStyle(STAR_COLOR, twinkle);
        this.stars.fillRect(this.windowX + sx, this.windowY + sy, 1, 1);
      }
    }
  }

  private drawMoon(): void {
    this.celestial.fillStyle(MOON_COLOR, 0.9);
    const mx = this.windowX + this.windowW - 14;
    const my = this.windowY + 14;
    this.celestial.fillCircle(mx, my, 8);
    // Crescent shadow
    this.celestial.fillStyle(getSkyColor(22), 0.9);
    this.celestial.fillCircle(mx + 3, my - 2, 6);
  }

  private drawSun(): void {
    this.celestial.fillStyle(SUN_COLOR, 0.5);
    const sx = this.windowX + this.windowW - 18;
    const sy = this.windowY + 16;
    this.celestial.fillCircle(sx, sy, 6);
    this.celestial.fillStyle(SUN_COLOR, 0.2);
    this.celestial.fillCircle(sx, sy, 10); // glow
  }

  private animateClouds(): void {
    // Subtle redraw with slight position jitter for drift effect
    if (this.lastHour >= 21 || this.lastHour < 6) return; // no clouds at night
    this.clouds.clear();
    if (this.lastHour >= 17) {
      this.drawSunsetClouds();
    } else {
      this.drawDayClouds();
    }
  }
}
