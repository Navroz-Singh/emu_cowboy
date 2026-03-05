import { EVENTS, EventBus } from "@/lib/eventBus";

export class AmmoRefillManager {
  constructor(scene, vfxManager) {
    this.scene = scene;
    this.vfxManager = vfxManager;

    this.refillPool = null;
    this.cowboyRefillOverlap = null;
  }

  initObjectPools() {
    const textureKey = this.scene.textures.exists("bullet-refill") ? "bullet-refill" : "__DEFAULT";

    this.refillPool = this.scene.physics.add.group({ maxSize: 3, runChildUpdate: false });
    for (let index = 0; index < 3; index += 1) {
      const refill = this.refillPool.create(0, -180, textureKey);
      if (!refill) continue;

      refill.setActive(false).setVisible(false);
      refill.setScale(this.scene.constants.BASE_SPRITE_SCALE);
      refill.setDepth(11);
      refill.setData("isCollectible", true);
      refill.setData("type", "ammoRefill");

      if (refill.body) {
        refill.body.enable = false;
      }
    }
  }

  initCollisions() {
    if (!this.scene.physics?.add || !this.scene.cowboy || !this.refillPool?.children?.entries) return;

    this.cowboyRefillOverlap = this.scene.physics.add.overlap(
      this.scene.cowboy,
      this.refillPool,
      this.handleAmmoRefillOverlap,
      undefined,
      this,
    );
  }

  cleanup() {
    const physicsWorld = this.scene.physics?.world;
    if (this.cowboyRefillOverlap && physicsWorld?.removeCollider) {
      physicsWorld.removeCollider(this.cowboyRefillOverlap);
    }
    this.cowboyRefillOverlap = null;

    const refills = this.getRefills();
    for (let index = 0; index < refills.length; index += 1) {
      const refill = refills[index];
      if (!refill?.active) continue;
      this.disableRefill(refill);
    }

    this.refillPool = null;
  }

  update(_dt, moveAmount) {
    const refills = this.getRefills();

    for (let index = 0; index < refills.length; index += 1) {
      const refill = refills[index];
      if (!refill?.active) continue;

      refill.y += moveAmount;

      if (refill.y > this.scene.constants.DESPAWN_Y + 40) {
        this.disableRefill(refill);
      }
    }
  }

  hasActiveRefill() {
    const refills = this.getRefills();
    for (let index = 0; index < refills.length; index += 1) {
      if (refills[index]?.active) return true;
    }
    return false;
  }

  spawnInLane(laneIndex, yOffset = 0) {
    if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex > 2) return null;
    if (!this.refillPool?.children?.entries) return null;

    const refill = this.refillPool.getFirstDead(false);
    if (!refill) return null;

    refill.setPosition(this.scene.lanes[laneIndex], this.scene.constants.SPAWN_Y + Number(yOffset || 0));
    refill.setActive(true).setVisible(true);
    refill.setScale(this.scene.constants.BASE_SPRITE_SCALE);

    if (refill.body) {
      refill.body.enable = true;
      refill.body.setAllowGravity(false);
      refill.body.setVelocity(0, 0);
      refill.body.setSize(50, 50, true);
      refill.body.setOffset(25, 25);
    }

    return refill;
  }

  handleAmmoRefillOverlap = (_cowboy, refill) => {
    if (!refill?.active || this.scene.hasDied || this.scene.isGameOver) return;

    this.disableRefill(refill);
    this.applyAmmoRefill();
  };

  applyAmmoRefill() {
    const maxAmmo = Number(this.scene.constants.AMMO_REFILL_MAX_AMMO || 6);
    this.scene.ammoCount = maxAmmo;
    this.scene.ammo = this.scene.ammoCount;

    this.showAmmoPickupText();
    this.playReloadCue();
    this.spawnReadyVfx();

    EventBus.emit(EVENTS.SCORE_UPDATED, {
      score: this.scene.score,
      ammo: this.scene.ammoCount,
      rabbitsCollected: Number(this.scene.rabbitsCollected || 0),
      coinsCollected: Number(this.scene.coinsCollected || 0),
    });
  }

  showAmmoPickupText() {
    const x = this.scene.cowboy?.x ?? (this.scene.constants.CANVAS_WIDTH / 2);
    const y = (this.scene.cowboy?.y ?? 170) - 95;

    const popup = this.scene.add
      .text(x, y, "+AMMO", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#9dff9d",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.scene.tweens.add({
      targets: popup,
      alpha: 0,
      y: y - 40,
      duration: 650,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (popup?.active) popup.destroy();
      },
    });
  }

  playReloadCue() {
    if (!this.scene.sound?.play) return;
    if (!this.scene.cache?.audio?.exists?.("reload")) return;

    this.scene.sound.play("reload", { volume: 0.5 });
  }

  spawnReadyVfx() {
    if (!this.scene.cowboy) return;

    if (this.scene.textures.exists("vfx")) {
      const flash = this.scene.add.sprite(this.scene.cowboy.x + 14, this.scene.cowboy.y - 10, "vfx", 4).setDepth(22);
      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 140,
        onComplete: () => {
          if (flash?.active) flash.destroy();
        },
      });
      return;
    }

    this.vfxManager?.spawnBarrelHitVfx?.(this.scene.cowboy.x + 10, this.scene.cowboy.y - 6);
  }

  disableRefill(refill) {
    if (!refill) return;

    refill.setActive(false).setVisible(false);

    if (refill.body) {
      refill.body.enable = false;
      refill.body.setVelocity(0, 0);
    }
  }

  getRefills() {
    const entries = this.refillPool?.children?.entries;
    return Array.isArray(entries) ? entries : [];
  }
}
