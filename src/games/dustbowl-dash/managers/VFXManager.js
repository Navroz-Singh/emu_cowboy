import * as Phaser from "phaser";

export class VFXManager {
  constructor(scene) {
    this.scene = scene;
    this.stunStars = [];
    this.stunTimer = null;
  }

  cleanup() {
    if (this.stunTimer) {
      this.stunTimer.remove();
      this.stunTimer = null;
    }

    if (this.stunStars.length > 0) {
      this.stunStars.forEach((star) => {
        if (star?.active) star.destroy();
      });
      this.stunStars = [];
    }
  }

  spawnDustPuff(x, y) {
    if (!this.scene.textures.exists("vfx")) return;

    const frame = Phaser.Math.Between(0, 3);
    const dust = this.scene.add.sprite(x, y, "vfx", frame).setDepth(8).setScale(0.75);

    this.scene.tweens.add({
      targets: dust,
      y: y - 8,
      alpha: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (dust?.active) dust.destroy();
      },
    });
  }

  spawnSpeedLine() {
    if (Phaser.Math.Between(0, 10) > 2) return;

    const x = Phaser.Math.Between(0, 1) === 0 ? Phaser.Math.Between(0, 50) : Phaser.Math.Between(750, 800);
    const line = this.scene.add.rectangle(x, -10, 1, Phaser.Math.Between(20, 60), 0xffffff, 0.25).setDepth(2);
    const speedFactor = Math.max(200, this.scene.gameSpeed * 2);
    const duration = Math.round((660 / speedFactor) * 1000);

    this.scene.tweens.add({
      targets: line,
      y: 650,
      duration,
      ease: "Linear",
      onComplete: () => {
        if (line?.active) line.destroy();
      },
    });
  }

  spawnBarrelHitVfx(x, y) {
    if (!this.scene.textures.exists("vfx")) return;

    const bigBang = this.scene.add.sprite(x, y, "vfx", 5).setDepth(25).setScale(1.35);
    this.scene.tweens.add({
      targets: bigBang,
      alpha: 0,
      scaleX: 1.75,
      scaleY: 1.75,
      duration: 220,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (bigBang?.active) bigBang.destroy();
      },
    });

    for (let index = 0; index < 4; index += 1) {
      const dustFrame = Phaser.Math.Between(0, 3);
      const dust = this.scene.add.sprite(x, y, "vfx", dustFrame).setDepth(24).setScale(0.9);
      this.scene.tweens.add({
        targets: dust,
        x: x + Phaser.Math.Between(-36, 36),
        y: y + Phaser.Math.Between(-24, 24),
        alpha: 0,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 260,
        ease: "Quad.easeOut",
        onComplete: () => {
          if (dust?.active) dust.destroy();
        },
      });
    }
  }

  spawnStunStars() {
    const cowboy = this.scene.cowboy;
    if (!cowboy) return;

    this.cleanup();

    const starCount = 3;
    for (let index = 0; index < starCount; index += 1) {
      const star = this.scene.textures.exists("vfx")
        ? this.scene.add.sprite(cowboy.x, cowboy.y - 40, "vfx", 7)
        : this.scene.add.circle(cowboy.x, cowboy.y - 40, 6, 0xffe066, 1);

      star.setDepth((cowboy.depth || 10) + 2);
      star.setData("orbitAngle", (index / starCount) * Math.PI * 2);
      this.stunStars.push(star);
    }

    this.stunTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!this.scene.cowboy || this.stunStars.length === 0) return;
        this.stunStars.forEach((star) => {
          const angle = (star.getData("orbitAngle") || 0) + 0.08;
          star.setData("orbitAngle", angle);
          star.x = this.scene.cowboy.x + Math.cos(angle) * 28;
          star.y = this.scene.cowboy.y - 40 + Math.sin(angle) * 10;
        });
      },
    });
  }
}
