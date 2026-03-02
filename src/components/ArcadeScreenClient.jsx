"use client";

import { useMemo } from "react";

import "@/lib/persistence";
import AuthModal from "@/components/auth/AuthModal";
import AllGamesView from "@/components/views/AllGamesView";
import CommunityView from "@/components/views/CommunityView";
import LeaderboardsView from "@/components/views/LeaderboardsView";
import ProfileView from "@/components/views/ProfileView";
import { useArcadeStore } from "@/store/arcadeStore";
import { TABS } from "@/utils/constants";

const VIEW_MAP = {
  [TABS.ALL_GAMES]: AllGamesView,
  [TABS.LEADERBOARDS]: LeaderboardsView,
  [TABS.COMMUNITY]: CommunityView,
  [TABS.PROFILE]: ProfileView,
};

export default function ArcadeScreenClient({ user }) {
  const activeTab = useArcadeStore((state) => state.activeTab);
  const isSwitchingTab = useArcadeStore((state) => state.isSwitchingTab);

  const ActiveView = useMemo(() => VIEW_MAP[activeTab] ?? AllGamesView, [activeTab]);

  return (
    <div className="relative h-full w-full">
      <ActiveView user={user} />
      {isSwitchingTab ? (
        <div className="pointer-events-none absolute inset-0 z-20 bg-[var(--screen-bg)]/45 loading-blink" />
      ) : null}
      <AuthModal />
    </div>
  );
}
