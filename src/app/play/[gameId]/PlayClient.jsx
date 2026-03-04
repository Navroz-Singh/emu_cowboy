"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import AuthModal from "@/components/auth/AuthModal";
import SystemOverlay from "@/components/emulator/SystemOverlay";
import { GAME_REGISTRY } from "@/games/registry";
import { EventBus, EVENTS } from "@/lib/eventBus";
import { useEmulatorStore } from "@/store/emulatorStore";

const DynamicGameWrapper = dynamic(() => import("@/components/emulator/GameWrapper"), {
  ssr: false,
});

export default function PlayClient({ gameId, user }) {
  const router = useRouter();
  const cartridge = GAME_REGISTRY[gameId];
  const reset = useEmulatorStore((state) => state.reset);
  const setPaused = useEmulatorStore((state) => state.setPaused);

  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [hasStartedFromMenu, setHasStartedFromMenu] = useState(false);
  const [isBooting, setIsBooting] = useState(false);
  const [bootMilestoneIndex, setBootMilestoneIndex] = useState(0);
  const [isRevealVisible, setIsRevealVisible] = useState(false);
  const [isRevealExpanded, setIsRevealExpanded] = useState(false);

  const bootMilestones = ["PREPARING CARTRIDGE...", "LOADING ASSETS...", "BOOTING..."];

  useEffect(() => {
    reset();

    return () => {
      reset();
    };
  }, [gameId, reset]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!hasStartedFromMenu) return;

    const bootStepOne = window.setTimeout(() => setBootMilestoneIndex(1), 350);
    const bootStepTwo = window.setTimeout(() => setBootMilestoneIndex(2), 900);
    let revealStartTimeoutId;
    let revealEndTimeoutId;

    const onGameReady = () => {
      setIsBooting(false);
      setIsRevealVisible(true);
      revealStartTimeoutId = window.setTimeout(() => {
        setIsRevealExpanded(true);
      }, 20);

      revealEndTimeoutId = window.setTimeout(() => {
        setIsRevealExpanded(false);
        setIsRevealVisible(false);
      }, 700);
    };

    EventBus.on(EVENTS.GAME_READY, onGameReady);

    return () => {
      window.clearTimeout(bootStepOne);
      window.clearTimeout(bootStepTwo);
      if (revealStartTimeoutId) window.clearTimeout(revealStartTimeoutId);
      if (revealEndTimeoutId) window.clearTimeout(revealEndTimeoutId);
      EventBus.off(EVENTS.GAME_READY, onGameReady);
    };
  }, [gameId, hasStartedFromMenu]);

  if (!cartridge) return null;

  const openExitConfirmation = () => {
    setPaused(true);
    EventBus.emit(EVENTS.SYSTEM_PAUSE);
    setIsExitConfirmOpen(true);
  };

  const continuePlaying = () => {
    setIsExitConfirmOpen(false);
    setPaused(false);
    EventBus.emit(EVENTS.SYSTEM_RESUME);
  };

  const leaveToHome = () => {
    router.push("/");
  };

  const toggleBrowserFullscreen = async () => {
    const target = document.documentElement;

    if (!document.fullscreenElement) {
      await target.requestFullscreen();
      return;
    }

    await document.exitFullscreen();
  };

  const startGameFromMenu = () => {
    if (hasStartedFromMenu) return;
    setIsBooting(true);
    setBootMilestoneIndex(0);
    setHasStartedFromMenu(true);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-100 flex items-center justify-between p-3">
        <button
          className="pointer-events-auto arcade-border bg-(--cabinet-tan) px-3 py-2 text-[10px] md:text-xs"
          onClick={hasStartedFromMenu ? openExitConfirmation : leaveToHome}
          type="button"
        >
          {hasStartedFromMenu ? "BACK HOME" : "HOME"}
        </button>
        <button
          className="pointer-events-auto arcade-border bg-(--cabinet-tan) px-3 py-2 text-[10px] md:text-xs"
          onClick={toggleBrowserFullscreen}
          type="button"
        >
          {isBrowserFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
        </button>
      </div>

      <div className="flex h-full w-full items-center justify-center">
        <div className="relative h-[90vh] w-[90vw] max-w-400">
          {hasStartedFromMenu ? <DynamicGameWrapper gameId={gameId} /> : null}
          {hasStartedFromMenu && !isBooting ? <SystemOverlay gameId={gameId} gameTitle={cartridge.title} user={user} /> : null}
          {hasStartedFromMenu ? <AuthModal /> : null}

          {isBooting ? (
            <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/65">
              <div className="arcade-border w-full max-w-sm bg-(--cabinet-tan) p-4 text-center">
                <p className="text-[10px] md:text-xs">{bootMilestones[bootMilestoneIndex]}</p>
              </div>
            </div>
          ) : null}

          {!hasStartedFromMenu ? (
            <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/65 p-4">
              <div className="arcade-border w-full max-w-md bg-(--cabinet-tan) p-5 text-center">
                <h3 className="saloon-title text-2xl text-(--title-red)">{cartridge.title.toUpperCase()}</h3>
                <p className="mt-3 text-[10px] md:text-xs">READY TO BOOT THIS CARTRIDGE?</p>
                <div className="mt-4 flex gap-2">
                  <button className="pixel-button flex-1 px-3 py-2 text-[10px] md:text-xs" onClick={startGameFromMenu} type="button">
                    START
                  </button>
                  <button className="arcade-border flex-1 bg-background px-3 py-2 text-[10px] md:text-xs" onClick={leaveToHome} type="button">
                    GO BACK HOME
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {isRevealVisible ? (
            <div
              className="pointer-events-none absolute inset-0 z-70 bg-foreground transition-[clip-path] duration-600 ease-out"
              style={{ clipPath: isRevealExpanded ? "circle(150% at 50% 50%)" : "circle(0% at 50% 50%)" }}
            />
          ) : null}
        </div>
      </div>

      {isExitConfirmOpen ? (
        <div className="fixed inset-0 z-130 flex items-center justify-center bg-black/60 p-4">
          <div className="arcade-border w-full max-w-md bg-(--cabinet-tan) p-4 text-center">
            <h3 className="saloon-title text-xl text-(--title-red)">LEAVE GAME?</h3>
            <p className="mt-3 text-[10px] md:text-xs">CURRENT RUN WILL BE INTERRUPTED. CONTINUE?</p>
            <div className="mt-4 flex gap-2">
              <button className="pixel-button flex-1 px-3 py-2 text-[10px] md:text-xs" onClick={continuePlaying} type="button">
                CONTINUE
              </button>
              <button
                className="arcade-border flex-1 bg-background px-3 py-2 text-[10px] md:text-xs"
                onClick={leaveToHome}
                type="button"
              >
                LEAVE
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
