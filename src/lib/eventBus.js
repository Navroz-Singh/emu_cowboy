import * as Phaser from "phaser";

export const EventBus = new Phaser.Events.EventEmitter();

export const EVENTS = {
  GAME_READY: "game_ready",
  GAME_START: "game_start",
  SCORE_UPDATED: "score_updated",
  PLAYER_DIED: "player_died",
  SAVE_REQUESTED: "save_requested",
  SYSTEM_PAUSE: "system_pause",
  SYSTEM_RESUME: "system_resume",
  GAME_RESTART: "game_restart",
};
