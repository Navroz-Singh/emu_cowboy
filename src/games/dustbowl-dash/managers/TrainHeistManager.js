import * as Phaser from "phaser";

import { EVENTS, EventBus } from "@/lib/eventBus";
import { ACTION_STATE } from "@/games/dustbowl-dash/constants/GameConstants";

export class TrainHeistManager {
  constructor(scene) {
    this.scene = scene;

    this.isHeistActive = false;
    this.isCowboyOnTrain = false;
    this.canLeapToTrain = false;

    this.nextHeistCheckpointIndex = 0;
    this.pendingHeistSpawnScore = null;
    this.trainCars = [];
    this.trackOverlay = null;
    this.canReturnToHorse = false;
    this.trainCollisionPending = false;
    this.heistCoins = [];
    this.nextCoinTossAt = 0;
  }

  cleanup() {
    this.clearTrainCars();
    this.clearHeistCoins();

    if (this.trackOverlay?.active) {
      this.trackOverlay.destroy();
    }
    this.trackOverlay = null;

    this.isHeistActive = false;
    this.isCowboyOnTrain = false;
    this.canLeapToTrain = false;
    this.canReturnToHorse = false;
    this.trainCollisionPending = false;
    this.pendingHeistSpawnScore = null;
    this.nextCoinTossAt = 0;
    this.scene.postHeistObstacleCooldownUntil = 0;

    this.scene.cowboyOnTrain = false;
  }

  update(_dt, moveAmount) {
    if (this.scene.hasDied || this.scene.isGameOver) return;
    if (this.trainCollisionPending) return;

    if (!this.isHeistActive) {
      if (this.shouldTriggerHeist()) {
        this.startHeist();
      }
      return;
    }

    const trainMove = moveAmount * 0.85;
    this.trainCars.forEach((car) => {
      if (!car?.active) return;
      car.y += trainMove;
    });

    this.canLeapToTrain = this.computeFreightLeapWindow();
    this.canReturnToHorse = this.computeCabooseReturnWindow();

    if (this.hasTrainLaneCollision()) {
      this.triggerHeistFail();
      return;
    }

    if (this.isCowboyOnTrain) {
      this.updateHeistCoinTosses();

      const caboose = this.getCaboose();

      if (caboose && caboose.y > this.scene.constants.CANVAS_HEIGHT + 40) {
        this.triggerHeistFail();
        return;
      }
    }

    this.trainCars = this.trainCars.filter((car) => car?.active && car.y <= this.scene.constants.CANVAS_HEIGHT + 420);

    if (this.trainCars.length === 0 && !this.isCowboyOnTrain) {
      this.finishHeist();
    }
  }

  shouldTriggerHeist() {
    const checkpoints = this.scene.constants.TRAIN_HEIST_CHECKPOINTS || [];
    if (this.nextHeistCheckpointIndex >= checkpoints.length) return false;

    const threshold = checkpoints[this.nextHeistCheckpointIndex];
    if (this.pendingHeistSpawnScore === null) {
      this.pendingHeistSpawnScore = threshold;
    }

    if (this.scene.score >= this.pendingHeistSpawnScore) {
      this.nextHeistCheckpointIndex += 1;
      this.pendingHeistSpawnScore = null;
      return true;
    }

    return false;
  }

  shouldHoldPreHeistSpawns() {
    if (this.isHeistActive) return false;

    const checkpoints = this.scene.constants.TRAIN_HEIST_CHECKPOINTS || [];
    if (this.nextHeistCheckpointIndex >= checkpoints.length) return false;

    const threshold = checkpoints[this.nextHeistCheckpointIndex];
    const holdScore = Number(this.scene.constants.PRE_HEIST_SPAWN_HOLD_SCORE || 0);
    if (holdScore <= 0) return false;

    const windowStart = threshold - holdScore;
    if (windowStart <= 0) return false;

    return this.scene.score >= windowStart && this.scene.score < threshold;
  }

  hasTrainLaneCollision() {
    if (!this.isHeistActive || !this.scene.cowboy) return false;
    if (this.scene.currentLane !== 0) return false;

    const cowboyBounds = this.scene.cowboy.getBounds?.();
    if (!cowboyBounds) return false;

    for (let index = 0; index < this.trainCars.length; index += 1) {
      const car = this.trainCars[index];
      if (!car?.active) continue;

      const carBounds = car.getBounds?.();
      if (!carBounds) continue;

      const paddedCarBounds = new Phaser.Geom.Rectangle(
        carBounds.x + 18,
        carBounds.y + 26,
        Math.max(0, carBounds.width - 36),
        Math.max(0, carBounds.height - 52),
      );

      if (Phaser.Geom.Intersects.RectangleToRectangle(cowboyBounds, paddedCarBounds)) {
        return true;
      }
    }

    return false;
  }

