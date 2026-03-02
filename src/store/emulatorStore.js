import { create } from "zustand";

export const useEmulatorStore = create((set, get) => ({
  isPaused: false,
  score: 0,
  highScore: 0,
  ammoCount: 6,
  isGameOverVisible: false,

  togglePause: () => {
    const next = !get().isPaused;
    set({ isPaused: next });
    return next;
  },
  setPaused: (isPaused) => set({ isPaused: Boolean(isPaused) }),
  setScore: (score) => {
    const normalized = Number.isFinite(Number(score)) ? Math.max(0, Math.trunc(Number(score))) : 0;
    set((state) => ({ score: normalized, highScore: Math.max(normalized, state.highScore) }));
  },
  setAmmo: (ammoCount) => {
    const normalized = Number.isFinite(Number(ammoCount)) ? Math.max(0, Math.trunc(Number(ammoCount))) : 0;
    set({ ammoCount: normalized });
  },
  setGameOverVisible: (isGameOverVisible) => set({ isGameOverVisible: Boolean(isGameOverVisible) }),
  reset: () => set({ isPaused: false, score: 0, ammoCount: 6, isGameOverVisible: false }),
}));
