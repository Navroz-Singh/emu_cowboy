import * as Phaser from "phaser";

import { OBSTACLE_TYPE, PATTERN_TYPE } from "@/games/dustbowl-dash/constants/GameConstants";

export class SpawnerSystem {
  constructor(scene, obstacleManager) {
    this.scene = scene;
    this.obstacleManager = obstacleManager;
    this.activeRabbits = new Set();
    this.tumbleweedPatternLockUntil = 0;
    this.pendingRabbitSpawnScore = null;
  }

  cleanup() {
    this.activeRabbits.forEach((rabbit) => {
      if (rabbit?.active) rabbit.destroy();
    });
    this.activeRabbits.clear();
    this.pendingRabbitSpawnScore = null;
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
    const rabbit = this.scene.add.sprite(x, -30, rabbitTexture).setDepth(9);

    rabbit.setData("isRabbit", true);
    rabbit.setData("laneIndex", laneIndex);
    rabbit.setData("speed", 340);
    rabbit.setData("expiresAt", this.scene.time.now + 2000);
    if (this.scene.anims.exists("rabbit-run")) {
      rabbit.play("rabbit-run");
      if (rabbit.anims) {
        rabbit.anims.timeScale = 1.5;
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

      const rabbitSpeed = Number(rabbit.getData("speed") || 340);
      rabbit.y += rabbitSpeed * Math.max(0, dt);

      const expiresAt = Number(rabbit.getData("expiresAt") || 0);
      if (rabbit.y > 650 || (expiresAt > 0 && this.scene.time.now >= expiresAt)) {
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
    this.scene.ammoCount = Math.min(this.scene.ammoCount + this.scene.constants.LEAD_RECOVERY, 6);
    this.scene.ammo = this.scene.ammoCount;

    return true;
  }

  spawnObstaclePattern() {
    if (this.hasActiveRabbit()) {
      return false;
    }

    if (this.scene.time.now < this.tumbleweedPatternLockUntil) {
      return false;
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

    if (didSpawn && Phaser.Math.Between(0, 100) < 15) {
      const tumbleweedSpawned = this.obstacleManager.spawnTumbleweed();
      if (tumbleweedSpawned) {
        this.tumbleweedPatternLockUntil = Math.max(this.tumbleweedPatternLockUntil, this.scene.time.now + 350);
      }
    }

    return didSpawn;
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
        return this.obstacleManager.spawnWagon();
      case PATTERN_TYPE.SOLO:
      default:
        return this.spawnSingleObstacle();
    }
  }

  getPatternDefinitions(pattern) {
    switch (pattern) {
      case PATTERN_TYPE.NEEDLE:
        return [
          { laneIndex: 0, type: OBSTACLE_TYPE.CACTUS, yOffset: -8 },
          { laneIndex: 2, type: OBSTACLE_TYPE.CACTUS, yOffset: 10 },
        ];
      case PATTERN_TYPE.WALL:
        return [
          { laneIndex: 0, type: OBSTACLE_TYPE.BARREL, yOffset: -10 },
          { laneIndex: 1, type: OBSTACLE_TYPE.SIGN, yOffset: 8 },
        ];
      case PATTERN_TYPE.INVERSE_WALL:
        return [
          { laneIndex: 1, type: OBSTACLE_TYPE.SIGN, yOffset: -9 },
          { laneIndex: 2, type: OBSTACLE_TYPE.BARREL, yOffset: 11 },
        ];
      case PATTERN_TYPE.SLALOM:
        return [
          { laneIndex: 0, type: OBSTACLE_TYPE.CACTUS, yOffset: 0 },
          { laneIndex: 2, type: OBSTACLE_TYPE.BARREL, yOffset: -180 },
          { laneIndex: 1, type: OBSTACLE_TYPE.SIGN, yOffset: -360 },
        ];
      case PATTERN_TYPE.STAIRS_LEFT:
        return [
          { laneIndex: 2, type: OBSTACLE_TYPE.BARREL, yOffset: 0 },
          { laneIndex: 1, type: OBSTACLE_TYPE.CACTUS, yOffset: -175 },
          { laneIndex: 0, type: OBSTACLE_TYPE.SIGN, yOffset: -350 },
        ];
      case PATTERN_TYPE.STAIRS_RIGHT:
        return [
          { laneIndex: 0, type: OBSTACLE_TYPE.BARREL, yOffset: 0 },
          { laneIndex: 1, type: OBSTACLE_TYPE.CACTUS, yOffset: -175 },
          { laneIndex: 2, type: OBSTACLE_TYPE.SIGN, yOffset: -350 },
        ];
      case PATTERN_TYPE.CENTER_PRESS:
        return [
          { laneIndex: 0, type: OBSTACLE_TYPE.CACTUS, yOffset: -12 },
          { laneIndex: 2, type: OBSTACLE_TYPE.CACTUS, yOffset: 9 },
          { laneIndex: 1, type: OBSTACLE_TYPE.BARREL, yOffset: -230 },
        ];
      case PATTERN_TYPE.OUTER_PRESS:
        return [
          { laneIndex: 1, type: OBSTACLE_TYPE.SIGN, yOffset: 6 },
          { laneIndex: 0, type: OBSTACLE_TYPE.BARREL, yOffset: -210 },
          { laneIndex: 2, type: OBSTACLE_TYPE.CACTUS, yOffset: -192 },
        ];
      case PATTERN_TYPE.ZIG_ZAG_LEFT:
        return [
          { laneIndex: 1, type: OBSTACLE_TYPE.SIGN, yOffset: 0 },
          { laneIndex: 2, type: OBSTACLE_TYPE.BARREL, yOffset: -180 },
          { laneIndex: 1, type: OBSTACLE_TYPE.CACTUS, yOffset: -360 },
          { laneIndex: 0, type: OBSTACLE_TYPE.BARREL, yOffset: -540 },
        ];
      case PATTERN_TYPE.ZIG_ZAG_RIGHT:
        return [
          { laneIndex: 1, type: OBSTACLE_TYPE.SIGN, yOffset: 0 },
          { laneIndex: 0, type: OBSTACLE_TYPE.BARREL, yOffset: -180 },
          { laneIndex: 1, type: OBSTACLE_TYPE.CACTUS, yOffset: -360 },
          { laneIndex: 2, type: OBSTACLE_TYPE.BARREL, yOffset: -540 },
        ];
      case PATTERN_TYPE.DOUBLE_TAP_CENTER:
        return [
          { laneIndex: 1, type: OBSTACLE_TYPE.BARREL, yOffset: 0 },
          { laneIndex: 1, type: OBSTACLE_TYPE.SIGN, yOffset: -210 },
          { laneIndex: 0, type: OBSTACLE_TYPE.CACTUS, yOffset: -420 },
        ];
      case PATTERN_TYPE.LANE_PINCH_LEFT:
        return [
          { laneIndex: 0, type: OBSTACLE_TYPE.CACTUS, yOffset: -11 },
          { laneIndex: 1, type: OBSTACLE_TYPE.BARREL, yOffset: 8 },
          { laneIndex: 2, type: OBSTACLE_TYPE.SIGN, yOffset: -235 },
          { laneIndex: 1, type: OBSTACLE_TYPE.CACTUS, yOffset: -455 },
        ];
      case PATTERN_TYPE.LANE_PINCH_RIGHT:
        return [
          { laneIndex: 2, type: OBSTACLE_TYPE.CACTUS, yOffset: -10 },
          { laneIndex: 1, type: OBSTACLE_TYPE.BARREL, yOffset: 9 },
          { laneIndex: 0, type: OBSTACLE_TYPE.SIGN, yOffset: -235 },
          { laneIndex: 1, type: OBSTACLE_TYPE.CACTUS, yOffset: -455 },
        ];
      default:
        return null;
    }
  }

  spawnPatternRows(definitions) {
    if (!Array.isArray(definitions) || definitions.length === 0) return false;
    if (!this.isPatternDefinitionValid(definitions, this.scene.currentLane)) return false;

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

  isPatternDefinitionValid(definitions, startLane = null) {
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

    let reachable = startLane === null ? new Set([0, 1, 2]) : new Set([startLane]);
    let previousAnchor = rows[0]?.anchor ?? 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const blocked = new Set(row.lanes);
      const absoluteRowY = this.scene.constants.SPAWN_Y + row.anchor;
      const activeBlockedLanes = this.getBlockedLanesFromActiveObjects(absoluteRowY, ROW_CLUSTER_DELTA);
      activeBlockedLanes.forEach((lane) => blocked.add(lane));
      const open = [0, 1, 2].filter((lane) => !blocked.has(lane));
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

      const leftPairMid = (this.scene.lanes[0] + this.scene.lanes[1]) / 2;
      const rightPairMid = (this.scene.lanes[1] + this.scene.lanes[2]) / 2;

      if (Math.abs(wagon.x - leftPairMid) <= Math.abs(wagon.x - rightPairMid)) {
        blocked.add(0);
        blocked.add(1);
      } else {
        blocked.add(1);
        blocked.add(2);
      }
    }

    return blocked;
  }

  spawnSingleObstacle() {
    const weightedTypes = [
      OBSTACLE_TYPE.CACTUS,
      OBSTACLE_TYPE.CACTUS,
      OBSTACLE_TYPE.BARREL,
      OBSTACLE_TYPE.BARREL,
      OBSTACLE_TYPE.SIGN,
      OBSTACLE_TYPE.SIGN,
    ];
    const selectedType = Phaser.Utils.Array.GetRandom(weightedTypes);
    const laneIndex = Phaser.Math.Between(0, 2);

    return Boolean(this.obstacleManager.spawnInLane(laneIndex, selectedType, 0));
  }
}