  startHeist() {
    this.isHeistActive = true;
    this.isCowboyOnTrain = false;
    this.scene.cowboyOnTrain = false;
    this.canReturnToHorse = false;
    this.canLeapToTrain = false;
    this.trainCollisionPending = false;
    this.nextCoinTossAt = this.scene.time.now + 1000;
    this.clearHeistCoins();

    this.scene.obstacleManager?.clearForHeistTransition?.();
    this.scene.laneCoinManager?.clearAllCoins?.();

    const lane0 = this.scene.lanes[0];
    const laneWidth = 148;

    if (!this.trackOverlay || !this.trackOverlay.active) {
      this.trackOverlay = this.scene.add
        .rectangle(lane0, this.scene.constants.CANVAS_HEIGHT / 2, laneWidth, this.scene.constants.CANVAS_HEIGHT, 0x4a2e15, 0.26)
        .setDepth(-5);
    } else {
      this.trackOverlay.setPosition(lane0, this.scene.constants.CANVAS_HEIGHT / 2);
      this.trackOverlay.setVisible(true);
      this.trackOverlay.setActive(true);
    }

    this.spawnTrainChain();
  }

  getCaboose() {
    return this.trainCars.find((car) => car?.active && car.getData("kind") === "caboose") || null;
  }

  spawnTrainChain() {
    this.clearTrainCars();

    const x = this.scene.lanes[0];
    const segmentSpacing = 270;
    const freightCount = Phaser.Math.Between(10, 30);

    const engine = this.scene.add.sprite(x, -300, "train-kit", 0).setDepth(7);
    engine.setData("kind", "engine");
    this.trainCars.push(engine);

    for (let index = 0; index < freightCount; index += 1) {
      const freight = this.scene.add.sprite(x, -300 - segmentSpacing * (index + 1), "train-kit", 1).setDepth(7);
      freight.setData("kind", "freight");
      this.trainCars.push(freight);
    }

    const caboose = this.scene.add
      .sprite(x, -300 - segmentSpacing * (freightCount + 1), "train-kit", 2)
      .setDepth(7);
    caboose.setData("kind", "caboose");
    this.trainCars.push(caboose);
  }

  computeFreightLeapWindow() {
    if (!this.isHeistActive || this.isCowboyOnTrain || !this.scene.cowboy) return false;
    if (this.scene.currentLane !== 1) return false;

    for (let index = 0; index < this.trainCars.length; index += 1) {
      const car = this.trainCars[index];
      if (!car?.active) continue;
      if (car.getData("kind") !== "freight") continue;

      if (Math.abs(car.y - this.scene.cowboy.y) <= 70) {
        return true;
      }
    }

    return false;
  }

  computeCabooseReturnWindow() {
    if (!this.isHeistActive || !this.isCowboyOnTrain || !this.scene.cowboy) return false;

    const caboose = this.getCaboose();
    if (!caboose) return false;

    return (
      caboose.y >= this.scene.cowboy.y - this.scene.constants.HEIST_RETURN_WINDOW_BEFORE
      && caboose.y <= this.scene.cowboy.y + this.scene.constants.HEIST_RETURN_WINDOW_AFTER
      && this.scene.currentLane === 1
    );
  }

  isCabooseApproachingReturnZone() {
    if (!this.isHeistActive || !this.scene.cowboy) return false;

    const caboose = this.getCaboose();
    if (!caboose) return false;

    return (
      caboose.y >= this.scene.cowboy.y - this.scene.constants.HEIST_RETURN_WINDOW_BEFORE
      && caboose.y <= this.scene.cowboy.y + this.scene.constants.HEIST_RETURN_WINDOW_AFTER
    );
  }

  shouldHoldHeistSpawns() {
    if (!this.isHeistActive || !this.scene.cowboy) return false;

    const caboose = this.getCaboose();
    if (!caboose) return false;

    const configuredHoldBefore = Number(this.scene.constants.HEIST_CABOOSE_SPAWN_HOLD_BEFORE || 0);
    const minimumSafeHold = Number(this.scene.constants.HEIST_RETURN_WINDOW_BEFORE || 0) + 260;
    const holdBefore = Math.max(configuredHoldBefore, minimumSafeHold);

    return caboose.y >= this.scene.cowboy.y - holdBefore;
  }

