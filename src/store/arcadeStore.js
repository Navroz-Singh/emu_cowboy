import { create } from "zustand";

import { TABS } from "@/utils/constants";

export const useArcadeStore = create((set) => ({
  activeTab: TABS.ALL_GAMES,
  selectedGameId: "dustbowl-dash",
  isSwitchingTab: false,
  isAuthModalOpen: false,
  authMode: "login",
  setActiveTab: (tab) => {
    set((state) => {
      if (state.activeTab === tab) return state;
      return { activeTab: tab, isSwitchingTab: true };
    });

    window.setTimeout(() => {
      set({ isSwitchingTab: false });
    }, 220);
  },
  setSelectedGame: (gameId) => set({ selectedGameId: gameId }),
  openAuthModal: (mode = "login") => set({ isAuthModalOpen: true, authMode: mode }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  setAuthMode: (mode) => set({ authMode: mode }),
}));
