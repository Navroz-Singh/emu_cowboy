import * as Phaser from "phaser";

import { EVENTS, EventBus } from "@/lib/eventBus";
import { ACTION_STATE } from "@/games/dustbowl-dash/constants/GameConstants";

export class PlayerController {
  constructor(scene, obstacleManager) {
    this.scene = scene;
    this.obstacleManager = obstacleManager;
    this.scene.isJumpInProgress = false;
    this.jumpChainCount = 0;
    this.activeJumpTween = null;
    this.activeShadowJumpTween = null;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.activeTouchPointerId = null;
    this.gestureResolved = false;
    this.lastTapTime = 0;
    this.pendingTapShotEvent = null;
    this.touchEnabled = false;

    this.gestureThresholds = {
      swipeMinDistance: 38,
      swipeAxisBias: 1.2,
      tapMaxDistance: 16,
      tapMaxDurationMs: 260,
      doubleTapWindowMs: 250,
    };

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
  }

  initKeyboard() {
    if (this.scene.input?.keyboard) {
      this.scene.cursors = this.scene.input.keyboard.createCursorKeys();
      this.scene.keys = this.scene.input.keyboard.addKeys({
        leftA: Phaser.Input.Keyboard.KeyCodes.A,
        rightD: Phaser.Input.Keyboard.KeyCodes.D,
        jumpSpace: Phaser.Input.Keyboard.KeyCodes.SPACE,
        lassoE: Phaser.Input.Keyboard.KeyCodes.E,
        shootF: Phaser.Input.Keyboard.KeyCodes.F,
      });
    }

    this.initTouchControls();
  }

  initTouchControls() {
    if (!this.scene.input) return;

    const hasTouchDevice = Boolean(this.scene.sys?.game?.device?.input?.touch);
    let hasCoarsePointer = false;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    }

    this.touchEnabled = hasTouchDevice || hasCoarsePointer;
    if (!this.touchEnabled) return;

