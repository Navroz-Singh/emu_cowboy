import * as Phaser from "phaser";

import { EVENTS, EventBus } from "@/lib/eventBus";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    EventBus.emit(EVENTS.GAME_READY);
    this.scene.start("MainScene");
  }
}
