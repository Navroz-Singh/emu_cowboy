"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { GAME_REGISTRY } from "@/games/registry";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useArcadeStore } from "@/store/arcadeStore";
import { GAMES } from "@/utils/constants";

export default function AllGamesView() {
  const router = useRouter();
  const selectedGameId = useArcadeStore((state) => state.selectedGameId);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchMilestoneIndex, setLaunchMilestoneIndex] = useState(0);
  const milestoneTimeoutsRef = useRef([]);

  const launchMilestones = ["PREPARING CARTRIDGE...", "LOADING ASSETS...", "BOOTING..."];

  useEffect(() => {
    return () => {
      milestoneTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      milestoneTimeoutsRef.current = [];
    };
  }, []);

  const selectedGame = useMemo(
    () => GAMES.find((game) => game.id === selectedGameId) ?? GAMES[0],
    [selectedGameId],
  );

  const registryGame = useMemo(() => GAME_REGISTRY[selectedGameId] ?? null, [selectedGameId]);
  const { rows: leaderRows, isLoading: isLeadersLoading } = useLeaderboard(selectedGameId, { limit: 3 });

  const handleLaunchPrep = () => {
    if (isLaunching) return;

    setIsLaunching(true);
    setLaunchMilestoneIndex(0);

    milestoneTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    milestoneTimeoutsRef.current = [];

    milestoneTimeoutsRef.current.push(
      window.setTimeout(() => setLaunchMilestoneIndex(1), 350),
      window.setTimeout(() => setLaunchMilestoneIndex(2), 900),
    );

    const isPlayable = Boolean(registryGame?.config && registryGame?.sceneImporter);
    if (isPlayable) {
      router.push(`/play/${selectedGameId}`);
      return;
    }

    router.push(`/coming-soon/${selectedGameId}`);
  };

  return (
    <section className="grid h-full grid-cols-1 gap-3 md:grid-cols-[45%_55%]">
      <div className="arcade-border bg-(--cabinet-tan)/40 p-3">
        <div className="relative mx-auto aspect-square w-full max-w-105">
          <Image
            alt={registryGame?.title || selectedGame.title}
            className="rounded-md border-2 border-(--border-brown)/50 object-cover"
            fill
            src={selectedGame.src}
          />
        </div>
      </div>

      <div className="flex h-full flex-col gap-3">
        <h2 className="saloon-title text-3xl text-(--title-red) md:text-5xl">
          {(registryGame?.title || selectedGame.title).toUpperCase()}
        </h2>
        <p className="text-[10px] leading-6 md:text-xs">
          {registryGame?.description || selectedGame.shortDescription}
        </p>
        <button
          className={[
            "pixel-button w-full px-4 py-4 text-xs",
            isLaunching ? "loading-blink" : "",
          ].join(" ")}
          disabled={isLaunching}
          onClick={handleLaunchPrep}
          type="button"
        >
          {isLaunching ? launchMilestones[launchMilestoneIndex] : "START / INSERT COIN"}
        </button>
        <div className="arcade-border mt-auto bg-(--cabinet-tan)/40 p-3 text-[10px] md:text-xs">
          <p className="mb-2">GLOBAL LEADERS</p>
          {isLeadersLoading ? <p className="loading-blink">LOADING...</p> : null}
          {!isLeadersLoading && leaderRows.length === 0 ? <p>NO SCORES YET</p> : null}
          <div className="space-y-1">
            {leaderRows.map((row, index) => (
              <div key={`${row.userId}-${row.rank}`} className="flex justify-between">
                <span>{index + 1}. {(row.playerName || "UNKNOWN").toUpperCase()}</span>
                <span>{Number(row.value || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
