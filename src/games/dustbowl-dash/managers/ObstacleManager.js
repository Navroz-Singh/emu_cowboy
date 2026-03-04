import * as Phaser from "phaser";

import { EVENTS, EventBus } from "@/lib/eventBus";
import { ACTION_STATE, OBSTACLE_TYPE } from "@/games/dustbowl-dash/constants/GameConstants";

export class ObstacleManager {
  constructor(scene, vfxManager) {
    this.scene = scene;
    this.vfxManager = vfxManager;

    this.obstaclePool = null;
    this.wagonPool = null;
    this.bulletPool = null;

    this.cowboyObstacleOverlap = null;
    this.cowboyWagonOverlap = null;
    this.bulletObstacleOverlap = null;
  }

  cleanup() {
    const physicsWorld = this.scene.physics?.world;

    if (this.cowboyObstacleOverlap && physicsWorld?.removeCollider) {
      physicsWorld.removeCollider(this.cowboyObstacleOverlap);
    }
    if (this.cowboyWagonOverlap && physicsWorld?.removeCollider) {
      physicsWorld.removeCollider(this.cowboyWagonOverlap);
    }
    if (this.bulletObstacleOverlap && physicsWorld?.removeCollider) {
      physicsWorld.removeCollider(this.bulletObstacleOverlap);
    }

    this.cowboyObstacleOverlap = null;
    this.cowboyWagonOverlap = null;
    this.bulletObstacleOverlap = null;
  }

  initObjectPools() {
    const obstacleTextureKey = this.scene.textures.exists("obstacles") ? "obstacles" : "__DEFAULT";
    const wagonTextureKey = this.scene.textures.exists("wagon") ? "wagon" : "__DEFAULT";
    const bulletTextureKey = this.scene.textures.exists("bullet") ? "bullet" : "__DEFAULT";

    this.obstaclePool = this.scene.physics.add.group({ maxSize: 30, runChildUpdate: false });
    for (let index = 0; index < 30; index += 1) {
      const obstacle = this.obstaclePool.create(0, -200, obstacleTextureKey);
      if (!obstacle) continue;
      obstacle.setActive(false).setVisible(false);
      obstacle.setScale(this.scene.constants.BASE_SPRITE_SCALE);
      if (obstacle.body) {
        obstacle.body.enable = false;
      }
    }

    this.wagonPool = this.scene.physics.add.group({ maxSize: 5, runChildUpdate: false });
    for (let index = 0; index < 5; index += 1) {
      const wagon = this.wagonPool.create(0, -220, wagonTextureKey);
      if (!wagon) continue;
      wagon.setActive(false).setVisible(false);
      wagon.setScale(this.scene.constants.WAGON_SCALE);
      if (wagon.body) {
        wagon.body.enable = false;
      }
    }

    this.bulletPool = this.scene.physics.add.group({ maxSize: 10, runChildUpdate: false });
    for (let index = 0; index < 10; index += 1) {
      const bullet = this.bulletPool.create(0, -240, bulletTextureKey);
      if (!bullet) continue;
      bullet.setActive(false).setVisible(false);
      bullet.setScale(this.scene.constants.BASE_SPRITE_SCALE);
      if (bullet.body) {
        bullet.body.enable = false;
      }
    }
  }

  initCollisions() {
    if (!this.scene.physics?.add || !this.scene.cowboy || !this.obstaclePool || !this.wagonPool || !this.bulletPool) return;

    this.cowboyObstacleOverlap = this.scene.physics.add.overlap(
      this.scene.cowboy,
      this.obstaclePool,
      this.handleCollision,
      undefined,
      this,
    );

    this.cowboyWagonOverlap = this.scene.physics.add.overlap(
      this.scene.cowboy,
      this.wagonPool,
      this.handleCollision,
      undefined,
      this,
    );

    this.bulletObstacleOverlap = this.scene.physics.add.overlap(
      this.bulletPool,
      this.obstaclePool,
      this.handleBulletHit,
      undefined,
      this,
    );
  }

  update(dt, moveAmount) {
    this.updateObstaclePoolMovement(dt, moveAmount);
    this.updateWagonPoolMovement(moveAmount);
    this.updateBulletPoolMovement(dt);
    this.checkNearMisses();
  }

