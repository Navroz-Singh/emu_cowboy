import { create } from "zustand";

export const useEmulatorStore = create((set, get) => ({
  isPaused: false,
  score: 0,
  highScore: 0,
  ammoCount: 6,

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
  reset: () => set({ isPaused: false, score: 0, ammoCount: 6 }),
}));
