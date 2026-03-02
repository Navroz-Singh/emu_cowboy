"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";

import AuthModal from "@/components/auth/AuthModal";
import CabinetShell from "@/components/cabinet/CabinetShell";
import ScreenFrame from "@/components/cabinet/ScreenFrame";
import SystemOverlay from "@/components/emulator/SystemOverlay";
import { GAME_REGISTRY } from "@/games/registry";
import { useEmulatorStore } from "@/store/emulatorStore";

const DynamicGameWrapper = dynamic(() => import("@/components/emulator/GameWrapper"), {
  ssr: false,
});

export default function PlayClient({ gameId, user }) {
  const cartridge = GAME_REGISTRY[gameId];
  const reset = useEmulatorStore((state) => state.reset);

  useEffect(() => {
    reset();

    return () => {
      reset();
    };
  }, [gameId, reset]);

  if (!cartridge) return null;

  return (
    <CabinetShell>
      <ScreenFrame user={user}>
        <div className="relative mx-auto h-full w-full max-w-[1100px]">
          <DynamicGameWrapper gameId={gameId} />
          <SystemOverlay gameId={gameId} gameTitle={cartridge.title} user={user} />
          <AuthModal />
        </div>
      </ScreenFrame>
    </CabinetShell>
  );
}
