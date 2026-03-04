class Emitter {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, handler) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    this.listeners.get(eventName).add(handler);
    return this;
  }

  off(eventName, handler) {
    if (!this.listeners.has(eventName)) return this;
    this.listeners.get(eventName).delete(handler);
    if (this.listeners.get(eventName).size === 0) {
      this.listeners.delete(eventName);
    }
    return this;
  }

  removeListener(eventName, handler) {
    if (handler) {
      return this.off(eventName, handler);
    }

    this.listeners.delete(eventName);
    return this;
  }

  emit(eventName, payload) {
    if (!this.listeners.has(eventName)) return false;

    [...this.listeners.get(eventName)].forEach((handler) => {
      handler(payload);
    });

    return true;
  }
}

export const EventBus = new Emitter();

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
