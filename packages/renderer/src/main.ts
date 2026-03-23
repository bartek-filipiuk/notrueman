import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, GAME_FPS } from "@nts/shared";
import { BootScene } from "./scenes/BootScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  parent: "game-container",
  pixelArt: true,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1a1a2e",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    target: GAME_FPS,
    forceSetTimeOut: true,
  },
  scene: [BootScene],
};

new Phaser.Game(config);