  tryLeapToTrain() {
    if (!this.isHeistActive || this.isCowboyOnTrain || !this.canLeapToTrain || !this.scene.cowboy) return false;

    const jumpTexture = this.scene.textures.exists("cowboy-jump-to-train") ? "cowboy-jump-to-train" : null;
    const jumpSprite = jumpTexture
      ? this.scene.add.sprite(this.scene.cowboy.x, this.scene.cowboy.y - 24, jumpTexture, 0).setDepth(22)
      : null;

    if (jumpSprite) {
      this.scene.tweens.add({
        targets: jumpSprite,
        x: this.scene.lanes[0],
        duration: 300,
        ease: "Quad.easeOut",
        onStart: () => {
          if (jumpSprite.frame && jumpSprite.texture) {
            jumpSprite.setFrame(1);
          }
        },
        onComplete: () => {
          if (jumpSprite?.active) jumpSprite.destroy();
        },
      });
    }

    this.isCowboyOnTrain = true;
    this.scene.cowboyOnTrain = true;
    this.canReturnToHorse = false;
    this.enableHorseOnlyMode(true);

    return true;
  }

  tryReturnToHorse() {
    if (!this.isHeistActive || !this.isCowboyOnTrain || !this.scene.cowboy) return false;
    if (!this.canReturnToHorse || this.scene.currentLane !== 1) return false;

    const jumpTexture = this.scene.textures.exists("cowboy-jump-to-horse") ? "cowboy-jump-to-horse" : null;
    const jumpSprite = jumpTexture
      ? this.scene.add.sprite(this.scene.lanes[0], this.scene.cowboy.y - 24, jumpTexture, 0).setDepth(22)
      : null;

    if (jumpSprite) {
      this.scene.tweens.add({
        targets: jumpSprite,
        x: this.scene.cowboy.x,
        duration: 280,
        ease: "Quad.easeOut",
        onStart: () => {
          if (jumpSprite.frame && jumpSprite.texture) {
            jumpSprite.setFrame(1);
          }
        },
        onComplete: () => {
          if (jumpSprite?.active) jumpSprite.destroy();
        },
      });
    }

    this.isCowboyOnTrain = false;
    this.scene.cowboyOnTrain = false;
    this.canReturnToHorse = false;
    this.enableHorseOnlyMode(false);

    return true;
  }

  triggerTrainLaneAttemptCollision() {
    if (!this.isHeistActive || this.scene.hasDied || this.scene.isGameOver || !this.scene.cowboy) return false;
    if (this.trainCollisionPending) return false;

    this.trainCollisionPending = true;
    this.scene.actionState = ACTION_STATE.SWITCHING;

    const startX = this.scene.lanes[this.scene.currentLane] ?? this.scene.cowboy.x;
    const bumpX = startX - 14;

    this.scene.tweens.add({
      targets: this.scene.cowboy,
      x: bumpX,
      angle: -22,
      duration: 70,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (!this.scene.cowboy) return;
        this.scene.cowboy.x = startX;
        this.scene.cowboy.angle = 0;
      },
    });

    if (this.scene.shadow) {
      this.scene.tweens.add({
        targets: this.scene.shadow,
        x: startX - 8,
        duration: 70,
        yoyo: true,
        ease: "Quad.easeOut",
        onComplete: () => {
          if (this.scene.shadow) {
            this.scene.shadow.x = startX;
          }
        },
      });
    }

    this.scene.time.delayedCall(this.scene.constants.HEIST_TRAIN_COLLISION_DELAY_MS, () => {
      if (this.scene.hasDied || this.scene.isGameOver) return;
      this.trainCollisionPending = false;
      this.triggerHeistFail();
    });

