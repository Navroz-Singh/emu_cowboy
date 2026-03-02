"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { EVENTS, EventBus } from "@/lib/eventBus";
import { saveGameState, submitScore } from "@/lib/persistence";
import { useArcadeStore } from "@/store/arcadeStore";
import { useEmulatorStore } from "@/store/emulatorStore";

export default function SystemOverlay({ gameId, gameTitle, user }) {
  const router = useRouter();
  const [saveStatus, setSaveStatus] = useState("");

  const isPaused = useEmulatorStore((state) => state.isPaused);
  const score = useEmulatorStore((state) => state.score);
  const ammoCount = useEmulatorStore((state) => state.ammoCount);
  const highScore = useEmulatorStore((state) => state.highScore);
  const isGameOverVisible = useEmulatorStore((state) => state.isGameOverVisible);
  const togglePause = useEmulatorStore((state) => state.togglePause);
  const setPaused = useEmulatorStore((state) => state.setPaused);
  const setScore = useEmulatorStore((state) => state.setScore);
  const setAmmo = useEmulatorStore((state) => state.setAmmo);
  const reset = useEmulatorStore((state) => state.reset);
  const setGameOverVisible = useEmulatorStore((state) => state.setGameOverVisible);
  const openAuthModal = useArcadeStore((state) => state.openAuthModal);
  const isAuthModalOpen = useArcadeStore((state) => state.isAuthModalOpen);
  const prevAuthModalOpenRef = useRef(false);
  const authModalForcedPauseRef = useRef(false);

  const formattedScore = useMemo(() => score.toLocaleString(), [score]);
  const formattedHighScore = useMemo(() => highScore.toLocaleString(), [highScore]);

  useEffect(() => {
    const onScoreUpdated = ({ score: nextScore, ammo }) => {
      setScore(nextScore);
      if (ammo !== undefined) {
        setAmmo(ammo);
      }
    };

    const onPlayerDied = async ({ score: finalScore, timePlayed }) => {
      setScore(finalScore);
      setGameOverVisible(true);
      await submitScore(gameId, finalScore, user, timePlayed);
    };

    const onSaveRequested = async ({ state }) => {
      setSaveStatus("saving");

      try {
        await saveGameState(gameId, state, user);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }

      window.setTimeout(() => setSaveStatus(""), 900);
    };

    EventBus.on(EVENTS.SCORE_UPDATED, onScoreUpdated);
    EventBus.on(EVENTS.PLAYER_DIED, onPlayerDied);
    EventBus.on(EVENTS.SAVE_REQUESTED, onSaveRequested);

    return () => {
      EventBus.off(EVENTS.SCORE_UPDATED, onScoreUpdated);
      EventBus.off(EVENTS.PLAYER_DIED, onPlayerDied);
      EventBus.off(EVENTS.SAVE_REQUESTED, onSaveRequested);
    };
  }, [gameId, setAmmo, setGameOverVisible, setScore, user]);

  useEffect(() => {
    const wasAuthModalOpen = prevAuthModalOpenRef.current;

    if (isAuthModalOpen && !wasAuthModalOpen) {
      if (!isPaused) {
        authModalForcedPauseRef.current = true;
        setPaused(true);
        EventBus.emit(EVENTS.SYSTEM_PAUSE);
      } else {
        authModalForcedPauseRef.current = false;
      }
    }

    if (!isAuthModalOpen && wasAuthModalOpen) {
      if (authModalForcedPauseRef.current && isPaused && !isGameOverVisible) {
        setPaused(false);
        EventBus.emit(EVENTS.SYSTEM_RESUME);
      }

      authModalForcedPauseRef.current = false;
    }

    prevAuthModalOpenRef.current = isAuthModalOpen;
  }, [isAuthModalOpen, isPaused, isGameOverVisible, setPaused]);

  const handlePauseToggle = () => {
    const nextPaused = togglePause();

    if (nextPaused) {
      EventBus.emit(EVENTS.SYSTEM_PAUSE);
      return;
    }

    EventBus.emit(EVENTS.SYSTEM_RESUME);
  };

  const handlePlayAgain = () => {
    reset();
    setPaused(false);
    setGameOverVisible(false);
    EventBus.emit(EVENTS.GAME_RESTART);
  };

  const gameOverModal = isGameOverVisible ? (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-3">
      <div className="arcade-border w-full max-w-sm bg-[var(--cabinet-tan)] p-4 text-center">
        <h3 className="saloon-title text-2xl text-[var(--title-red)]">GAME OVER</h3>
        <p className="mt-3 text-[10px] md:text-xs">FINAL SCORE</p>
        <p className="mt-1 text-xl text-[var(--accent-gold)]">{formattedScore}</p>

        <div className="mt-4 space-y-2">
          <button className="pixel-button w-full px-3 py-2 text-[10px] md:text-xs" onClick={handlePlayAgain} type="button">
            PLAY AGAIN
          </button>
          <button
            className="arcade-border w-full bg-[var(--screen-bg)] px-3 py-2 text-[10px] md:text-xs"
            onClick={() => router.push("/")}
            type="button"
          >
            HOME
          </button>
          {!user ? (
            <button
              className="arcade-border w-full bg-[var(--screen-bg)] px-3 py-2 text-[10px] md:text-xs"
              onClick={() => openAuthModal("login")}
              type="button"
            >
              LOG IN TO SAVE SCORE
            </button>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="flex items-start justify-between p-3 text-[10px] md:text-xs">
          <div className="arcade-border bg-[var(--cabinet-tan)]/90 px-2 py-2">
            <p>{gameTitle.toUpperCase()}</p>
            <p className="mt-1">SCORE: {formattedScore}</p>
            <p>HIGH: {formattedHighScore}</p>
            <p>AMMO: {ammoCount}</p>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {saveStatus ? (
              <div className="arcade-border bg-[var(--cabinet-tan)]/90 px-2 py-1 text-[9px] md:text-[10px]">
                {saveStatus === "saving" ? "SAVING" : saveStatus === "saved" ? "SAVED" : "SAVE FAILED"}
              </div>
            ) : null}
            <button
              className="arcade-border bg-[var(--cabinet-tan)]/90 px-2 py-1 text-[9px] md:text-[10px]"
              onClick={handlePauseToggle}
              type="button"
            >
              {isPaused ? "RESUME" : "PAUSE"}
            </button>
          </div>
        </div>
      </div>
      {typeof document !== "undefined" ? createPortal(gameOverModal, document.body) : null}
    </>
  );
}