    this.scene.input.on("pointerdown", this.handlePointerDown);
    this.scene.input.on("pointermove", this.handlePointerMove);
    this.scene.input.on("pointerup", this.handlePointerUp);
  }

  processInput() {
    if (this.scene.isGameOver) return;
    if (!this.scene.keys || !this.scene.cursors) return;

    if (Phaser.Input.Keyboard.JustDown(this.scene.keys.leftA) || Phaser.Input.Keyboard.JustDown(this.scene.cursors.left)) {
      this.handleLaneSwitchInput(-1);
    }

    if (Phaser.Input.Keyboard.JustDown(this.scene.keys.rightD) || Phaser.Input.Keyboard.JustDown(this.scene.cursors.right)) {
      this.handleLaneSwitchInput(1);
    }

    if (Phaser.Input.Keyboard.JustDown(this.scene.keys.jumpSpace) || Phaser.Input.Keyboard.JustDown(this.scene.cursors.up)) {
      this.handleJumpInput();
    }

    if (Phaser.Input.Keyboard.JustDown(this.scene.keys.shootF)) {
      if (this.canUseActionWhileMoving() && !this.scene.cowboyOnTrain) {
        this.quickDraw();
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.scene.keys.lassoE)) {
      if (this.canUseActionWhileMoving() && !this.scene.cowboyOnTrain) {
        this.throwLasso();
      }
    }
  }

  handleJumpInput() {
    if (this.scene.trainHeistManager?.isHeistActive && this.scene.cowboyOnTrain) {
      this.scene.trainHeistManager?.tryReturnToHorse?.();
      return;
    }

    const canJumpNow = this.scene.actionState === ACTION_STATE.IDLE || (this.scene.isJumpInProgress && this.jumpChainCount < 2);
    if (!canJumpNow) return;

    if (this.scene.trainHeistManager?.isHeistActive) {
      if (this.scene.actionState === ACTION_STATE.IDLE) {
        this.scene.trainHeistManager?.tryLeapToTrain?.();
        return;
      }
    }

    this.jump();
  }

  handlePointerDown(pointer) {
    if (!this.touchEnabled || this.scene.isGameOver) return;
    if (!pointer) return;
    if (this.activeTouchPointerId !== null) return;

    this.activeTouchPointerId = pointer.id;
    this.touchStartX = Number(pointer.worldX ?? pointer.x ?? 0);
    this.touchStartY = Number(pointer.worldY ?? pointer.y ?? 0);
    this.touchStartTime = this.scene.time.now;
    this.gestureResolved = false;
  }

  handlePointerMove(pointer) {
    if (!this.touchEnabled || this.scene.isGameOver || this.scene.hasDied) return;
    if (!pointer) return;
    if (this.activeTouchPointerId !== pointer.id) return;
    if (this.gestureResolved) return;

    const currentX = Number(pointer.worldX ?? pointer.x ?? 0);
    const currentY = Number(pointer.worldY ?? pointer.y ?? 0);
    const dx = currentX - this.touchStartX;
    const dy = currentY - this.touchStartY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const { swipeMinDistance, swipeAxisBias } = this.gestureThresholds;

    if (absX >= swipeMinDistance && absX > absY * swipeAxisBias) {
      this.cancelPendingTapShot();
      this.handleLaneSwitchInput(dx > 0 ? 1 : -1);
      this.gestureResolved = true;
      return;
    }

    if (dy <= -swipeMinDistance && absY > absX * swipeAxisBias) {
      this.cancelPendingTapShot();
      this.handleJumpInput();
      this.gestureResolved = true;
    }
  }

  handlePointerUp(pointer) {
    if (!this.touchEnabled || this.scene.isGameOver || this.scene.hasDied) return;
    if (!pointer) return;
    if (this.activeTouchPointerId !== pointer.id) return;

    const endedWithResolvedGesture = this.gestureResolved;
    this.activeTouchPointerId = null;
    this.gestureResolved = false;

    if (endedWithResolvedGesture) {
      return;
    }

    const endX = Number(pointer.worldX ?? pointer.x ?? 0);
    const endY = Number(pointer.worldY ?? pointer.y ?? 0);
    const dx = endX - this.touchStartX;
    const dy = endY - this.touchStartY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const elapsedMs = Math.max(0, this.scene.time.now - this.touchStartTime);
    const { swipeMinDistance, swipeAxisBias, tapMaxDistance, tapMaxDurationMs } = this.gestureThresholds;

    if (absX >= swipeMinDistance && absX > absY * swipeAxisBias) {
      this.cancelPendingTapShot();
      this.handleLaneSwitchInput(dx > 0 ? 1 : -1);
      return;
    }

    if (dy <= -swipeMinDistance && absY > absX * swipeAxisBias) {
      this.cancelPendingTapShot();
      this.handleJumpInput();
      return;
    }

    if (absX <= tapMaxDistance && absY <= tapMaxDistance && elapsedMs <= tapMaxDurationMs) {
      this.handleTapAction();
    }
  }

  handleTapAction() {
    const hasActiveRabbit = Boolean(this.scene.spawnerSystem?.hasActiveRabbit?.());
    const now = this.scene.time.now;
    const withinDoubleTapWindow = (now - this.lastTapTime) <= this.gestureThresholds.doubleTapWindowMs;

    if (hasActiveRabbit && withinDoubleTapWindow) {
      this.cancelPendingTapShot();
      if (this.canUseActionWhileMoving() && !this.scene.cowboyOnTrain) {
        this.throwLasso();
      }
      this.lastTapTime = 0;
      return;
    }

    this.lastTapTime = now;

    if (!hasActiveRabbit) {
      if (this.canUseActionWhileMoving() && !this.scene.cowboyOnTrain) {
        this.quickDraw();
      }
      return;
    }

    this.cancelPendingTapShot();
    this.pendingTapShotEvent = this.scene.time.delayedCall(this.gestureThresholds.doubleTapWindowMs, () => {
      this.pendingTapShotEvent = null;
      if (this.scene.hasDied || this.scene.isGameOver) return;
      if (this.canUseActionWhileMoving() && !this.scene.cowboyOnTrain) {
        this.quickDraw();
      }
    });
  }

  cancelPendingTapShot() {
    if (!this.pendingTapShotEvent) return;
    this.pendingTapShotEvent.remove(false);
    this.pendingTapShotEvent = null;
  }

  cleanup() {
    this.cancelPendingTapShot();

    if (this.scene.input) {
      this.scene.input.off("pointerdown", this.handlePointerDown);
      this.scene.input.off("pointermove", this.handlePointerMove);
      this.scene.input.off("pointerup", this.handlePointerUp);
    }

    this.touchEnabled = false;
    this.activeTouchPointerId = null;
    this.gestureResolved = false;
  }

  canUseActionWhileMoving() {
    return (
      this.scene.actionState === ACTION_STATE.IDLE
      || this.scene.actionState === ACTION_STATE.JUMPING
      || this.scene.actionState === ACTION_STATE.SWITCHING
    );
  }

  handleLaneSwitchInput(direction) {
    if (this.scene.actionState === ACTION_STATE.IDLE || this.scene.actionState === ACTION_STATE.JUMPING) {
      this.switchLane(direction);
      return;
    }

    if (this.scene.actionState === ACTION_STATE.SWITCHING) {
      this.scene.inputBuffer = direction;
      this.scene.time.delayedCall(this.scene.constants.INPUT_BUFFER_WINDOW, () => {
        if (this.scene.actionState === ACTION_STATE.SWITCHING) {
          this.scene.inputBuffer = null;
        }
      });
    }
  }

  switchLane(direction) {
    const newLane = this.scene.currentLane + direction;

    if (newLane < 0 || newLane > 2 || !this.scene.cowboy) return;

    const preserveJumpState = this.scene.actionState === ACTION_STATE.JUMPING || this.scene.isJumpInProgress;
    this.scene.actionState = ACTION_STATE.SWITCHING;
    const switchDuration = this.scene.constants.SWITCH_DURATION;

    this.scene.tweens.add({
      targets: this.scene.cowboy,
      x: this.scene.lanes[newLane],
      duration: switchDuration,
      ease: "Sine.easeInOut",
      onStart: () => {
        this.scene.cowboy.angle = direction > 0 ? 20 : -20;
      },
      onComplete: () => {
        this.scene.cowboy.angle = 0;
        this.scene.cowboy.x = this.scene.lanes[newLane];
        this.scene.currentLane = newLane;

        if (this.scene.inputBuffer !== null) {
          const bufferedDirection = this.scene.inputBuffer;
          this.scene.inputBuffer = null;
          const didStartBufferedSwitch = this.switchLane(bufferedDirection);
          if (!didStartBufferedSwitch && this.scene.actionState === ACTION_STATE.SWITCHING) {
            this.scene.actionState = preserveJumpState && this.scene.isJumpInProgress ? ACTION_STATE.JUMPING : ACTION_STATE.IDLE;
          }
          return;
        }

        if (this.scene.actionState === ACTION_STATE.SWITCHING) {
          this.scene.actionState = preserveJumpState && this.scene.isJumpInProgress ? ACTION_STATE.JUMPING : ACTION_STATE.IDLE;
        }
      },
    });

    if (this.scene.shadow) {
      this.scene.tweens.add({
        targets: this.scene.shadow,
        x: this.scene.lanes[newLane],
        duration: switchDuration,
        ease: "Sine.easeInOut",
      });
    }

    return true;
  }

  jump() {
    if (!this.scene.cowboy) return;

    const canStartPrimaryJump = this.scene.actionState === ACTION_STATE.IDLE && !this.scene.isJumpInProgress;
    const canTriggerDoubleJump = this.scene.isJumpInProgress && this.jumpChainCount === 1;
    if (!canStartPrimaryJump && !canTriggerDoubleJump) return;

    this.jumpChainCount += 1;

    if (this.activeJumpTween) {
      this.activeJumpTween.stop();
      this.activeJumpTween = null;
    }
    if (this.activeShadowJumpTween) {
      this.activeShadowJumpTween.stop();
      this.activeShadowJumpTween = null;
    }

    this.resetJumpVisualState();

    this.scene.isJumpInProgress = true;
    this.scene.actionState = ACTION_STATE.JUMPING;

    this.activeJumpTween = this.scene.tweens.add({
      targets: this.scene.cowboy,
      scaleX: this.scene.constants.BASE_SPRITE_SCALE * 1.15,
      scaleY: this.scene.constants.BASE_SPRITE_SCALE * 1.15,
      duration: this.scene.constants.JUMP_DURATION / 2,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.activeJumpTween = null;
        this.scene.isJumpInProgress = false;
        this.jumpChainCount = 0;
        this.resetJumpVisualState();
        if (this.scene.actionState !== ACTION_STATE.SWITCHING) {
          this.scene.actionState = ACTION_STATE.IDLE;
        }
      },
    });

    if (this.scene.shadow) {
      this.activeShadowJumpTween = this.scene.tweens.add({
        targets: this.scene.shadow,
        alpha: 0.35,
        y: this.scene.shadowBaseY + 40,
        duration: this.scene.constants.JUMP_DURATION / 2,
        yoyo: true,
        ease: "Quad.easeOut",
        onComplete: () => {
          this.activeShadowJumpTween = null;
          this.resetJumpVisualState();
        },
      });
    }
  }

  resetJumpVisualState() {
    if (this.scene.cowboy) {
      this.scene.cowboy.setScale(this.scene.constants.BASE_SPRITE_SCALE);
    }

    if (this.scene.shadow) {
      this.scene.shadow.alpha = 0.5;
      this.scene.shadow.y = this.scene.shadowBaseY;
    }
  }

  quickDraw() {
    if (!this.scene.cowboy || !this.canUseActionWhileMoving()) return;

    if (this.scene.ammoCount <= 0) {
      this.scene.cameras?.main?.shake(70, 0.004);
      this.scene.tweens.add({
        targets: this.scene.cowboy,
        angle: this.scene.cowboy.angle + 6,
        duration: 40,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          if (this.scene.cowboy) {
            this.scene.cowboy.angle = 0;
          }
        },
      });
      return;
    }

    this.scene.actionState = ACTION_STATE.SHOOTING;
    this.scene.ammoCount -= 1;
    this.scene.ammo = this.scene.ammoCount;

    if (this.scene.textures.exists("cowboy-actions")) {
      this.scene.cowboy.setTexture("cowboy-actions", 0);
    }

    const bullet = this.obstacleManager.bulletPool?.getFirstDead(false);
    if (bullet) {
      bullet.setPosition(this.scene.cowboy.x, this.scene.cowboy.y - 30);
      bullet.setActive(true).setVisible(true);
      if (bullet.body) {
        bullet.body.enable = true;
        bullet.body.setVelocity(0, -this.scene.constants.BULLET_SPEED);
      }
    }

    if (this.scene.textures.exists("vfx")) {
      const flash = this.scene.add.sprite(this.scene.cowboy.x, this.scene.cowboy.y - 20, "vfx", 4).setDepth(20);
      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 100,
        onComplete: () => {
          if (flash?.active) flash.destroy();
        },
      });
    }

    this.scene.cameras?.main?.shake(100, 0.01);

    this.scene.time.delayedCall(this.scene.constants.SHOOT_DURATION, () => {
      if (!this.scene.cowboy) return;
      if (this.scene.textures.exists("cowboy-gallop")) {
        this.scene.cowboy.setTexture("cowboy-gallop", 0);
      }
      if (this.scene.anims.exists("gallop")) {
        this.scene.cowboy.play("gallop", true);
      }
      if (this.scene.isJumpInProgress) {
        this.scene.actionState = ACTION_STATE.JUMPING;
      } else {
        this.scene.actionState = ACTION_STATE.IDLE;
      }
    });
  }

  throwLasso() {
    if (!this.canUseActionWhileMoving() || !this.scene.cowboy) return;

    const rabbit = this.scene.spawnerSystem?.findNearestRabbit(this.scene.cowboy.x, this.scene.cowboy.y);
    if (!rabbit) return;

    this.scene.actionState = ACTION_STATE.LASSOING;

    const baseAngle = this.scene.cowboy.angle;
    this.scene.tweens.add({
      targets: this.scene.cowboy,
      angle: baseAngle + 6,
      duration: 50,
      yoyo: true,
      repeat: 7,
      ease: "Sine.easeInOut",
      onComplete: () => {
        if (this.scene.cowboy) {
          this.scene.cowboy.angle = 0;
        }
      },
    });

    if (this.scene.textures.exists("cowboy-actions")) {
      this.scene.cowboy.setTexture("cowboy-actions", 1);
      this.scene.time.delayedCall(90, () => {
        if (this.scene.cowboy && this.scene.textures.exists("cowboy-actions")) {
          this.scene.cowboy.setTexture("cowboy-actions", 2);
        }
      });
    }

    if (!this.scene.textures.exists("vfx")) {
      this.scene.time.delayedCall(this.scene.constants.LASSO_DURATION, () => {
        if (!this.scene.cowboy) return;
        if (this.scene.textures.exists("cowboy-gallop")) {
          this.scene.cowboy.setTexture("cowboy-gallop", 0);
        }
        if (this.scene.anims.exists("gallop")) {
          this.scene.cowboy.play("gallop", true);
        }
        this.scene.actionState = ACTION_STATE.IDLE;
      });
      return;
    }

    const lasso = this.scene.add.sprite(this.scene.cowboy.x, this.scene.cowboy.y, "vfx", 6).setDepth(22);
    const startX = this.scene.cowboy.x;
    const startY = this.scene.cowboy.y;
    const targetX = rabbit.x;
    const targetY = rabbit.y;
    const midX = (startX + targetX) / 2;
    const midY = Math.min(startY, targetY) - 60;

    const arcState = { t: 0 };
    this.scene.tweens.add({
      targets: arcState,
      t: 1,
      duration: 260,
      ease: "Linear",
      onUpdate: () => {
        const t = Phaser.Math.Clamp(arcState.t, 0, 1);
        const inv = 1 - t;
        lasso.x = inv * inv * startX + 2 * inv * t * midX + t * t * targetX;
        lasso.y = inv * inv * startY + 2 * inv * t * midY + t * t * targetY;
      },
      onComplete: () => {
        const caught = this.scene.spawnerSystem?.handleRabbitCaught(rabbit);

        if (caught) {
          EventBus.emit(EVENTS.SCORE_UPDATED, {
            score: this.scene.score,
            ammo: this.scene.ammoCount,
            rabbitsCollected: Number(this.scene.rabbitsCollected || 0),
            coinsCollected: Number(this.scene.coinsCollected || 0),
          });

          const savedSpeed = this.scene.gameSpeed;
          const transientMs = 500;
          this.scene.transientSpeedRestoreSpeed = Math.max(Number(this.scene.transientSpeedRestoreSpeed || 0), savedSpeed);
          this.scene.transientSpeedUntil = this.scene.time.now + transientMs;
          this.scene.gameSpeed = Math.max(120, this.scene.gameSpeed * 0.3);
          this.scene.time.delayedCall(transientMs, () => {
            if (!this.scene.hasDied && !this.scene.isGameOver) {
              this.scene.gameSpeed = Math.max(savedSpeed, this.scene.gameSpeed);
            }

            if (this.scene.time.now >= Number(this.scene.transientSpeedUntil || 0)) {
              this.scene.transientSpeedRestoreSpeed = 0;
              this.scene.transientSpeedUntil = 0;
            }
          });

          this.scene.tweens.add({
            targets: lasso,
            x: this.scene.cowboy.x,
            y: this.scene.cowboy.y,
            duration: 300,
            onComplete: () => {
              if (lasso?.active) lasso.destroy();
            },
          });
        } else {
          this.scene.tweens.add({
            targets: lasso,
            x: this.scene.cowboy.x,
            y: this.scene.cowboy.y,
            duration: 200,
            onComplete: () => {
              if (lasso?.active) lasso.destroy();
            },
          });
        }
      },
    });

    this.scene.time.delayedCall(this.scene.constants.LASSO_DURATION, () => {
      if (!this.scene.cowboy) return;
      if (this.scene.textures.exists("cowboy-gallop")) {
        this.scene.cowboy.setTexture("cowboy-gallop", 0);
      }
      if (this.scene.anims.exists("gallop")) {
        this.scene.cowboy.play("gallop", true);
      }
      if (this.scene.isJumpInProgress) {
        this.scene.actionState = ACTION_STATE.JUMPING;
      } else {
        this.scene.actionState = ACTION_STATE.IDLE;
      }
    });
  }
}