  updateObstaclePoolMovement(dt, moveAmount) {
    if (!this.obstaclePool) return;

    const children = this.obstaclePool.getChildren();
    for (let index = 0; index < children.length; index += 1) {
      const obstacle = children[index];
      if (!obstacle?.active) continue;

      const type = obstacle.getData("type");
      if (type === OBSTACLE_TYPE.TUMBLEWEED) {
        const extraVelY = Number(obstacle.getData("velY") || 0);
        obstacle.y += moveAmount + extraVelY * dt;

        const bobPhase = Number(obstacle.getData("bobPhase") || 0);
        const previousOffset = Number(obstacle.getData("bobOffsetPrev") || 0);
        const currentOffset = Math.sin(this.scene.time.now * 0.012 + bobPhase) * this.scene.constants.TUMBLEWEED_BOB_AMPLITUDE;
        obstacle.y += currentOffset - previousOffset;
        obstacle.setData("bobOffsetPrev", currentOffset);
      } else {
        obstacle.y += moveAmount;
      }

      const velX = Number(obstacle.getData("velX") || 0);
      if (velX !== 0) {
        obstacle.x += velX * dt;
      }

      obstacle.setScale(this.getScaleForType(type));

      if (obstacle.y > this.scene.constants.DESPAWN_Y || obstacle.x < -100 || obstacle.x > 900) {
        this.disablePooledObject(obstacle);
      }
    }
  }

  updateWagonPoolMovement(moveAmount) {
    if (!this.wagonPool) return;

    const children = this.wagonPool.getChildren();
    for (let index = 0; index < children.length; index += 1) {
      const wagon = children[index];
      if (!wagon?.active) continue;

      wagon.y += moveAmount;
      wagon.setScale(this.scene.constants.WAGON_SCALE);

      if (wagon.y > this.scene.constants.DESPAWN_Y) {
        this.disablePooledObject(wagon);
      }
    }
  }

  updateBulletPoolMovement(dt) {
    if (!this.bulletPool) return;

    const children = this.bulletPool.getChildren();
    for (let index = 0; index < children.length; index += 1) {
      const bullet = children[index];
      if (!bullet?.active) continue;

      bullet.y -= this.scene.constants.BULLET_SPEED * dt;
      if (bullet.y < -20) {
        this.disablePooledObject(bullet);
      }
    }
  }

  disablePooledObject(gameObject) {
    if (!gameObject) return;

    this.scene.tweens.killTweensOf(gameObject);

    gameObject.setActive(false).setVisible(false);
    gameObject.setScale(this.scene.constants.BASE_SPRITE_SCALE);
    gameObject.setAlpha(1);
    gameObject.setAngle(0);
    if (gameObject.body) {
      gameObject.body.enable = false;
      gameObject.body.setVelocity?.(0, 0);
    }

    gameObject.setData("type", null);
    gameObject.setData("velX", 0);
    gameObject.setData("velY", 0);
    gameObject.setData("bobPhase", 0);
    gameObject.setData("bobOffsetPrev", 0);
    gameObject.setData("nearMissTriggered", false);
    gameObject.setData("nearMissFrames", 0);
    gameObject.setData("nearMissBonusGiven", false);
  }

  spawnInLane(laneIndex, type, yOffset = 0) {
    if (!this.obstaclePool || !Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex > 2) return null;

    const obstacle = this.obstaclePool.getFirstDead(false);
    if (!obstacle) return null;

    const frameMap = {
      [OBSTACLE_TYPE.CACTUS]: 0,
      [OBSTACLE_TYPE.BARREL]: 1,
      [OBSTACLE_TYPE.SIGN]: 2,
      [OBSTACLE_TYPE.TUMBLEWEED]: 3,
    };

    if (Number.isInteger(frameMap[type]) && this.scene.textures.exists("obstacles")) {
      obstacle.setTexture("obstacles", frameMap[type]);
    }

    obstacle.setData("type", type);
    obstacle.setData("velX", 0);
    obstacle.setData("velY", 0);
    obstacle.setData("bobPhase", 0);
    obstacle.setData("bobOffsetPrev", 0);
    obstacle.setData("nearMissTriggered", false);
    obstacle.setData("nearMissFrames", 0);
    obstacle.setData("nearMissBonusGiven", false);

    obstacle.x = this.scene.lanes[laneIndex];
    obstacle.y = this.scene.constants.SPAWN_Y + yOffset;
    obstacle.setScale(this.getScaleForType(type));
    obstacle.setActive(true).setVisible(true);

    if (obstacle.body) {
      obstacle.body.enable = true;
      obstacle.body.setVelocity(0, 0);
      obstacle.body.setAllowGravity(false);
    }

    this.configureObstacleHitbox(obstacle, type);

    return obstacle;
  }

