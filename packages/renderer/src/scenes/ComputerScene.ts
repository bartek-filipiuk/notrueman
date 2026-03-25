import Phaser from "phaser";
import { GAME_WIDTH } from "@nts/shared";
import { ActivitySceneBase } from "./ActivitySceneBase";

export class ComputerScene extends ActivitySceneBase {
  protected bgKey = "scene_computer_bg";
  protected label = "coding...";
  protected labelColor = "#44dd88";

  constructor() { super({ key: "ComputerScene" }); }

  protected addOverlays(): void {
    // Scrolling code
    const lines = ["function think() {","  const mood = getMood();","  if (mood === 'curious') {","    explore(world);","  }","  return reflect();","}","","// What am I doing here?","const life = observe();"];
    let idx = 0;
    const code = this.add.text(540, 160, "", { fontSize: "6px", fontFamily: "'Press Start 2P', monospace", color: "#44dd88", lineSpacing: 3, wordWrap: { width: 160 } }).setAlpha(0.7);
    this.time.addEvent({ delay: 600, loop: true, callback: () => { idx++; code.setText(lines.slice(Math.max(0, idx - 8), idx % lines.length + 1).join("\n")); if (idx >= lines.length) idx = 0; } });

    // Cursor blink
    const cursor = this.add.rectangle(605, 240, 5, 8, 0x44dd88, 0.9);
    this.tweens.add({ targets: cursor, alpha: { from: 0.9, to: 0 }, duration: 530, yoyo: true, repeat: -1 });

    // Monitor glow
    const glow = this.add.rectangle(560, 210, 170, 120, 0x33cc77, 0.03).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: { from: 0.02, to: 0.06 }, duration: 2000, yoyo: true, repeat: -1 });

    // Coffee steam
    this.makeParticle("cs_steam", 0xffffff, 0.5, 4);
    this.add.particles(170, 350, "cs_steam", { speed: { min: 2, max: 6 }, angle: { min: 255, max: 285 }, scale: { start: 0.4, end: 0 }, alpha: { start: 0.2, end: 0 }, lifespan: 3000, frequency: 600, quantity: 1, blendMode: Phaser.BlendModes.ADD });
  }
}
