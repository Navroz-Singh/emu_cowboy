import * as Phaser from "phaser";

import { EVENTS, EventBus } from "@/lib/eventBus";
import { ACTION_STATE, GAME_CONSTANTS } from "@/games/dustbowl-dash/constants/GameConstants";
import { ObstacleManager } from "@/games/dustbowl-dash/managers/ObstacleManager";
import { PlayerController } from "@/games/dustbowl-dash/managers/PlayerController";
import { SpawnerSystem } from "@/games/dustbowl-dash/managers/SpawnerSystem";
import { VFXManager } from "@/games/dustbowl-dash/managers/VFXManager";

const SCORE_EMIT_INTERVAL_MS = GAME_CONSTANTS.SCORE_EMIT_INTERVAL;

export class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");

    this.constants = GAME_CONSTANTS;

    this.score = 0;
    this.gameSpeed = this.constants.INITIAL_SPEED;
    this.isGameOver = false;
    this.actionState = ACTION_STATE.IDLE;
    this.inputBuffer = null;
    this.currentLane = 1;
    this.ammo = 6;
    this.ammoCount = 6;
    this.lastScoreEmit = 0;
    this.startTime = 0;
    this.distanceTraveled = 0;
    this.nextSpawnDistance = 600;
    this.spawnGapTier = 600;
    this.nextRabbitCheckpointIndex = 0;
    this.surgeTimer = 0;
    this.surgePhase = "plateau";

    this.trackLines = this.constants.TRACK_LINES;
    this.lanes = this.constants.LANE_CENTERS;

    this.runStartAt = 0;
    this.scoreAccumulator = 0;
    this.scoreCarry = 0;
    this.lastScoreEmitAt = 0;
    this.hasDied = false;

    this.cursors = null;
    this.keys = null;
    this.surgeTweenActive = false;
    this.shadowBaseY = 530;

    this.vfxManager = null;
    this.obstacleManager = null;
    this.playerController = null;
    this.spawnerSystem = null;
  }

  create() {
    this.cleanupSceneSystems();

    this.score = 0;
    this.gameSpeed = this.constants.INITIAL_SPEED;
    this.isGameOver = false;
    this.actionState = ACTION_STATE.IDLE;
    this.inputBuffer = null;
    this.currentLane = 1;
    this.ammo = 6;
    this.ammoCount = 6;
    this.hasDied = false;
    this.startTime = Date.now();
    this.runStartAt = this.time.now;
    this.lastScoreEmit = this.time.now;
    this.lastScoreEmitAt = this.time.now;
    this.scoreAccumulator = 0;
    this.scoreCarry = 0;
    this.distanceTraveled = 0;
    this.nextSpawnDistance = 600;
    this.spawnGapTier = 600;
    this.nextRabbitCheckpointIndex = 0;
    this.surgeTimer = 0;
    this.surgePhase = "plateau";

    const hasDesertTexture = this.textures.exists("desert-bg");
    this.bg = hasDesertTexture
      ? this.add.tileSprite(0, 0, this.constants.CANVAS_WIDTH, this.constants.CANVAS_HEIGHT, "desert-bg").setOrigin(0, 0)
      : this.add.rectangle(0, 0, this.constants.CANVAS_WIDTH, this.constants.CANVAS_HEIGHT, 0xd08a31).setOrigin(0, 0);
    this.bg.setDepth(-20);

    const ruts = this.add.graphics();
    ruts.lineStyle(2, 0x4a2e15, 0.6);
    this.trackLines.forEach((x) => {
      ruts.moveTo(x, 0);
      ruts.lineTo(x, this.constants.CANVAS_HEIGHT);
    });
    ruts.strokePath();
    ruts.setDepth(-10);

    const playerTextureKey = this.textures.exists("cowboy-gallop") ? "cowboy-gallop" : "__DEFAULT";
    this.cowboy = this.physics.add.sprite(this.lanes[1], this.constants.PLAYER_Y, playerTextureKey);
    this.cowboy.setScale(this.constants.BASE_SPRITE_SCALE);
    this.cowboy.setDepth(10);
    const gallopAnim = this.anims.get("gallop");
    if (gallopAnim && gallopAnim.frames && gallopAnim.frames.length > 0) {
      this.cowboy.play("gallop");
    }

    this.shadowBaseY = 530;
    this.shadow = this.textures.exists("shadow")
      ? this.add.image(this.lanes[1], this.shadowBaseY, "shadow").setAlpha(0.5)
      : this.add.ellipse(this.lanes[1], this.shadowBaseY, 48, 24, 0x000000, 0.5);
    this.shadow.setScale(this.constants.SHADOW_SCALE);
    this.shadow.setDepth(5);

    if (this.cowboy?.body) {
      this.cowboy.body.setSize(40, 30);
      this.cowboy.body.setOffset(12, 45);
    }

    this.vfxManager = new VFXManager(this);
    this.obstacleManager = new ObstacleManager(this, this.vfxManager);
    this.spawnerSystem = new SpawnerSystem(this, this.obstacleManager);
    this.playerController = new PlayerController(this, this.obstacleManager);

    this.obstacleManager.initObjectPools();
    this.obstacleManager.initCollisions();
    this.playerController.initKeyboard();
    this.initBridgeListeners();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupSceneSystems, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupSceneSystems, this);

    EventBus.emit(EVENTS.GAME_READY);
    EventBus.emit(EVENTS.GAME_START);
  }

  update(_time, delta = 16.67) {
    if (this.hasDied || this.isGameOver) return;

    const dt = Math.max(0, delta / 1000);
    const moveAmount = this.gameSpeed * dt;

    if (this.bg && typeof this.bg.tilePositionY === "number") {
      this.bg.tilePositionY -= moveAmount;
    }

    if (this.shadow && this.cowboy) {
      this.shadow.x = this.cowboy.x;
    }

    this.distanceTraveled += moveAmount;
    this.obstacleManager?.update(dt, moveAmount);
    this.spawnerSystem?.update(dt, moveAmount);

    this.scoreCarry += moveAmount / 10;
    if (this.scoreCarry >= 1) {
      const wholePoints = Math.floor(this.scoreCarry);
      this.score += wholePoints;
      this.scoreCarry -= wholePoints;
    }

    if (this.time.now - this.lastScoreEmitAt >= SCORE_EMIT_INTERVAL_MS) {
      this.lastScoreEmitAt = this.time.now;
      EventBus.emit(EVENTS.SCORE_UPDATED, { score: this.score, ammo: this.ammoCount });
    }

    this.spawnerSystem?.checkRabbitCheckpoint();

    if (this.distanceTraveled >= this.nextSpawnDistance) {
      const didSpawn = this.spawnerSystem?.spawnObstaclePattern();
      if (didSpawn) {
        this.nextSpawnDistance = this.distanceTraveled + this.spawnGapTier;
      }
    }

    this.playerController?.processInput();
    this.updateSurgePacing(dt);

    const gallopFrame = this.cowboy?.anims?.currentFrame?.index;
    if (gallopFrame === 0 || gallopFrame === 2) {
      this.vfxManager?.spawnDustPuff(this.cowboy.x, this.cowboy.y + 20);
    }

    if (this.gameSpeed > 600) {
      this.vfxManager?.spawnSpeedLine();
    }
  }

  updateSurgePacing(dt) {
    this.surgeTimer += dt * 1000;

    if (this.surgePhase === "plateau" && this.surgeTimer >= this.constants.SURGE_CYCLE - 3000) {
      this.surgePhase = "warning";
    }

    if (this.surgePhase === "warning" && this.surgeTimer >= this.constants.SURGE_CYCLE - 2000 && !this.surgeTweenActive) {
      this.surgePhase = "surge";
      this.surgeTweenActive = true;

      const targetSpeed = Math.min(this.gameSpeed + this.constants.SURGE_INCREMENT, this.constants.MAX_SPEED);
      this.tweens.add({
        targets: this,
        gameSpeed: targetSpeed,
        duration: 2000,
        ease: "Cubic.easeIn",
        onComplete: () => {
          this.surgeTweenActive = false;
        },
      });
    }

    if (this.surgeTimer >= this.constants.SURGE_CYCLE) {
      this.surgeTimer = 0;
      this.surgePhase = "plateau";
      this.spawnGapTier = Math.max(this.spawnGapTier - 20, 420);
      this.gameSpeed = Math.min(this.gameSpeed, this.constants.MAX_SPEED);
    }
  }

  initBridgeListeners() {
    EventBus.on(EVENTS.SYSTEM_PAUSE, this.handleSystemPause);
    EventBus.on(EVENTS.SYSTEM_RESUME, this.handleSystemResume);
    EventBus.on(EVENTS.GAME_RESTART, this.handleGameRestart);
  }

  cleanupSceneSystems() {
    this.obstacleManager?.cleanup();
    this.spawnerSystem?.cleanup?.();
    this.vfxManager?.cleanup();

    EventBus.off(EVENTS.SYSTEM_PAUSE, this.handleSystemPause);
    EventBus.off(EVENTS.SYSTEM_RESUME, this.handleSystemResume);
    EventBus.off(EVENTS.GAME_RESTART, this.handleGameRestart);

    this.cursors = null;
    this.keys = null;
    this.surgeTweenActive = false;
  }

  shutdown() {
    this.cleanupSceneSystems();
  }

  destroy() {
    this.cleanupSceneSystems();
  }

  handleSystemPause = () => {
    if (!this.scene?.manager) return;
    this.scene.pause();
  };

  handleSystemResume = () => {
    if (!this.scene?.manager) return;
    this.scene.resume();
  };

  handleGameRestart = () => {
    if (!this.scene?.manager) return;
    this.scene.restart();
  };
}

export default MainScene;
