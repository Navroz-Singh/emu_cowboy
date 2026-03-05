import * as Phaser from "phaser";

import { OBSTACLE_TYPE, PATTERN_TYPE } from "@/games/dustbowl-dash/constants/GameConstants";

const HEIST_PATTERN_TYPE = {
  SINGLE_TOP_LEFT: "singleTopLeft",
  SINGLE_TOP_RIGHT: "singleTopRight",
  STAGGER_LEFT: "staggerLeft",
  STAGGER_RIGHT: "staggerRight",
  ALT_GROUND: "altGround",
  ALT_TALL: "altTall",
  SPLIT_LATE_LEFT: "splitLateLeft",
  SPLIT_LATE_RIGHT: "splitLateRight",
  DUAL_STEP_LEFT: "dualStepLeft",
  DUAL_STEP_RIGHT: "dualStepRight",
};

const QUICKSAND_PATTERN_TYPE = {
  CENTER_SAFE_LEFT: "centerSafeLeft",
  CENTER_SAFE_RIGHT: "centerSafeRight",
  LEFT_SOLO: "leftSolo",
  RIGHT_SOLO: "rightSolo",
  OUTER_STAGGER: "outerStagger",
  CENTER_STAGGER: "centerStagger",
  ALT_SPLIT: "altSplit",
};

export class SpawnerSystem {
  constructor(scene, obstacleManager) {
    this.scene = scene;
    this.obstacleManager = obstacleManager;
    this.activeRabbits = new Set();
    this.tumbleweedPatternLockUntil = 0;
    this.pendingRabbitSpawnScore = null;
    this.nextTumbleweedSpawnScore = Number(this.scene?.constants?.TUMBLEWEED_SCORE_INTERVAL || 800);
    this.nextAmmoRefillSpawnScore = Number(this.scene?.constants?.AMMO_REFILL_SCORE_INTERVAL || 1000);
  }

  cleanup() {
    this.activeRabbits.forEach((rabbit) => {
      if (rabbit?.active) rabbit.destroy();
    });
    this.activeRabbits.clear();
    this.pendingRabbitSpawnScore = null;
    this.nextTumbleweedSpawnScore = Number(this.scene?.constants?.TUMBLEWEED_SCORE_INTERVAL || 800);
    this.nextAmmoRefillSpawnScore = Number(this.scene?.constants?.AMMO_REFILL_SCORE_INTERVAL || 1000);
  }

  update(dt, moveAmount) {
    this.updateRabbits(dt, moveAmount);
    this.updateTumbleweedPatternLock();
  }

  checkRabbitCheckpoint() {
    if (this.scene.nextRabbitCheckpointIndex >= this.scene.constants.RABBIT_CHECKPOINTS.length) return;

    const threshold = this.scene.constants.RABBIT_CHECKPOINTS[this.scene.nextRabbitCheckpointIndex];

    if (this.pendingRabbitSpawnScore === null) {
      this.pendingRabbitSpawnScore = threshold + Phaser.Math.Between(0, 500);
    }

    if (this.scene.score >= this.pendingRabbitSpawnScore) {
      this.scene.nextRabbitCheckpointIndex += 1;
      this.pendingRabbitSpawnScore = null;
      this.spawnRabbit();
      this.showRabbitAlert();
    }
  }

  spawnRabbit() {
    const laneIndex = Phaser.Math.Between(0, 2);
    const x = this.scene.lanes[laneIndex];
    const rabbitTexture = this.scene.textures.exists("rabbit") ? "rabbit" : "__DEFAULT";
    const spawnY = this.scene.constants.CANVAS_HEIGHT + 30;
    const escapeTopY = Number(this.scene.constants.RABBIT_ESCAPE_TOP_Y || -60);
    const catchWindowMs = Number(this.scene.constants.RABBIT_CATCH_WINDOW_MS || 3000);
    const catchWindowSeconds = Math.max(0.1, catchWindowMs / 1000);
    const travelDistance = Math.max(1, this.scene.constants.CANVAS_HEIGHT - escapeTopY);
    const rabbitSpeed = -(travelDistance / catchWindowSeconds);

    const rabbit = this.scene.add.sprite(x, spawnY, rabbitTexture).setDepth(9);

    rabbit.setData("isRabbit", true);
    rabbit.setData("laneIndex", laneIndex);
    rabbit.setData("speed", rabbitSpeed);
    rabbit.setData("expiresAt", this.scene.time.now + catchWindowMs);
    rabbit.setData("escapeTopY", escapeTopY);
    if (this.scene.anims.exists("rabbit-run")) {
      rabbit.play("rabbit-run");
      if (rabbit.anims) {
        rabbit.anims.timeScale = 1.7;
      }
    }

    this.activeRabbits.add(rabbit);
    return rabbit;
  }

