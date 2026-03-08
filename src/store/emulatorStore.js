import { create } from "zustand";

export const useEmulatorStore = create((set, get) => ({
  isPaused: false,
  score: 0,
  highScore: 0,
  ammoCount: 6,
  rabbitsCollected: 0,
  coinsCollected: 0,

  togglePause: () => {
    const nextPaused = !get().isPaused;
    set({ isPaused: nextPaused });
    return nextPaused;
  },
  setPaused: (isPaused) => set({ isPaused: Boolean(isPaused) }),
  setScore: (value) => {
    const nextScore = Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;
    const currentHigh = get().highScore;
    set({ score: nextScore, highScore: Math.max(nextScore, currentHigh) });
  },
  setAmmo: (value) => {
    const nextAmmo = Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;
    set({ ammoCount: nextAmmo });
  },
  setRabbitsCollected: (value) => {
    const nextValue = Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;
    set({ rabbitsCollected: nextValue });
  },
  setCoinsCollected: (value) => {
    const nextValue = Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;
    set({ coinsCollected: nextValue });
  },
  reset: () => set({ isPaused: false, score: 0, ammoCount: 6, rabbitsCollected: 0, coinsCollected: 0 }),
}));
