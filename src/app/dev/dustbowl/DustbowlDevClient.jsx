"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { EVENTS, EventBus } from "@/lib/eventBus";

const DynamicGameWrapper = dynamic(() => import("@/components/emulator/GameWrapper"), {
  ssr: false,
});

const GAME_ID = "dustbowl-dash";

export default function DustbowlDevClient() {
  const [score, setScore] = useState(0);
  const [ammo, setAmmo] = useState(6);
  const [rabbitsCollected, setRabbitsCollected] = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [runState, setRunState] = useState("BOOTING");
  const [reloadKey, setReloadKey] = useState(0);
  const [lastDeath, setLastDeath] = useState(null);

  const headerText = useMemo(() => {
    if (runState === "RUNNING") return "RUNNING";
    if (runState === "DEAD") return "PLAYER DIED";
    if (runState === "PAUSED") return "PAUSED";
    return "BOOTING";
  }, [runState]);

  useEffect(() => {
    const onReady = () => setRunState("RUNNING");
    const onStart = () => {
      setRunState("RUNNING");
      setLastDeath(null);
    };
    const onScore = (payload = {}) => {
      if (typeof payload.score === "number") setScore(payload.score);
      if (typeof payload.ammo === "number") setAmmo(payload.ammo);
      if (typeof payload.rabbitsCollected === "number") setRabbitsCollected(payload.rabbitsCollected);
      if (typeof payload.coinsCollected === "number") setCoinsCollected(payload.coinsCollected);
    };
    const onDied = (payload = {}) => {
      setRunState("DEAD");
      setLastDeath(payload);
    };

    EventBus.on(EVENTS.GAME_READY, onReady);
    EventBus.on(EVENTS.GAME_START, onStart);
    EventBus.on(EVENTS.SCORE_UPDATED, onScore);
    EventBus.on(EVENTS.PLAYER_DIED, onDied);

    return () => {
      EventBus.off(EVENTS.GAME_READY, onReady);
      EventBus.off(EVENTS.GAME_START, onStart);
      EventBus.off(EVENTS.SCORE_UPDATED, onScore);
      EventBus.off(EVENTS.PLAYER_DIED, onDied);
    };
  }, []);

  const handlePauseResume = () => {
    if (isPaused) {
      EventBus.emit(EVENTS.SYSTEM_RESUME);
      setIsPaused(false);
      setRunState("RUNNING");
      return;
    }

    EventBus.emit(EVENTS.SYSTEM_PAUSE);
    setIsPaused(true);
    setRunState("PAUSED");
  };

  const handleRestart = () => {
    setIsPaused(false);
    setScore(0);
    setAmmo(6);
    setRabbitsCollected(0);
    setCoinsCollected(0);
    setRunState("BOOTING");
    setLastDeath(null);
    EventBus.emit(EVENTS.GAME_RESTART);
  };

  const handleHardReload = () => {
    setIsPaused(false);
    setScore(0);
    setAmmo(6);
    setRabbitsCollected(0);
    setCoinsCollected(0);
    setRunState("BOOTING");
    setLastDeath(null);
    setReloadKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-dvh bg-black text-(--cabinet-tan)">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
        <div className="arcade-border bg-(--screen-bg)/55 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between">
            <div>
              <p className="text-[10px] md:text-xs text-(--title-red)">TEMPORARY DEV PLAYGROUND</p>
              <h1 className="saloon-title text-xl md:text-2xl">DUSTBOWL DASH — PHASE 7</h1>
              <p className="mt-1 text-[10px] md:text-xs">STATUS: {headerText}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button className="pixel-button px-3 py-2 text-[10px] md:text-xs" onClick={handlePauseResume} type="button">
                {isPaused ? "RESUME" : "PAUSE"}
              </button>
              <button className="pixel-button px-3 py-2 text-[10px] md:text-xs" onClick={handleRestart} type="button">
                RESTART (EVENT)
              </button>
              <button className="arcade-border bg-background px-3 py-2 text-[10px] md:text-xs" onClick={handleHardReload} type="button">
                HARD RELOAD
              </button>
              <Link className="arcade-border bg-background px-3 py-2 text-[10px] md:text-xs" href="/">
                HOME
              </Link>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] md:grid-cols-6 md:text-xs">
            <div className="arcade-border bg-black/25 px-2 py-1">SCORE: {score}</div>
            <div className="arcade-border bg-black/25 px-2 py-1">AMMO: {ammo}</div>
            <div className="arcade-border bg-black/25 px-2 py-1">RABBITS: {rabbitsCollected}</div>
            <div className="arcade-border bg-black/25 px-2 py-1">COINS: {coinsCollected}</div>
            <div className="arcade-border bg-black/25 px-2 py-1">PAUSED: {isPaused ? "YES" : "NO"}</div>
            <div className="arcade-border bg-black/25 px-2 py-1">KEY: {reloadKey}</div>
          </div>

          {lastDeath ? (
            <p className="mt-2 text-[10px] text-(--title-red) md:text-xs">
              LAST DEATH → score: {lastDeath.score ?? "?"}, timePlayed: {lastDeath.timePlayed ?? "?"}s, rabbits: {lastDeath.rabbitsCollected ?? "?"}, coins: {lastDeath.coinsCollected ?? "?"}
            </p>
          ) : null}
        </div>

        <div className="arcade-border relative h-[62dvh] min-h-80 w-full overflow-hidden bg-(--screen-bg)/65 md:h-[70vh] md:min-h-125" key={reloadKey}>
          <DynamicGameWrapper gameId={GAME_ID} />
        </div>

        <p className="text-[10px] text-(--cabinet-tan)/80 md:text-xs">
          Temporary route for implementing and validating Phase 7 gameplay loops without going through homepage/start-menu flow.
        </p>
      </div>
    </div>
  );
}
