import { EVENTS, EventBus } from "@/lib/eventBus";
import { OBSTACLE_TYPE } from "@/games/dustbowl-dash/constants/GameConstants";

export class EnemyManager {
  constructor(scene, obstacleManager, vfxManager) {
    this.scene = scene;
    this.obstacleManager = obstacleManager;
    this.vfxManager = vfxManager;

    this.hostileBulletPool = null;
    this.cowboyHostileBulletOverlap = null;
  }

  initObjectPools() {
    const hostileTextureKey = this.scene.textures.exists("bullet") ? "bullet" : "__DEFAULT";

    this.hostileBulletPool = this.scene.physics.add.group({ maxSize: 12, runChildUpdate: false });
    for (let index = 0; index < 12; index += 1) {
      const hostileBullet = this.hostileBulletPool.create(0, -220, hostileTextureKey);
      if (!hostileBullet) continue;
      hostileBullet.setActive(false).setVisible(false);
      hostileBullet.setScale(this.scene.constants.BASE_SPRITE_SCALE);
      if (hostileBullet.body) {
        hostileBullet.body.enable = false;
      }
    }
  }

  initCollisions() {
    if (!this.scene.physics?.add || !this.scene.cowboy || !this.hostileBulletPool?.children?.entries) return;

    this.cowboyHostileBulletOverlap = this.scene.physics.add.overlap(
      this.scene.cowboy,
      this.hostileBulletPool,
      this.handleHostileBulletHit,
      undefined,
      this,
    );
  }

  cleanup() {
    const physicsWorld = this.scene.physics?.world;
    if (this.cowboyHostileBulletOverlap && physicsWorld?.removeCollider) {
      physicsWorld.removeCollider(this.cowboyHostileBulletOverlap);
    }
    this.cowboyHostileBulletOverlap = null;

    const hostileBullets = this.getHostileBullets();
    for (let index = 0; index < hostileBullets.length; index += 1) {
      const bullet = hostileBullets[index];
      if (!bullet?.active) continue;
      bullet.setActive(false).setVisible(false);
      if (bullet.body) {
        bullet.body.enable = false;
        bullet.body.setVelocity(0, 0);
      }
    }

    this.hostileBulletPool = null;
  }

  update(dt, moveAmount) {
    this.updateBanditAmbushes();
    this.updateHostileBullets(dt, moveAmount);
  }

  updateBanditAmbushes() {
    const obstacles = this.obstacleManager?.obstaclePool?.getChildren?.() || [];

    for (let index = 0; index < obstacles.length; index += 1) {
      const obstacle = obstacles[index];
      if (!obstacle?.active) continue;
      if (obstacle.getData("type") !== OBSTACLE_TYPE.ROCK_BANDIT) continue;

      const neutralized = Boolean(obstacle.getData("isBanditNeutralized"));
      if (neutralized) {
        obstacle.setFrame?.(4);
        obstacle.setData("banditState", "spent");
        continue;
      }

      const now = this.scene.time.now;
      const triggerY = this.scene.constants.BANDIT_TRIGGER_Y;
      const phaseDuration = this.scene.constants.BANDIT_PHASE_DURATION_MS;
      const state = obstacle.getData("banditState") || "rock";
      const phaseAt = Number(obstacle.getData("banditPhaseAt") || 0);

      if (state === "rock") {
        obstacle.setFrame?.(0);
        if (obstacle.y >= triggerY) {
          obstacle.setData("banditState", "peek");
          obstacle.setData("banditPhaseAt", now + phaseDuration);
          obstacle.setFrame?.(1);
        }
        continue;
      }

      if (state === "peek" && now >= phaseAt) {
        obstacle.setData("banditState", "aim");
        obstacle.setData("banditPhaseAt", now + phaseDuration);
        obstacle.setFrame?.(2);
        continue;
      }

      if (state === "aim" && now >= phaseAt) {
        obstacle.setData("banditState", "fire");
        obstacle.setData("banditPhaseAt", now + phaseDuration);
        obstacle.setFrame?.(3);

        const hasFired = Boolean(obstacle.getData("banditFired"));
        if (!hasFired) {
          obstacle.setData("banditFired", true);
          this.spawnHostileBullet(obstacle.x, obstacle.y + 24);
        }
        continue;
      }

      if (state === "fire" && now >= phaseAt) {
        obstacle.setData("banditState", "spent");
        obstacle.setFrame?.(4);
      }
    }
  }

  updateHostileBullets(dt, moveAmount) {
    const hostileBullets = this.getHostileBullets();

    for (let index = 0; index < hostileBullets.length; index += 1) {
      const bullet = hostileBullets[index];
      if (!bullet?.active) continue;

      const bulletSpeed = Number(bullet.getData("speed") || this.scene.constants.BANDIT_HOSTILE_BULLET_SPEED);
      bullet.y += moveAmount + bulletSpeed * Math.max(0, dt);

      if (bullet.y > this.scene.constants.DESPAWN_Y + 40) {
        this.disableHostileBullet(bullet);
      }
    }
  }

  spawnHostileBullet(x, y) {
    if (!this.hostileBulletPool?.children?.entries) return;

    const hostileBullet = this.hostileBulletPool.getFirstDead(false);
    if (!hostileBullet) return;

    hostileBullet.setPosition(x, y);
    hostileBullet.setActive(true).setVisible(true);
    hostileBullet.setData("isHostileProjectile", true);
    hostileBullet.setData("speed", this.scene.constants.BANDIT_HOSTILE_BULLET_SPEED);

    if (hostileBullet.body) {
      hostileBullet.body.enable = true;
      hostileBullet.body.setAllowGravity(false);
      hostileBullet.body.setVelocity(0, 0);
      hostileBullet.body.setSize(8, 16, true);
      hostileBullet.body.setOffset(0, 0);
    }
  }

  handleBanditShot(obstacle) {
    if (!obstacle?.active) return false;
    if (obstacle.getData("type") !== OBSTACLE_TYPE.ROCK_BANDIT) return false;

    const state = obstacle.getData("banditState") || "rock";
    const hasFired = Boolean(obstacle.getData("banditFired"));
    if (hasFired || state === "fire" || state === "spent") {
      return false;
    }

    obstacle.setData("isBanditNeutralized", true);
    obstacle.setData("banditState", "spent");
    obstacle.setData("banditFired", true);
    obstacle.setFrame?.(4);
    this.vfxManager?.spawnBarrelHitVfx(obstacle.x, obstacle.y - 6);
    this.scene.cameras?.main?.shake(90, 0.008);
    this.obstacleManager?.disablePooledObject?.(obstacle);

    return true;
  }

  disableHostileBullet(bullet) {
    if (!bullet) return;

    bullet.setActive(false).setVisible(false);
    if (bullet.body) {
      bullet.body.enable = false;
      bullet.body.setVelocity(0, 0);
    }
    bullet.setData("isHostileProjectile", false);
  }

  getHostileBullets() {
    const entries = this.hostileBulletPool?.children?.entries;
    return Array.isArray(entries) ? entries : [];
  }

  handleHostileBulletHit = (_cowboy, bullet) => {
    if (!bullet?.active || this.scene.hasDied || this.scene.isGameOver) return;
    this.disableHostileBullet(bullet);
    this.triggerPlayerDeath();
  };

  triggerPlayerDeath() {
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
}
