import * as Phaser from "phaser";

export class QuicksandManager {
  constructor(scene) {
    this.scene = scene;

    this.quicksandPool = null;
    this.cowboyQuicksandOverlap = null;

    this.nextQuicksandSpawnScore = Number(this.scene?.constants?.QUICKSAND_SCORE_INTERVAL || 2200);
    this.debuffActive = false;
    this.debuffEndsAt = 0;
    this.speedBeforeDebuff = 0;
    this.recoveryTween = null;
  }

  initObjectPools() {
    const textureKey = this.scene.textures.exists("quicksand") ? "quicksand" : "__DEFAULT";

    this.quicksandPool = this.scene.physics.add.group({ maxSize: 6, runChildUpdate: false });
    for (let index = 0; index < 6; index += 1) {
      const trap = this.quicksandPool.create(0, -180, textureKey);
      if (!trap) continue;

      trap.setActive(false).setVisible(false);
      trap.setScale(this.scene.constants.BASE_SPRITE_SCALE);
      trap.setDepth(6);

      if (trap.body) {
        trap.body.enable = false;
      }
    }
  }

  initCollisions() {
    if (!this.scene.physics?.add || !this.scene.cowboy || !this.quicksandPool?.children?.entries) return;

    this.cowboyQuicksandOverlap = this.scene.physics.add.overlap(
      this.scene.cowboy,
      this.quicksandPool,
      this.handleQuicksandOverlap,
      undefined,
      this,
    );
  }

  cleanup() {
    const physicsWorld = this.scene.physics?.world;
    if (this.cowboyQuicksandOverlap && physicsWorld?.removeCollider) {
      physicsWorld.removeCollider(this.cowboyQuicksandOverlap);
    }
    this.cowboyQuicksandOverlap = null;

    if (this.recoveryTween) {
      this.recoveryTween.stop();
      this.recoveryTween = null;
    }

    const traps = this.getQuicksandTraps();
    for (let index = 0; index < traps.length; index += 1) {
      const trap = traps[index];
      if (!trap?.active) continue;
      this.disableTrap(trap);
    }

    this.debuffActive = false;
    this.debuffEndsAt = 0;
    this.speedBeforeDebuff = 0;
    this.quicksandPool = null;
    this.nextQuicksandSpawnScore = Number(this.scene?.constants?.QUICKSAND_SCORE_INTERVAL || 2200);
  }

  update(_dt, moveAmount) {
    this.updateTraps(moveAmount);
  }

  updateTraps(moveAmount) {
    const traps = this.getQuicksandTraps();

    for (let index = 0; index < traps.length; index += 1) {
      const trap = traps[index];
      if (!trap?.active) continue;

      trap.y += moveAmount;

      if (trap.y > this.scene.constants.DESPAWN_Y + 90) {
        this.disableTrap(trap);
      }
    }
  }

  hasActiveQuicksand() {
    const traps = this.getQuicksandTraps();
    for (let index = 0; index < traps.length; index += 1) {
      if (traps[index]?.active) return true;
    }
    return false;
  }

  spawnInLane(laneIndex, yOffset = 0) {
    if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex > 2) return null;
    if (!this.quicksandPool?.children?.entries) return null;

    const trap = this.quicksandPool?.getFirstDead?.(false);
    if (!trap) return null;

    trap.setPosition(this.scene.lanes[laneIndex], this.scene.constants.SPAWN_Y - 20 + Number(yOffset || 0));
    trap.setActive(true).setVisible(true);
    trap.setScale(this.scene.constants.BASE_SPRITE_SCALE);

    if (trap.body) {
      trap.body.enable = true;
      trap.body.setAllowGravity(false);
      trap.body.setVelocity(0, 0);
      trap.body.setSize(56, 56, true);
      trap.body.setOffset(22, 22);
    }

    if (this.scene.anims.exists("quicksand-swirl")) {
      trap.play("quicksand-swirl", true);
    }

    return trap;
  }

  handleQuicksandOverlap = (_cowboy, trap) => {
    if (!trap?.active || this.scene.hasDied || this.scene.isGameOver) return;

    if (this.debuffActive && this.scene.time.now < this.debuffEndsAt) {
      return;
    }

    this.applyDebuff();
  };

  applyDebuff() {
    this.debuffActive = true;
    const debuffMs = Number(this.scene.constants.QUICKSAND_DEBUFF_MS || 2500);
    this.debuffEndsAt = this.scene.time.now + debuffMs;

    const slowFactor = Number(this.scene.constants.QUICKSAND_SLOW_FACTOR || 0.5);
    this.speedBeforeDebuff = Math.max(this.scene.constants.INITIAL_SPEED, this.scene.gameSpeed);
    this.scene.gameSpeed = Math.max(120, this.speedBeforeDebuff * slowFactor);

    this.showSinkingText();

    this.scene.time.delayedCall(debuffMs, () => {
      if (this.scene.hasDied || this.scene.isGameOver) return;
      if (this.scene.time.now < this.debuffEndsAt) return;

      const recoveryMs = Number(this.scene.constants.QUICKSAND_RECOVERY_MS || 450);
      const targetSpeed = Math.min(this.speedBeforeDebuff, this.scene.constants.MAX_SPEED);

      if (this.recoveryTween) {
        this.recoveryTween.stop();
      }

      this.recoveryTween = this.scene.tweens.add({
        targets: this.scene,
        gameSpeed: targetSpeed,
        duration: recoveryMs,
        ease: "Quad.easeOut",
        onComplete: () => {
          this.recoveryTween = null;
          this.debuffActive = false;
        },
      });
    });
  }

  showSinkingText() {
    const text = this.scene.add
      .text(this.scene.constants.CANVAS_WIDTH / 2, 140, "Sinking!", {
        fontFamily: "monospace",
        fontSize: "30px",
        color: "#f6d365",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      y: 98,
      duration: 900,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (text?.active) text.destroy();
      },
    });
  }

  disableTrap(trap) {
    if (!trap) return;

    trap.setActive(false).setVisible(false);
    trap.stop?.();

    if (trap.body) {
      trap.body.enable = false;
      trap.body.setVelocity(0, 0);
    }
  }

  getQuicksandTraps() {
    const entries = this.quicksandPool?.children?.entries;
    return Array.isArray(entries) ? entries : [];
  }
}