  spawnWagon() {
    if (!this.wagonPool) return false;

    const wagon = this.wagonPool.getFirstDead(false);
    if (!wagon) return false;

    const pair = Phaser.Math.Between(0, 1);

    wagon.x = (this.scene.lanes[pair] + this.scene.lanes[pair + 1]) / 2;
    wagon.y = this.scene.constants.SPAWN_Y;
    wagon.setScale(this.scene.constants.WAGON_SCALE);
    wagon.setActive(true).setVisible(true);
    wagon.setData("type", OBSTACLE_TYPE.WAGON);

    if (wagon.body) {
      wagon.body.enable = true;
      wagon.body.setVelocity(0, 0);
      wagon.body.setAllowGravity(false);
    }

    this.configureWagonHitbox(wagon);

    return true;
  }

  spawnTumbleweed() {
    if (!this.obstaclePool) return false;

    const obstacle = this.obstaclePool.getFirstDead(false);
    if (!obstacle) return false;

    if (this.scene.textures.exists("obstacles")) {
      obstacle.setTexture("obstacles", 3);
    }

    const fromLeft = Phaser.Math.Between(0, 1) === 0;
    const horizontalSpeed = Phaser.Math.Between(200, 350);

    obstacle.setData("type", OBSTACLE_TYPE.TUMBLEWEED);
    obstacle.setData("velX", fromLeft ? horizontalSpeed : -horizontalSpeed);
    obstacle.setData("velY", 0);
    obstacle.setData("bobPhase", Phaser.Math.FloatBetween(0, Math.PI * 2));
    obstacle.setData("bobOffsetPrev", 0);
    obstacle.setData("nearMissTriggered", false);
    obstacle.setData("nearMissFrames", 0);
    obstacle.setData("nearMissBonusGiven", false);

    obstacle.x = fromLeft ? -40 : 840;
    obstacle.y = Phaser.Math.Between(-80, Math.floor(this.scene.constants.CANVAS_HEIGHT * 0.25));
    obstacle.setScale(this.getScaleForType(OBSTACLE_TYPE.TUMBLEWEED));
    obstacle.setActive(true).setVisible(true);

    if (obstacle.body) {
      obstacle.body.enable = true;
      obstacle.body.setVelocity(0, 0);
      obstacle.body.setAllowGravity(false);
    }

    this.configureObstacleHitbox(obstacle, OBSTACLE_TYPE.TUMBLEWEED);

    this.scene.tweens.add({
      targets: obstacle,
      angle: fromLeft ? 360 : -360,
      duration: 2000,
      repeat: -1,
      ease: "Linear",
    });

    return true;
  }

  getScaleForType(type) {
    if (type === OBSTACLE_TYPE.CACTUS) return this.scene.constants.CACTUS_SCALE;
    if (type === OBSTACLE_TYPE.SIGN) return this.scene.constants.SIGN_SCALE;
    if (type === OBSTACLE_TYPE.WAGON) return this.scene.constants.WAGON_SCALE;
    return this.scene.constants.BASE_SPRITE_SCALE;
  }

  configureObstacleHitbox(obstacle, type) {
    if (!obstacle?.body) return;

    if (type === OBSTACLE_TYPE.TUMBLEWEED) {
      obstacle.body.setCircle(18, 22, 22);
      return;
    }

    switch (type) {
      case OBSTACLE_TYPE.CACTUS:
        obstacle.body.setSize(30, 52, true);
        obstacle.body.setOffset(25, 18);
        break;
      case OBSTACLE_TYPE.BARREL:
        obstacle.body.setSize(42, 42, true);
        obstacle.body.setOffset(19, 19);
        break;
      case OBSTACLE_TYPE.SIGN:
        obstacle.body.setSize(24, 42, true);
        obstacle.body.setOffset(28, 20);
        break;
      default:
        obstacle.body.setSize(44, 44, true);
        obstacle.body.setOffset(18, 18);
        break;
    }
  }

