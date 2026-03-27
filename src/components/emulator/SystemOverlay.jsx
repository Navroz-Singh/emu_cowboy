"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { EventBus, EVENTS } from "@/lib/eventBus";
import { saveGameState, submitScore } from "@/lib/persistence";
import { useArcadeStore } from "@/store/arcadeStore";
import { useEmulatorStore } from "@/store/emulatorStore";

export default function SystemOverlay({ gameId, gameTitle, user }) {
  const router = useRouter();
  const saveStatusTimeoutRef = useRef(null);
  const gameOverShownAtRef = useRef(0);

  const [saveStatus, setSaveStatus] = useState("");
  const [isGameOverVisible, setIsGameOverVisible] = useState(false);
  const [isLeavingHome, setIsLeavingHome] = useState(false);
  const [finalRunStats, setFinalRunStats] = useState({ rabbitsCollected: 0, coinsCollected: 0 });

  const isPaused = useEmulatorStore((state) => state.isPaused);
  const score = useEmulatorStore((state) => state.score);
  const highScore = useEmulatorStore((state) => state.highScore);
  const ammoCount = useEmulatorStore((state) => state.ammoCount);
  const rabbitsCollected = useEmulatorStore((state) => state.rabbitsCollected);
  const coinsCollected = useEmulatorStore((state) => state.coinsCollected);
  const togglePause = useEmulatorStore((state) => state.togglePause);
  const setPaused = useEmulatorStore((state) => state.setPaused);
  const setScore = useEmulatorStore((state) => state.setScore);
  const setAmmo = useEmulatorStore((state) => state.setAmmo);
  const setRabbitsCollected = useEmulatorStore((state) => state.setRabbitsCollected);
  const setCoinsCollected = useEmulatorStore((state) => state.setCoinsCollected);
  const reset = useEmulatorStore((state) => state.reset);

  const openAuthModal = useArcadeStore((state) => state.openAuthModal);

  const formattedScore = useMemo(() => score.toLocaleString(), [score]);
  const formattedHighScore = useMemo(() => highScore.toLocaleString(), [highScore]);

  useEffect(() => {
    const onScoreUpdated = ({ score: nextScore, ammo, rabbitsCollected: nextRabbitsCollected, coinsCollected: nextCoinsCollected }) => {
      setScore(nextScore);
      if (ammo !== undefined) setAmmo(ammo);
      if (nextRabbitsCollected !== undefined) setRabbitsCollected(nextRabbitsCollected);
      if (nextCoinsCollected !== undefined) setCoinsCollected(nextCoinsCollected);
    };

    const onPlayerDied = async ({ score: finalScore, timePlayed, rabbitsCollected = 0, coinsCollected = 0 }) => {
      setScore(finalScore);
      setRabbitsCollected(rabbitsCollected);
      setCoinsCollected(coinsCollected);
      setFinalRunStats({ rabbitsCollected, coinsCollected });
      setPaused(true);
      EventBus.emit(EVENTS.SYSTEM_PAUSE);
      gameOverShownAtRef.current = Date.now();
      setIsGameOverVisible(true);
      await submitScore(gameId, finalScore, user, timePlayed, { rabbitsCollected, coinsCollected });
    };

    const onSaveRequested = async ({ state }) => {
      setSaveStatus("saving");

      try {
        await saveGameState(gameId, state, user);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }

      if (saveStatusTimeoutRef.current) {
        window.clearTimeout(saveStatusTimeoutRef.current);
      }

      saveStatusTimeoutRef.current = window.setTimeout(() => {
        setSaveStatus("");
        saveStatusTimeoutRef.current = null;
      }, 900);
    };

    EventBus.on(EVENTS.SCORE_UPDATED, onScoreUpdated);
    EventBus.on(EVENTS.PLAYER_DIED, onPlayerDied);
    EventBus.on(EVENTS.SAVE_REQUESTED, onSaveRequested);

    return () => {
      EventBus.off(EVENTS.SCORE_UPDATED, onScoreUpdated);
      EventBus.off(EVENTS.PLAYER_DIED, onPlayerDied);
      EventBus.off(EVENTS.SAVE_REQUESTED, onSaveRequested);

      if (saveStatusTimeoutRef.current) {
        window.clearTimeout(saveStatusTimeoutRef.current);
        saveStatusTimeoutRef.current = null;
      }
    };
  }, [gameId, setAmmo, setCoinsCollected, setPaused, setRabbitsCollected, setScore, user]);

  const handlePauseToggle = () => {
    const nextPaused = togglePause();

    if (nextPaused) {
      EventBus.emit(EVENTS.SYSTEM_PAUSE);
      return;
    }

    EventBus.emit(EVENTS.SYSTEM_RESUME);
  };

  const handlePlayAgain = () => {
    const elapsedSinceGameOver = Date.now() - Number(gameOverShownAtRef.current || 0);
    if (elapsedSinceGameOver < 300) return;

    setIsLeavingHome(false);
    reset();
    setFinalRunStats({ rabbitsCollected: 0, coinsCollected: 0 });
    setIsGameOverVisible(false);
    setPaused(false);
    EventBus.emit(EVENTS.SYSTEM_RESUME);
    EventBus.emit(EVENTS.GAME_RESTART);
  };

  const handleGoHome = () => {
    if (isLeavingHome) return;
    setIsLeavingHome(true);
    setPaused(true);
    EventBus.emit(EVENTS.SYSTEM_PAUSE);
    router.push("/");
  };

  const gameOverModal = isGameOverVisible ? (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/45 p-3">
      <div className="arcade-border w-full max-w-sm bg-(--cabinet-tan) p-4 text-center">
        <h3 className="saloon-title text-2xl text-(--title-red)">GAME OVER</h3>
        <p className="mt-3 text-[10px] md:text-xs">FINAL SCORE</p>
        <p className="mt-1 text-xl text-(--accent-gold)">{formattedScore}</p>
        <p className="mt-2 text-[10px] md:text-xs">RABBITS: {Number(finalRunStats.rabbitsCollected || 0)}</p>
        <p className="text-[10px] md:text-xs">COINS: {Number(finalRunStats.coinsCollected || 0)}</p>

        <div className="mt-4 space-y-2">
          <button className="pixel-button w-full px-3 py-2 text-[10px] md:text-xs" onClick={handlePlayAgain} type="button">
            PLAY AGAIN
          </button>
          <button
            className="arcade-border w-full bg-background px-3 py-2 text-[10px] md:text-xs"
            disabled={isLeavingHome}
            onClick={handleGoHome}
            type="button"
          >
            {isLeavingHome ? "LEAVING..." : "HOME"}
          </button>
          {!user ? (
            <button
              className="arcade-border w-full bg-background px-3 py-2 text-[10px] md:text-xs"
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
        <div className="flex items-start justify-between gap-2 p-2 text-[9px] md:p-3 md:text-xs">
          <div className="arcade-border bg-(--cabinet-tan)/90 px-2 py-2">
            <p>{gameTitle.toUpperCase()}</p>
            <p className="mt-1">SCORE: {formattedScore}</p>
            <p>HIGH: {formattedHighScore}</p>
            <p>AMMO: {ammoCount}</p>
            <p>RABBITS: {rabbitsCollected}</p>
            <p>COINS: {coinsCollected}</p>
          </div>

          <div className="pointer-events-auto flex flex-col items-end gap-2 md:flex-row md:items-center">
            {saveStatus ? (
              <div className="arcade-border bg-(--cabinet-tan)/90 px-2 py-1 text-[9px] md:text-[10px]">
                {saveStatus === "saving" ? "SAVING" : saveStatus === "saved" ? "SAVED" : "SAVE FAILED"}
              </div>
            ) : null}
            <button
              className="arcade-border bg-(--cabinet-tan)/90 px-2 py-1 text-[9px] md:text-[10px]"
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