  showRabbitAlert() {
    const alert = this.scene.add
      .text(this.scene.constants.CANVAS_WIDTH / 2, 100, "RABBIT!", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#FFD700",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.scene.tweens.add({
      targets: alert,
      alpha: 0,
      y: 60,
      duration: 1200,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (alert?.active) alert.destroy();
      },
    });
  }

  updateRabbits(dt, _moveAmount) {
    if (this.activeRabbits.size === 0) return;

    this.activeRabbits.forEach((rabbit) => {
      if (!rabbit?.active) {
        this.activeRabbits.delete(rabbit);
        return;
      }

      const rabbitSpeed = Number(rabbit.getData("speed") || -260);
      rabbit.y += rabbitSpeed * Math.max(0, dt);

      const expiresAt = Number(rabbit.getData("expiresAt") || 0);
      const escapeTopY = Number(rabbit.getData("escapeTopY") || this.scene.constants.RABBIT_ESCAPE_TOP_Y || -60);
      if (rabbit.y < escapeTopY || (expiresAt > 0 && this.scene.time.now >= expiresAt)) {
        rabbit.destroy();
        this.activeRabbits.delete(rabbit);
      }
    });
  }

  hasActiveRabbit() {
    if (this.activeRabbits.size === 0) return false;
    for (const rabbit of this.activeRabbits) {
      if (rabbit?.active) return true;
    }
    return false;
  }

  findNearestRabbit(fromX, fromY) {
    let nearest = null;
    let nearestDist = Number.POSITIVE_INFINITY;

    this.activeRabbits.forEach((rabbit) => {
      if (!rabbit?.active) return;
      const dist = Phaser.Math.Distance.Between(fromX, fromY, rabbit.x, rabbit.y);
      if (dist < nearestDist) {
        nearest = rabbit;
        nearestDist = dist;
      }
    });

    return nearest;
  }

  handleRabbitCaught(rabbit) {
    if (!rabbit?.active) return false;

    rabbit.destroy();
    this.activeRabbits.delete(rabbit);

    this.scene.score += 500;
    this.scene.rabbitsCollected = Number(this.scene.rabbitsCollected || 0) + 1;
    this.scene.ammoCount = Math.min(this.scene.ammoCount + this.scene.constants.LEAD_RECOVERY, 6);
    this.scene.ammo = this.scene.ammoCount;

    return true;
  }

  spawnObstaclePattern() {
    if (this.scene.trainHeistManager?.isHeistActive) {
      return this.spawnHeistPattern();
    }

    if (this.scene.trainHeistManager?.shouldHoldPreHeistSpawns?.()) {
      return false;
    }

    if (this.scene.time.now < (this.scene.postHeistObstacleCooldownUntil || 0)) {
      return false;
    }

    if (this.hasActiveRabbit()) {
      return false;
    }

    if (this.scene.time.now < this.tumbleweedPatternLockUntil) {
      return false;
    }

    const didSpawnAmmoRefill = this.trySpawnAmmoRefill();
    if (didSpawnAmmoRefill) {
      return true;
    }

    if (this.scene.score >= this.nextQuicksandSpawnScore && !this.scene.quicksandManager?.hasActiveQuicksand?.()) {
      const didSpawnQuicksand = this.spawnQuicksandPattern();
      this.nextQuicksandSpawnScore = this.scene.score + Number(this.scene.constants.QUICKSAND_SCORE_INTERVAL || 2200);
      if (didSpawnQuicksand) {
        return true;
      }
    }

    const patterns = [
      PATTERN_TYPE.SOLO,
      PATTERN_TYPE.SOLO,
      PATTERN_TYPE.SOLO,
      PATTERN_TYPE.NEEDLE,
      PATTERN_TYPE.WALL,
      PATTERN_TYPE.INVERSE_WALL,
      PATTERN_TYPE.HEAVY,
      PATTERN_TYPE.SLALOM,
      PATTERN_TYPE.STAIRS_LEFT,
      PATTERN_TYPE.STAIRS_RIGHT,
      PATTERN_TYPE.CENTER_PRESS,
      PATTERN_TYPE.OUTER_PRESS,
      PATTERN_TYPE.ZIG_ZAG_LEFT,
      PATTERN_TYPE.ZIG_ZAG_RIGHT,
      PATTERN_TYPE.DOUBLE_TAP_CENTER,
      PATTERN_TYPE.LANE_PINCH_LEFT,
      PATTERN_TYPE.LANE_PINCH_RIGHT,
    ];

    const selectedPattern = Phaser.Utils.Array.GetRandom(patterns);

    let didSpawn = false;
    if (!this.validatePattern(selectedPattern)) {
      didSpawn = this.spawnSingleObstacle();
    } else {
      didSpawn = this.executePattern(selectedPattern);
      if (!didSpawn) {
        didSpawn = this.spawnSingleObstacle();
      }
    }

    if (didSpawn && this.scene.score >= this.nextTumbleweedSpawnScore) {
      const tumbleweedSpawned = this.obstacleManager.spawnTumbleweed();
      this.nextTumbleweedSpawnScore = this.scene.score + Number(this.scene.constants.TUMBLEWEED_SCORE_INTERVAL || 800);
      if (tumbleweedSpawned) {
        this.tumbleweedPatternLockUntil = Math.max(this.tumbleweedPatternLockUntil, this.scene.time.now + 350);
      }
    }

    return didSpawn;
  }

  trySpawnAmmoRefill() {
    const ammoRefillManager = this.scene.ammoRefillManager;
    if (!ammoRefillManager?.spawnInLane) return false;

    const ammoThreshold = Number(this.scene.constants.AMMO_REFILL_MIN_AMMO || 2);
    if (this.scene.ammoCount > ammoThreshold) return false;
    if (this.scene.score < this.nextAmmoRefillSpawnScore) return false;
    if (ammoRefillManager.hasActiveRefill?.()) return false;

    if (Phaser.Math.Between(0, 100) > 45) return false;

    const laneCandidates = Phaser.Utils.Array.Shuffle([0, 1, 2]);
    for (let index = 0; index < laneCandidates.length; index += 1) {
      const laneIndex = laneCandidates[index];
      const candidate = [{ laneIndex, type: "ammoRefill", yOffset: 0 }];
      if (this.hasActiveSameLaneCrowding(candidate, [0, 1, 2])) {
        continue;
      }

      const refill = ammoRefillManager.spawnInLane(laneIndex, 0);
      if (!refill) continue;

      this.nextAmmoRefillSpawnScore = this.scene.score + Number(this.scene.constants.AMMO_REFILL_SCORE_INTERVAL || 1000);
      return true;
    }

    return false;
  }

  spawnQuicksandPattern() {
    const patterns = [
      QUICKSAND_PATTERN_TYPE.CENTER_SAFE_LEFT,
      QUICKSAND_PATTERN_TYPE.CENTER_SAFE_RIGHT,
      QUICKSAND_PATTERN_TYPE.LEFT_SOLO,
      QUICKSAND_PATTERN_TYPE.RIGHT_SOLO,
      QUICKSAND_PATTERN_TYPE.OUTER_STAGGER,
      QUICKSAND_PATTERN_TYPE.CENTER_STAGGER,
      QUICKSAND_PATTERN_TYPE.ALT_SPLIT,
    ];

    const selected = Phaser.Utils.Array.GetRandom(patterns);
    const definitions = this.getQuicksandPatternDefinitions(selected);
    if (!definitions || definitions.length === 0) return false;

    return this.spawnMixedRows(definitions, [0, 1, 2]);
  }

  getQuicksandPatternDefinitions(pattern) {
    switch (pattern) {
      case QUICKSAND_PATTERN_TYPE.CENTER_SAFE_LEFT:
        return [
          { laneIndex: 1, type: "quicksand", yOffset: -12 },
          { laneIndex: 2, type: OBSTACLE_TYPE.SIGN, yOffset: -250 },
        ];
      case QUICKSAND_PATTERN_TYPE.CENTER_SAFE_RIGHT:
        return [
          { laneIndex: 1, type: "quicksand", yOffset: -12 },
          { laneIndex: 0, type: OBSTACLE_TYPE.SIGN, yOffset: -250 },
        ];
      case QUICKSAND_PATTERN_TYPE.LEFT_SOLO:
        return [
          { laneIndex: 0, type: "quicksand", yOffset: -10 },
          { laneIndex: 2, type: this.pickTallType(), yOffset: -250 },
        ];
      case QUICKSAND_PATTERN_TYPE.RIGHT_SOLO:
        return [
          { laneIndex: 2, type: "quicksand", yOffset: -10 },
          { laneIndex: 0, type: this.pickTallType(), yOffset: -250 },
        ];
      case QUICKSAND_PATTERN_TYPE.OUTER_STAGGER:
        return [
          { laneIndex: 0, type: "quicksand", yOffset: -10 },
          { laneIndex: 2, type: "quicksand", yOffset: -300 },
        ];
      case QUICKSAND_PATTERN_TYPE.CENTER_STAGGER:
        return [
          { laneIndex: 1, type: "quicksand", yOffset: -10 },
          { laneIndex: 0, type: this.pickGroundType(), yOffset: -290 },
        ];
      case QUICKSAND_PATTERN_TYPE.ALT_SPLIT:
        return [
          { laneIndex: 1, type: "quicksand", yOffset: -10 },
          { laneIndex: 2, type: this.pickGroundType(), yOffset: -280 },
          { laneIndex: 0, type: "quicksand", yOffset: -540 },
        ];
      default:
        return null;
    }
  }

  spawnHeistPattern() {
    if (this.scene.trainHeistManager?.shouldHoldHeistSpawns?.()) {
      return false;
    }

    const patterns = [
      HEIST_PATTERN_TYPE.SINGLE_TOP_LEFT,
      HEIST_PATTERN_TYPE.SINGLE_TOP_RIGHT,
      HEIST_PATTERN_TYPE.STAGGER_LEFT,
      HEIST_PATTERN_TYPE.STAGGER_RIGHT,
      HEIST_PATTERN_TYPE.ALT_GROUND,
      HEIST_PATTERN_TYPE.ALT_TALL,
      HEIST_PATTERN_TYPE.SPLIT_LATE_LEFT,
      HEIST_PATTERN_TYPE.SPLIT_LATE_RIGHT,
    ];

    const selected = Phaser.Utils.Array.GetRandom(patterns);
    const definitions = this.getHeistPatternDefinitions(selected);
    if (!definitions || definitions.length === 0) return false;

    return this.spawnPatternRows(definitions, [1, 2]);
  }

  getHeistPatternDefinitions(pattern) {
    switch (pattern) {
      case HEIST_PATTERN_TYPE.SINGLE_TOP_LEFT:
        return [
          { laneIndex: 1, type: this.pickHeistEvadeType(), yOffset: -8 },
        ];
      case HEIST_PATTERN_TYPE.SINGLE_TOP_RIGHT:
        return [
          { laneIndex: 2, type: this.pickHeistEvadeType(), yOffset: 9 },
        ];
      case HEIST_PATTERN_TYPE.STAGGER_LEFT:
        return [
          { laneIndex: 2, type: this.pickHeistEvadeType(), yOffset: -8 },
          { laneIndex: 1, type: this.pickHeistEvadeType(), yOffset: -280 },
        ];
      case HEIST_PATTERN_TYPE.STAGGER_RIGHT:
        return [
          { laneIndex: 1, type: this.pickHeistEvadeType(), yOffset: 8 },
          { laneIndex: 2, type: this.pickHeistEvadeType(), yOffset: -280 },
        ];
      case HEIST_PATTERN_TYPE.ALT_GROUND:
        return [
          { laneIndex: 1, type: OBSTACLE_TYPE.BARREL, yOffset: -10 },
          { laneIndex: 2, type: this.pickHeistTallType(), yOffset: -300 },
        ];
      case HEIST_PATTERN_TYPE.ALT_TALL:
        return [
          { laneIndex: 2, type: this.pickHeistTallType(), yOffset: 8 },
          { laneIndex: 1, type: OBSTACLE_TYPE.BARREL, yOffset: -300 },
        ];
      case HEIST_PATTERN_TYPE.SPLIT_LATE_LEFT:
        return [
          { laneIndex: 1, type: this.pickHeistEvadeType(), yOffset: -12 },
          { laneIndex: 2, type: this.pickHeistEvadeType(), yOffset: -300 },
        ];
      case HEIST_PATTERN_TYPE.SPLIT_LATE_RIGHT:
        return [
          { laneIndex: 2, type: this.pickHeistEvadeType(), yOffset: 10 },
          { laneIndex: 1, type: this.pickHeistEvadeType(), yOffset: -300 },
        ];
      default:
        return null;
    }
  }

  updateTumbleweedPatternLock() {
    const hasTumbleweed = this.hasActiveTumbleweed();
    if (hasTumbleweed) {
      this.tumbleweedPatternLockUntil = Math.max(this.tumbleweedPatternLockUntil, this.scene.time.now + 350);
    }
  }

  hasActiveTumbleweed() {
    const obstacles = this.obstacleManager?.obstaclePool?.getChildren?.() || [];
    for (let index = 0; index < obstacles.length; index += 1) {
      const obstacle = obstacles[index];
      if (!obstacle?.active) continue;
      if (obstacle.getData("type") === OBSTACLE_TYPE.TUMBLEWEED) return true;
    }
    return false;
  }

  validatePattern(pattern) {
    if (pattern === PATTERN_TYPE.SOLO || pattern === PATTERN_TYPE.HEAVY) {
      return true;
    }

    const definitions = this.getPatternDefinitions(pattern);
    if (!definitions || definitions.length === 0) return false;

    if (!this.isPatternDefinitionValid(definitions, this.scene.currentLane)) {
      return false;
    }

    const speed = Math.max(1, this.scene.gameSpeed);
    const requiredSwitches = this.getRequiredSwitches(pattern, this.scene.currentLane);
    const timeAvailable = this.scene.spawnGapTier / speed;
    const timeNeeded = requiredSwitches * (this.scene.constants.SWITCH_DURATION / 1000);

    return timeAvailable >= timeNeeded * 1.2;
  }

  getRequiredSwitches(pattern, currentLane) {
    switch (pattern) {
      case PATTERN_TYPE.NEEDLE:
        return Math.abs(currentLane - 1);
      case PATTERN_TYPE.WALL:
        return Math.abs(currentLane - 2);
      case PATTERN_TYPE.INVERSE_WALL:
        return Math.abs(currentLane - 0);
      case PATTERN_TYPE.HEAVY:
        return 1;
      case PATTERN_TYPE.SLALOM:
        return 2;
      case PATTERN_TYPE.STAIRS_LEFT:
      case PATTERN_TYPE.STAIRS_RIGHT:
      case PATTERN_TYPE.CENTER_PRESS:
      case PATTERN_TYPE.OUTER_PRESS:
      case PATTERN_TYPE.DOUBLE_TAP_CENTER:
        return 1;
      case PATTERN_TYPE.ZIG_ZAG_LEFT:
      case PATTERN_TYPE.ZIG_ZAG_RIGHT:
      case PATTERN_TYPE.LANE_PINCH_LEFT:
      case PATTERN_TYPE.LANE_PINCH_RIGHT:
        return 2;
      case PATTERN_TYPE.SOLO:
      default:
        return 0;
    }
  }

  executePattern(pattern) {
    const definitions = this.getPatternDefinitions(pattern);
    if (definitions && definitions.length > 0) {
      return this.spawnPatternRows(definitions);
    }

    switch (pattern) {
      case PATTERN_TYPE.HEAVY:
        return this.spawnHeavyPattern();
      case PATTERN_TYPE.SOLO:
      default:
        return this.spawnSingleObstacle();
    }
  }

  spawnHeavyPattern() {
    const pairCandidates = Phaser.Utils.Array.Shuffle([0, 1]);

    for (let index = 0; index < pairCandidates.length; index += 1) {
      const pair = pairCandidates[index];
      const definitions = [
        { laneIndex: pair, type: OBSTACLE_TYPE.WAGON, yOffset: 0 },
        { laneIndex: pair + 1, type: OBSTACLE_TYPE.WAGON, yOffset: 0 },
      ];

      if (this.hasActiveSameLaneCrowding(definitions, [0, 1, 2])) {
        continue;
      }

      if (!this.isPatternDefinitionValid(definitions, this.scene.currentLane, [0, 1, 2])) {
        continue;
      }

      if (this.obstacleManager.spawnWagon(pair)) {
        return true;
      }
    }

    return false;
  }

  getPatternDefinitions(pattern) {
    switch (pattern) {
      case PATTERN_TYPE.NEEDLE:
        return [
          { laneIndex: 0, type: this.pickGroundType(), yOffset: -8 },
          { laneIndex: 2, type: this.pickGroundType(), yOffset: 10 },
        ];
      case PATTERN_TYPE.WALL:
        return [
          { laneIndex: 0, type: OBSTACLE_TYPE.BARREL, yOffset: -10 },
          { laneIndex: 1, type: this.pickTallType(), yOffset: 8 },
        ];
      case PATTERN_TYPE.INVERSE_WALL:
        return [
          { laneIndex: 1, type: this.pickTallType(), yOffset: -9 },
          { laneIndex: 2, type: OBSTACLE_TYPE.BARREL, yOffset: 11 },
        ];
      case PATTERN_TYPE.SLALOM:
        return [
          { laneIndex: 0, type: this.pickGroundType(), yOffset: 0 },
          { laneIndex: 2, type: OBSTACLE_TYPE.BARREL, yOffset: -180 },
          { laneIndex: 1, type: this.pickTallType(), yOffset: -360 },
        ];
      case PATTERN_TYPE.STAIRS_LEFT:
        return [
          { laneIndex: 2, type: OBSTACLE_TYPE.BARREL, yOffset: 0 },
          { laneIndex: 1, type: this.pickGroundType(), yOffset: -175 },
          { laneIndex: 0, type: this.pickTallType(), yOffset: -350 },
        ];
      case PATTERN_TYPE.STAIRS_RIGHT:
        return [
          { laneIndex: 0, type: OBSTACLE_TYPE.BARREL, yOffset: 0 },
          { laneIndex: 1, type: this.pickGroundType(), yOffset: -175 },
          { laneIndex: 2, type: this.pickTallType(), yOffset: -350 },
        ];
      case PATTERN_TYPE.CENTER_PRESS:
        return [
          { laneIndex: 0, type: this.pickGroundType(), yOffset: -12 },
          { laneIndex: 2, type: this.pickGroundType(), yOffset: 9 },
          { laneIndex: 1, type: OBSTACLE_TYPE.BARREL, yOffset: -230 },
        ];
      case PATTERN_TYPE.OUTER_PRESS:
        return [
          { laneIndex: 1, type: this.pickTallType(), yOffset: 6 },
          { laneIndex: 0, type: OBSTACLE_TYPE.BARREL, yOffset: -210 },
          { laneIndex: 2, type: this.pickGroundType(), yOffset: -192 },
        ];
      case PATTERN_TYPE.ZIG_ZAG_LEFT:
        return [
          { laneIndex: 1, type: this.pickTallType(), yOffset: 0 },
          { laneIndex: 2, type: OBSTACLE_TYPE.BARREL, yOffset: -180 },
          { laneIndex: 1, type: this.pickGroundType(), yOffset: -360 },
          { laneIndex: 0, type: OBSTACLE_TYPE.BARREL, yOffset: -540 },
        ];
      case PATTERN_TYPE.ZIG_ZAG_RIGHT:
        return [
          { laneIndex: 1, type: this.pickTallType(), yOffset: 0 },
          { laneIndex: 0, type: OBSTACLE_TYPE.BARREL, yOffset: -180 },
          { laneIndex: 1, type: this.pickGroundType(), yOffset: -360 },
          { laneIndex: 2, type: OBSTACLE_TYPE.BARREL, yOffset: -540 },
        ];
      case PATTERN_TYPE.DOUBLE_TAP_CENTER:
        return [
          { laneIndex: 1, type: OBSTACLE_TYPE.BARREL, yOffset: 0 },
          { laneIndex: 1, type: this.pickTallType(), yOffset: -210 },
          { laneIndex: 0, type: this.pickGroundType(), yOffset: -420 },
        ];
      case PATTERN_TYPE.LANE_PINCH_LEFT:
        return [
          { laneIndex: 0, type: this.pickGroundType(), yOffset: -11 },
          { laneIndex: 1, type: OBSTACLE_TYPE.BARREL, yOffset: 8 },
          { laneIndex: 2, type: this.pickTallType(), yOffset: -235 },
          { laneIndex: 1, type: this.pickGroundType(), yOffset: -455 },
        ];
      case PATTERN_TYPE.LANE_PINCH_RIGHT:
        return [
          { laneIndex: 2, type: this.pickGroundType(), yOffset: -10 },
          { laneIndex: 1, type: OBSTACLE_TYPE.BARREL, yOffset: 9 },
          { laneIndex: 0, type: this.pickTallType(), yOffset: -235 },
          { laneIndex: 1, type: this.pickGroundType(), yOffset: -455 },
        ];
      default:
        return null;
    }
  }

  pickGroundType() {
    return Phaser.Utils.Array.GetRandom([OBSTACLE_TYPE.CACTUS, OBSTACLE_TYPE.BISON_SKULL]);
  }

  pickTallType() {
    return Phaser.Utils.Array.GetRandom([OBSTACLE_TYPE.SIGN, OBSTACLE_TYPE.TOTEM]);
  }

  pickHeistType() {
    return Phaser.Utils.Array.GetRandom([
      OBSTACLE_TYPE.BARREL,
      OBSTACLE_TYPE.SIGN,
      OBSTACLE_TYPE.TOTEM,
    ]);
  }

  pickHeistEvadeType() {
    return Phaser.Utils.Array.GetRandom([
      OBSTACLE_TYPE.BARREL,
      OBSTACLE_TYPE.BARREL,
      OBSTACLE_TYPE.SIGN,
      OBSTACLE_TYPE.TOTEM,
    ]);
  }

  pickHeistTallType() {
    return Phaser.Utils.Array.GetRandom([OBSTACLE_TYPE.SIGN, OBSTACLE_TYPE.TOTEM]);
  }

  spawnPatternRows(definitions, laneSet = [0, 1, 2]) {
    if (!Array.isArray(definitions) || definitions.length === 0) return false;
    if (this.hasActiveSameLaneCrowding(definitions, laneSet)) return false;
    if (!this.isPatternDefinitionValid(definitions, this.scene.currentLane, laneSet)) return false;

    const spawnedObjects = [];

    for (let index = 0; index < definitions.length; index += 1) {
      const entry = definitions[index];
      const obstacle = this.obstacleManager.spawnInLane(entry.laneIndex, entry.type, entry.yOffset || 0);
      if (!obstacle) {
        for (let rollbackIndex = 0; rollbackIndex < spawnedObjects.length; rollbackIndex += 1) {
          this.obstacleManager.disablePooledObject(spawnedObjects[rollbackIndex]);
        }
        return false;
      }
      spawnedObjects.push(obstacle);
    }

    return true;
  }

  spawnMixedRows(definitions, laneSet = [0, 1, 2]) {
    if (!Array.isArray(definitions) || definitions.length === 0) return false;
    if (this.hasActiveSameLaneCrowding(definitions, laneSet)) return false;

    const obstacleEntries = definitions.filter((entry) => entry.type !== "quicksand");
    if (obstacleEntries.length > 0 && !this.isPatternDefinitionValid(obstacleEntries, this.scene.currentLane, laneSet)) {
      return false;
    }

    const spawnedObjects = [];

    for (let index = 0; index < definitions.length; index += 1) {
      const entry = definitions[index];
      let spawned = null;

      if (entry.type === "quicksand") {
        spawned = this.scene.quicksandManager?.spawnInLane?.(entry.laneIndex, entry.yOffset || 0) || null;
      } else {
        spawned = this.obstacleManager.spawnInLane(entry.laneIndex, entry.type, entry.yOffset || 0);
      }

      if (!spawned) {
        for (let rollbackIndex = 0; rollbackIndex < spawnedObjects.length; rollbackIndex += 1) {
          const rollback = spawnedObjects[rollbackIndex];
          if (rollback.kind === "quicksand") {
            this.scene.quicksandManager?.disableTrap?.(rollback.object);
          } else {
            this.obstacleManager.disablePooledObject(rollback.object);
          }
        }
        return false;
      }

      spawnedObjects.push({ kind: entry.type === "quicksand" ? "quicksand" : "obstacle", object: spawned });
    }

    return true;
  }

  isPatternDefinitionValid(definitions, startLane = null, laneSet = [0, 1, 2]) {
    const laneOffsets = new Map();
    for (let index = 0; index < definitions.length; index += 1) {
      const entry = definitions[index];
      if (!entry || !Number.isInteger(entry.laneIndex) || entry.laneIndex < 0 || entry.laneIndex > 2) {
        return false;
      }

      const laneValues = laneOffsets.get(entry.laneIndex) || [];
      laneValues.push(Number(entry.yOffset || 0));
      laneOffsets.set(entry.laneIndex, laneValues);
    }

    for (const offsets of laneOffsets.values()) {
      offsets.sort((a, b) => b - a);
      for (let index = 1; index < offsets.length; index += 1) {
        if (Math.abs(offsets[index - 1] - offsets[index]) < 115) {
          return false;
        }
      }
    }

    const sorted = [...definitions]
      .map((entry) => ({ laneIndex: entry.laneIndex, yOffset: Number(entry.yOffset || 0) }))
      .sort((a, b) => b.yOffset - a.yOffset);

    const rows = [];
    const ROW_CLUSTER_DELTA = 45;
    for (let index = 0; index < sorted.length; index += 1) {
      const item = sorted[index];
      const lastRow = rows[rows.length - 1];
      if (!lastRow || Math.abs(lastRow.anchor - item.yOffset) > ROW_CLUSTER_DELTA) {
        rows.push({ anchor: item.yOffset, lanes: new Set([item.laneIndex]) });
      } else {
        lastRow.lanes.add(item.laneIndex);
      }
    }

    if (rows.length > 4) {
      return false;
    }

    const normalizedLaneSet = laneSet.filter((lane) => Number.isInteger(lane) && lane >= 0 && lane <= 2);
    const fallbackSet = normalizedLaneSet.length > 0 ? normalizedLaneSet : [0, 1, 2];

    let reachable;
    if (startLane === null || !fallbackSet.includes(startLane)) {
      reachable = new Set(fallbackSet);
    } else {
      reachable = new Set([startLane]);
    }
    let previousAnchor = rows[0]?.anchor ?? 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const blocked = new Set(row.lanes);
      const absoluteRowY = this.scene.constants.SPAWN_Y + row.anchor;
      const activeBlockedLanes = this.getBlockedLanesFromActiveObjects(absoluteRowY, ROW_CLUSTER_DELTA);
      activeBlockedLanes.forEach((lane) => blocked.add(lane));
      const open = fallbackSet.filter((lane) => !blocked.has(lane));
      if (open.length === 0) {
        return false;
      }

      const deltaY = index === 0 ? 180 : Math.abs(previousAnchor - row.anchor);
      const allowedSwitches = Math.max(1, Math.floor(deltaY / 160));
      const nextReachable = new Set();

      open.forEach((lane) => {
        reachable.forEach((fromLane) => {
          if (Math.abs(fromLane - lane) <= allowedSwitches) {
            nextReachable.add(lane);
          }
        });
      });

      if (nextReachable.size === 0) {
        return false;
      }

      reachable = nextReachable;
      previousAnchor = row.anchor;
    }

    return true;
  }

  getBlockedLanesFromActiveObjects(targetY, tolerance) {
    const blocked = new Set();

    const nearestLaneIndex = (x) => {
      let bestLane = null;
      let bestDelta = Number.POSITIVE_INFINITY;
      for (let laneIndex = 0; laneIndex < this.scene.lanes.length; laneIndex += 1) {
        const delta = Math.abs(this.scene.lanes[laneIndex] - x);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestLane = laneIndex;
        }
      }
      return bestDelta <= 90 ? bestLane : null;
    };

    const obstacles = this.obstacleManager?.obstaclePool?.getChildren?.() || [];
    for (let index = 0; index < obstacles.length; index += 1) {
      const obstacle = obstacles[index];
      if (!obstacle?.active) continue;
      const type = obstacle.getData("type");
      if (!type || type === OBSTACLE_TYPE.TUMBLEWEED) continue;
      if (Math.abs(obstacle.y - targetY) > tolerance) continue;

      const laneIndex = nearestLaneIndex(obstacle.x);
      if (laneIndex !== null) blocked.add(laneIndex);
    }

    const wagons = this.obstacleManager?.wagonPool?.getChildren?.() || [];
    for (let index = 0; index < wagons.length; index += 1) {
      const wagon = wagons[index];
      if (!wagon?.active) continue;
      if (Math.abs(wagon.y - targetY) > tolerance) continue;
      const wagonLanes = this.getWagonBlockedLanes(wagon.x);
      wagonLanes.forEach((lane) => blocked.add(lane));
    }

    return blocked;
  }

  spawnSingleObstacle() {
    const weightedTypes = [
      OBSTACLE_TYPE.CACTUS,
      OBSTACLE_TYPE.CACTUS,
      OBSTACLE_TYPE.BISON_SKULL,
      OBSTACLE_TYPE.BARREL,
      OBSTACLE_TYPE.BARREL,
      OBSTACLE_TYPE.SIGN,
      OBSTACLE_TYPE.SIGN,
      OBSTACLE_TYPE.TOTEM,
    ];
    if (!this.scene.trainHeistManager?.isHeistActive) {
      weightedTypes.push(OBSTACLE_TYPE.ROCK_BANDIT);
    }
    const isHeist = Boolean(this.scene.trainHeistManager?.isHeistActive);
    const laneMin = isHeist ? 1 : 0;
    const laneMax = 2;
    const laneSet = isHeist ? [1, 2] : [0, 1, 2];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const selectedType = Phaser.Utils.Array.GetRandom(weightedTypes);
      const laneIndex = Phaser.Math.Between(laneMin, laneMax);
      const candidate = [{ laneIndex, type: selectedType, yOffset: 0 }];
      if (this.hasActiveSameLaneCrowding(candidate, laneSet)) {
        continue;
      }
      if (!this.isPatternDefinitionValid(candidate, this.scene.currentLane, laneSet)) {
        continue;
      }
      return Boolean(this.obstacleManager.spawnInLane(laneIndex, selectedType, 0));
    }

    return false;
  }

  hasActiveSameLaneCrowding(definitions, laneSet = [0, 1, 2]) {
    const laneWhitelist = new Set(laneSet);
    const minGap = 145;
    const nearestLaneIndex = (x) => {
      let bestLane = null;
      let bestDelta = Number.POSITIVE_INFINITY;
      for (let laneIndex = 0; laneIndex < this.scene.lanes.length; laneIndex += 1) {
        if (!laneWhitelist.has(laneIndex)) continue;
        const delta = Math.abs(this.scene.lanes[laneIndex] - x);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestLane = laneIndex;
        }
      }
      return bestDelta <= 90 ? bestLane : null;
    };

    const activeByLane = new Map();
    for (const lane of laneWhitelist) {
      activeByLane.set(lane, []);
    }

    const obstacles = this.obstacleManager?.obstaclePool?.getChildren?.() || [];
    for (let index = 0; index < obstacles.length; index += 1) {
      const obstacle = obstacles[index];
      if (!obstacle?.active) continue;
      if (obstacle.getData("type") === OBSTACLE_TYPE.TUMBLEWEED) continue;

      const lane = nearestLaneIndex(obstacle.x);
      if (lane === null) continue;

      activeByLane.get(lane)?.push(obstacle.y);
    }

    const traps = this.scene.quicksandManager?.quicksandPool?.getChildren?.() || [];
    for (let index = 0; index < traps.length; index += 1) {
      const trap = traps[index];
      if (!trap?.active) continue;

      const lane = nearestLaneIndex(trap.x);
      if (lane === null) continue;
      activeByLane.get(lane)?.push(trap.y);
    }

    const refills = this.scene.ammoRefillManager?.refillPool?.getChildren?.() || [];
    for (let index = 0; index < refills.length; index += 1) {
      const refill = refills[index];
      if (!refill?.active) continue;

      const lane = nearestLaneIndex(refill.x);
      if (lane === null) continue;
      activeByLane.get(lane)?.push(refill.y);
    }

    const wagons = this.obstacleManager?.wagonPool?.getChildren?.() || [];
    for (let index = 0; index < wagons.length; index += 1) {
      const wagon = wagons[index];
      if (!wagon?.active) continue;

      const wagonLanes = this.getWagonBlockedLanes(wagon.x);
      for (let laneIndex = 0; laneIndex < wagonLanes.length; laneIndex += 1) {
        const lane = wagonLanes[laneIndex];
        if (!laneWhitelist.has(lane)) continue;
        activeByLane.get(lane)?.push(wagon.y);
      }
    }

    for (let index = 0; index < definitions.length; index += 1) {
      const entry = definitions[index];
      if (!laneWhitelist.has(entry.laneIndex)) continue;
      const spawnY = this.scene.constants.SPAWN_Y + Number(entry.yOffset || 0);
      const activeYs = activeByLane.get(entry.laneIndex) || [];
      for (let yIndex = 0; yIndex < activeYs.length; yIndex += 1) {
        if (Math.abs(activeYs[yIndex] - spawnY) < minGap) {
          return true;
        }
      }
    }

    return false;
  }

  getWagonBlockedLanes(wagonX) {
    const leftPairMid = (this.scene.lanes[0] + this.scene.lanes[1]) / 2;
    const rightPairMid = (this.scene.lanes[1] + this.scene.lanes[2]) / 2;

    if (Math.abs(wagonX - leftPairMid) <= Math.abs(wagonX - rightPairMid)) {
      return [0, 1];
    }

    return [1, 2];
  }
}
