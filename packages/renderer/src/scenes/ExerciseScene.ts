import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";
import { ActivitySceneBase } from "./ActivitySceneBase";

export class ExerciseScene extends ActivitySceneBase {
  protected bgKey = "scene_exercise_bg";
  protected label = "exercising...";
  protected labelColor = "#4fc3f7";

  constructor() { super({ key: "ExerciseScene" }); }

  protected addOverlays(): void {
    // Sweat drops
    this.makeParticle("sweat", 0x81d4fa, 0.6, 3);
    this.add.particles(480, 300, "sweat", { speed: { min: 20, max: 40 }, angle: { min: 70, max: 110 }, scale: { start: 0.3, end: 0.1 }, alpha: { start: 0.5, end: 0 }, lifespan: 800, frequency: 600, quantity: 1, gravityY: 100 });

    // Effort pulse — screen edges flash
    const effort = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff6b6b, 0);
    this.time.addEvent({ delay: 1500, loop: true, callback: () => {
      this.tweens.add({ targets: effort, alpha: { from: 0, to: 0.03 }, duration: 200, yoyo: true });
    }});

    // Energy lines (horizontal speed lines)
    this.time.addEvent({ delay: 800, loop: true, callback: () => {
      const y = 200 + Math.random() * 200;
      const line = this.add.rectangle(GAME_WIDTH / 2, y, 100 + Math.random() * 200, 1, 0xffffff, 0.15);
      this.tweens.add({ targets: line, alpha: 0, scaleX: 2, duration: 400, onComplete: () => line.destroy() });
    }});
  }
}
