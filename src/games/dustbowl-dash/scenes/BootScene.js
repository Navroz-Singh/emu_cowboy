import { Scene } from "phaser";

import { EVENTS, EventBus } from "@/lib/eventBus";

const SPRITES_BASE_PATH = "/sprites";

function createAnimationIfPossible(scene, { key, textureKey, start, end, frameRate, repeat }) {
  if (scene.anims.exists(key)) return;
  if (!scene.textures.exists(textureKey)) return;

  const texture = scene.textures.get(textureKey);
  const frameTotal = texture?.frameTotal ?? 0;
  if (frameTotal <= start) return;

  const safeEnd = Math.min(end, frameTotal - 1);
  const frames = scene.anims.generateFrameNumbers(textureKey, { start, end: safeEnd });
  if (!frames.length) return;

  scene.anims.create({ key, frames, frameRate, repeat });
}

export class BootScene extends Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const bar = this.add.graphics();
    const onProgress = (value) => {
      bar.clear();
      bar.fillStyle(0xf3a726, 1);
      bar.fillRect(200, 290, 400 * value, 20);
    };

    this.load.on("progress", onProgress);
    this.load.once("complete", () => {
      this.load.off("progress", onProgress);
      bar.destroy();
    });

    this.load.image("desert-bg", `${SPRITES_BASE_PATH}/desert-bg.png`);
    this.load.spritesheet("cowboy-gallop", `${SPRITES_BASE_PATH}/cowboy_gallop.png`, {
      frameWidth: 64,
      frameHeight: 128,
    });
    this.load.spritesheet("cowboy-actions", `${SPRITES_BASE_PATH}/cowboy_actions.png`, {
      frameWidth: 64,
      frameHeight: 128,
    });
    this.load.spritesheet("obstacles", `${SPRITES_BASE_PATH}/obstacles.png`, {
      frameWidth: 80,
      frameHeight: 80,
    });
    this.load.image("wagon", `${SPRITES_BASE_PATH}/wagon.png`);
    this.load.spritesheet("rabbit", `${SPRITES_BASE_PATH}/rabbit.png`, {
      frameWidth: 48,
      frameHeight: 64,
    });
    this.load.spritesheet("vfx", `${SPRITES_BASE_PATH}/vfx.png`, {
      frameWidth: 48,
      frameHeight: 48,
    });
    this.load.image("bullet", `${SPRITES_BASE_PATH}/bullet.png`);
    this.load.image("shadow", `${SPRITES_BASE_PATH}/shadow.png`);

    this.load.spritesheet("rock-bandit", `${SPRITES_BASE_PATH}/rock_bandit.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet("quicksand", `${SPRITES_BASE_PATH}/quicksand.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet("bison-totem", `${SPRITES_BASE_PATH}/bison_totem.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet("train-kit", `${SPRITES_BASE_PATH}/train_kit_rev.png`, {
      frameWidth: 150,
      frameHeight: 300,
    });
    this.load.spritesheet("cowboy-jump-to-train", `${SPRITES_BASE_PATH}/cowboy_jump_to_train.png`, {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet("cowboy-jump-to-horse", `${SPRITES_BASE_PATH}/cowboy_jump_to_horse.png`, {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet("only-horse-running", `${SPRITES_BASE_PATH}/only_horse_running.png`, {
      frameWidth: 64,
      frameHeight: 128,
    });
    this.load.image("coin", `${SPRITES_BASE_PATH}/coin.png`);
    this.load.image("bullet-refill", `${SPRITES_BASE_PATH}/bullet_refill.png`);
  }

  create() {
    createAnimationIfPossible(this, {
      key: "gallop",
      textureKey: "cowboy-gallop",
      start: 0,
      end: 3,
      frameRate: 10,
      repeat: -1,
    });

    createAnimationIfPossible(this, {
      key: "rabbit-run",
      textureKey: "rabbit",
      start: 0,
      end: 2,
      frameRate: 8,
      repeat: -1,
    });

    createAnimationIfPossible(this, {
      key: "dust-puff",
      textureKey: "vfx",
      start: 0,
      end: 3,
      frameRate: 12,
      repeat: 0,
    });

    createAnimationIfPossible(this, {
      key: "muzzle-flash",
      textureKey: "vfx",
      start: 4,
      end: 4,
      frameRate: 16,
      repeat: 0,
    });

    createAnimationIfPossible(this, {
      key: "explosion",
      textureKey: "vfx",
      start: 5,
      end: 5,
      frameRate: 14,
      repeat: 0,
    });

    createAnimationIfPossible(this, {
      key: "quicksand-swirl",
      textureKey: "quicksand",
      start: 0,
      end: 2,
      frameRate: 6,
      repeat: -1,
    });

    createAnimationIfPossible(this, {
      key: "horse-only-run",
      textureKey: "only-horse-running",
      start: 0,
      end: 1,
      frameRate: 10,
      repeat: -1,
    });

    EventBus.emit(EVENTS.GAME_READY);
    this.scene.start("MainScene");
  }
}

export default BootScene;