    return true;
  }

  enableHorseOnlyMode(enabled) {
    if (!this.scene.cowboy) return;

    if (enabled && this.scene.textures.exists("only-horse-running")) {
      this.scene.cowboy.setTexture("only-horse-running", 0);
      if (this.scene.anims.exists("horse-only-run")) {
        this.scene.cowboy.play("horse-only-run", true);
      }
      return;
    }

    if (this.scene.textures.exists("cowboy-gallop")) {
      this.scene.cowboy.setTexture("cowboy-gallop", 0);
      if (this.scene.anims.exists("gallop")) {
        this.scene.cowboy.play("gallop", true);
      }
    }
  }

  triggerHeistFail() {
    if (this.scene.hasDied || this.scene.isGameOver) return;

    this.scene.hasDied = true;
    this.scene.isGameOver = true;
    this.scene.gameSpeed = 0;

    this.scene.cameras?.main?.shake(200, 0.02);

    if (this.scene.physics?.world) {
      this.scene.physics.world.pause();
    }

    this.scene.tweens.pauseAll();

    if (this.scene.cowboy?.anims) {
      this.scene.cowboy.anims.pause();
    }

    this.scene.vfxManager?.spawnStunStars();

    this.scene.time.delayedCall(1500, () => {
      if (!this.scene.hasDied) return;
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.scene.startTime) / 1000));
      const finalScore = this.scene.emitFinalScoreSnapshot?.() ?? this.scene.score;
      EventBus.emit(EVENTS.PLAYER_DIED, {
        score: finalScore,
        timePlayed: elapsedSeconds,
        rabbitsCollected: Number(this.scene.rabbitsCollected || 0),
        coinsCollected: Number(this.scene.coinsCollected || 0),
      });
    });
  }

  finishHeist() {
    this.isHeistActive = false;
    this.isCowboyOnTrain = false;
    this.scene.cowboyOnTrain = false;
    this.canLeapToTrain = false;
    this.canReturnToHorse = false;
    this.trainCollisionPending = false;
    this.nextCoinTossAt = 0;
    this.clearHeistCoins();

    this.scene.obstacleManager?.clearForHeistTransition?.();

    if (this.trackOverlay?.active) {
      this.trackOverlay.destroy();
    }
    this.trackOverlay = null;

    this.pendingHeistSpawnScore = null;
    this.scene.postHeistObstacleCooldownUntil = this.scene.time.now + this.scene.constants.POST_HEIST_OBSTACLE_COOLDOWN_MS;
  }

  clearTrainCars() {
    for (let index = 0; index < this.trainCars.length; index += 1) {
      const car = this.trainCars[index];
      if (car?.active) {
        car.destroy();
      }
    }
    this.trainCars = [];
  }

  updateHeistCoinTosses() {
    if (!this.scene.textures.exists("coin")) return;
    if (this.scene.time.now < this.nextCoinTossAt) return;

    const source = this.getMiddleTrainCoinSource();
    if (!source) return;

    this.nextCoinTossAt = this.scene.time.now + 1000;
    this.scene.coinsCollected = Number(this.scene.coinsCollected || 0) + 100;
    const burstCount = 2;

    for (let index = 0; index < burstCount; index += 1) {
      this.scene.time.delayedCall(index * 130, () => {
        if (!this.isHeistActive || !this.isCowboyOnTrain || this.scene.hasDied || this.scene.isGameOver) return;
        this.spawnHeistCoinToss(source);
      });
    }
  }

  getMiddleTrainCoinSource() {
    if (!this.scene.cowboy) return null;

    const minY = this.scene.cowboy.y + 10;
    const maxY = Math.min(this.scene.constants.CANVAS_HEIGHT - 20, this.scene.cowboy.y + 180);
    const candidates = this.trainCars.filter((car) => {
      if (!car?.active) return false;
      return car.y >= minY && car.y <= maxY;
    });

    if (candidates.length === 0) return null;
    const selected = Phaser.Utils.Array.GetRandom(candidates);
    const sourceX = Number(selected.x || this.scene.lanes[0]) + Phaser.Math.Between(-18, 18);
    const sourceY = Number(selected.y || 0) + Phaser.Math.Between(-18, 18);

    return { sourceX, sourceY };
  }

  spawnHeistCoinToss(source) {
    const coin = this.scene.add.sprite(source.sourceX, source.sourceY, "coin").setDepth(14).setScale(1.45);
    this.heistCoins.push(coin);

    const targetX = source.sourceX + Phaser.Math.Between(-20, 20);
    const targetY = coin.y - Phaser.Math.Between(120, 190);
    const rotation = Phaser.Math.Between(-150, 150);

    this.scene.tweens.add({
      targets: coin,
      x: targetX,
      y: targetY,
      angle: rotation,
      alpha: 0,
      duration: 1400,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (coin?.active) coin.destroy();
        this.heistCoins = this.heistCoins.filter((activeCoin) => activeCoin !== coin);
      },
    });
  }

  clearHeistCoins() {
    for (let index = 0; index < this.heistCoins.length; index += 1) {
      const coin = this.heistCoins[index];
      if (coin?.active) {
        coin.destroy();
      }
    }
    this.heistCoins = [];
  }
}