  configureWagonHitbox(wagon) {
    if (!wagon?.body) return;
    wagon.body.setSize(146, 66, true);
    wagon.body.setOffset(27, 52);
  }

  handleCollision = (_player, obstacle) => {
    const obstacleType = obstacle?.getData?.("type") ?? null;
    if (this.scene.hasDied) return;

    if (this.scene.actionState === ACTION_STATE.JUMPING) {
      if (obstacleType === OBSTACLE_TYPE.CACTUS || obstacleType === OBSTACLE_TYPE.TUMBLEWEED) {
        this.handleNearMiss(obstacle);
        return;
      }
    }

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

    this.vfxManager.spawnStunStars();

    this.scene.time.delayedCall(1500, () => {
      if (!this.scene.hasDied) return;
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.scene.startTime) / 1000));
      EventBus.emit(EVENTS.PLAYER_DIED, { score: this.scene.score, timePlayed: elapsedSeconds });
    });
  };

  handleNearMiss(obstacle) {
    if (!obstacle?.active) return;
    if (obstacle.getData("nearMissBonusGiven")) return;

    const dist = Phaser.Math.Distance.Between(this.scene.cowboy.x, this.scene.cowboy.y, obstacle.x, obstacle.y);
    if (dist > this.scene.constants.NEAR_MISS_THRESHOLD + 30) return;

    obstacle.setData("nearMissBonusGiven", true);
    this.scene.score += 50;

    const text = this.scene.add
      .text(this.scene.cowboy.x, this.scene.cowboy.y - 50, "+50 WHEW!", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#FFD700",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - 40,
      duration: 800,
      onComplete: () => {
        if (text?.active) text.destroy();
      },
    });

    this.vfxManager?.spawnDustPuff(this.scene.cowboy.x - 10, this.scene.cowboy.y + 20);
    this.vfxManager?.spawnDustPuff(this.scene.cowboy.x + 10, this.scene.cowboy.y + 20);
    EventBus.emit(EVENTS.SCORE_UPDATED, { score: this.scene.score, ammo: this.scene.ammoCount });
  }

  checkNearMisses() {
    if (!this.obstaclePool || !this.scene.cowboy || this.scene.hasDied) return;

    const children = this.obstaclePool.getChildren();
    for (let index = 0; index < children.length; index += 1) {
      const obstacle = children[index];
      if (!obstacle?.active) continue;
      if (obstacle.getData("nearMissBonusGiven")) continue;

      const type = obstacle.getData("type");
      if (!type || type === OBSTACLE_TYPE.BARREL) continue;
      if (obstacle.y < 460 || obstacle.y > 540) continue;

      const dist = Phaser.Math.Distance.Between(this.scene.cowboy.x, this.scene.cowboy.y, obstacle.x, obstacle.y);
      if (dist < this.scene.constants.NEAR_MISS_THRESHOLD) {
        if (!obstacle.getData("nearMissTriggered")) {
          obstacle.setData("nearMissTriggered", true);
          obstacle.setData("nearMissFrames", 0);
        }

        const nearMissFrames = Number(obstacle.getData("nearMissFrames") || 0) + 1;
        obstacle.setData("nearMissFrames", nearMissFrames);

        if (nearMissFrames >= 3) {
          this.handleNearMiss(obstacle);
        }
      }
    }
  }

  handleBulletHit = (bullet, obstacle) => {
    if (!bullet?.active || !obstacle?.active) return;

    const obstacleType = obstacle.getData("type");

    bullet.setActive(false).setVisible(false);
    if (bullet.body) {
      bullet.body.enable = false;
      bullet.body.setVelocity(0, 0);
    }

    if (obstacleType === OBSTACLE_TYPE.BARREL) {
      this.vfxManager.spawnBarrelHitVfx(obstacle.x, obstacle.y);
      this.scene.cameras?.main?.shake(100, 0.01);

      obstacle.setActive(false).setVisible(false);
      if (obstacle.body) {
        obstacle.body.enable = false;
        obstacle.body.setVelocity(0, 0);
      }
      this.scene.score += 100;
    }
  };
}
