"use client";

import { useMemo } from "react";
import Image from "next/image";

import { useArcadeStore } from "@/store/arcadeStore";
import { GAMES } from "@/utils/constants";

const rows = Array.from({ length: 15 }).map((_, index) => ({
  rank: index + 1,
  player: `PLAYER_${String(index + 1).padStart(2, "0")}`,
  score: 12000 - index * 230,
  date: "2026-02-28",
  country: "US",
}));

export default function LeaderboardsView() {
  const selectedGameId = useArcadeStore((state) => state.selectedGameId);

  const selectedGame = useMemo(
    () => GAMES.find((game) => game.id === selectedGameId) ?? GAMES[0],
    [selectedGameId],
  );

  return (
    <section className="grid h-full grid-cols-1 gap-3 md:grid-cols-[30%_70%]">
      <div className="arcade-border bg-(--cabinet-tan)/40 p-3">
        <div className="relative mx-auto aspect-square w-full max-w-[320px]">
          <Image
            alt={selectedGame.title}
            className="rounded-md border-2 border-(--border-brown)/50 object-cover"
            fill
            src={selectedGame.src}
          />
        </div>
      </div>

      <div className="arcade-border flex min-h-0 flex-col bg-(--cabinet-tan)/30 p-3">
        <h2 className="saloon-title mb-3 text-xl text-(--title-red) md:text-3xl">
          GLOBAL LEADERBOARDS - {selectedGame.title.toUpperCase()}
        </h2>
        <div className="mb-3 flex gap-2 text-[9px] md:text-[10px]">
          <div className="arcade-border bg-background px-2 py-1">FILTER: WORLD</div>
          <div className="arcade-border bg-background px-2 py-1">SORT: TOP SCORE</div>
        </div>

        <div className="grid grid-cols-[10%_30%_20%_20%_20%] gap-x-2 border-b-2 border-foreground pb-2 text-[9px] md:text-[10px]">
          <span>RANK</span><span>PLAYER</span><span>SCORE</span><span>DATE</span><span>COUNTRY</span>
        </div>

        <div className="mt-2 space-y-1 overflow-y-auto overflow-x-hidden pr-1 text-[9px] md:text-[10px]">
          {rows.map((row) => (
            <div
              key={row.rank}
              className={[
                "grid grid-cols-[10%_30%_20%_20%_20%] gap-x-2 rounded px-1 py-1",
                row.player === "PLAYER_04" ? "bg-(--accent-gold)/25 outline-2 outline-(--accent-gold)" : "",
              ].join(" ")}
            >
              <span>{row.rank}</span>
              <span>{row.player}</span>
              <span>{row.score}</span>
              <span>{row.date}</span>
              <span>{row.country}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
