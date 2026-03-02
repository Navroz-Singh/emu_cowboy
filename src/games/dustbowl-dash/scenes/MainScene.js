import * as Phaser from "phaser";

import { EVENTS, EventBus } from "@/lib/eventBus";

const SCORE_EMIT_INTERVAL_MS = 500;

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    this.score = 0;
    this.ammo = 6;
    this.runStartAt = 0;
    this.scoreAccumulator = 0;
    this.lastScoreEmitAt = 0;
    this.hasDied = false;
    this.tickEvent = null;
  }

  create() {
    this.cleanupListeners();

    this.score = 0;
    this.ammo = 6;
    this.hasDied = false;
    this.runStartAt = this.time.now;
    this.lastScoreEmitAt = this.time.now;
    this.scoreAccumulator = 0;

    this.add.text(28, 28, "DUSTBOWL DASH - PHASE 4 BRIDGE", {
      color: "#4a2e15",
      fontFamily: "monospace",
      fontSize: "18px",
    });

    this.add.text(28, 60, "SPACE: emit PLAYER_DIED", {
      color: "#4a2e15",
      fontFamily: "monospace",
      fontSize: "14px",
    });

    this.add.text(28, 82, "S: emit SAVE_REQUESTED", {
      color: "#4a2e15",
      fontFamily: "monospace",
      fontSize: "14px",
    });

    this.tickEvent = this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (this.hasDied) return;
        this.score += 7;
        this.scoreAccumulator += 7;

        if (this.scoreAccumulator >= 175) {
          this.scoreAccumulator = 0;
          this.ammo = Math.max(0, this.ammo - 1);
        }
      },
    });

    this.input.keyboard?.on("keydown-SPACE", this.handleSimulatedDeath);
    this.input.keyboard?.on("keydown-S", this.handleSaveRequest);

    EventBus.on(EVENTS.SYSTEM_PAUSE, this.handleSystemPause);
    EventBus.on(EVENTS.SYSTEM_RESUME, this.handleSystemResume);
    EventBus.on(EVENTS.GAME_RESTART, this.handleGameRestart);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupListeners, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupListeners, this);

    EventBus.emit(EVENTS.GAME_START);
  }

  update() {
    if (this.hasDied) return;

    if (this.time.now - this.lastScoreEmitAt >= SCORE_EMIT_INTERVAL_MS) {
      this.lastScoreEmitAt = this.time.now;
      EventBus.emit(EVENTS.SCORE_UPDATED, { score: this.score, ammo: this.ammo });
    }
  }

  shutdown() {
    this.cleanupListeners();
  }

  destroy() {
    this.cleanupListeners();
  }

  cleanupListeners() {
    if (this.tickEvent) {
      this.tickEvent.remove();
      this.tickEvent = null;
    }

    this.input.keyboard?.off("keydown-SPACE", this.handleSimulatedDeath);
    this.input.keyboard?.off("keydown-S", this.handleSaveRequest);
    EventBus.off(EVENTS.SYSTEM_PAUSE, this.handleSystemPause);
    EventBus.off(EVENTS.SYSTEM_RESUME, this.handleSystemResume);
    EventBus.off(EVENTS.GAME_RESTART, this.handleGameRestart);
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

  handleSimulatedDeath = () => {
    if (this.hasDied) return;
    this.hasDied = true;
    const elapsedSeconds = Math.max(0, Math.floor((this.time.now - this.runStartAt) / 1000));
    EventBus.emit(EVENTS.PLAYER_DIED, { score: this.score, timePlayed: elapsedSeconds });
  };

  handleSaveRequest = () => {
    if (this.hasDied) return;

    EventBus.emit(EVENTS.SAVE_REQUESTED, {
      state: {
        score: this.score,
        ammo: this.ammo,
        elapsedSeconds: Math.max(0, Math.floor((this.time.now - this.runStartAt) / 1000)),
      },
    });
  };
}
