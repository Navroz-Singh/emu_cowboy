"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { useLeaderboard } from "@/hooks/useLeaderboard";
import { getLocalHighScore } from "@/lib/persistence";
import { useArcadeStore } from "@/store/arcadeStore";
import { GAMES } from "@/utils/constants";

const REGION_OPTIONS = [
  { value: "", label: "WORLD" },
  { value: "NORTH_AMERICA", label: "NORTH AMERICA" },
  { value: "SOUTH_AMERICA", label: "SOUTH AMERICA" },
  { value: "EUROPE", label: "EUROPE" },
  { value: "AFRICA", label: "AFRICA" },
  { value: "ASIA", label: "ASIA" },
  { value: "MIDDLE_EAST", label: "MIDDLE EAST" },
  { value: "OCEANIA", label: "OCEANIA" },
];

export default function LeaderboardsView({ user }) {
  const selectedGameId = useArcadeStore((state) => state.selectedGameId);
  const [region, setRegion] = useState("");
  const [guestHighScore, setGuestHighScore] = useState(0);

  const selectedGame = useMemo(
    () => GAMES.find((game) => game.id === selectedGameId) ?? GAMES[0],
    [selectedGameId],
  );

  const { rows, isLoading, error } = useLeaderboard(selectedGameId, { region, limit: 15 });

  useEffect(() => {
    let isMounted = true;

    async function loadGuestHighScore() {
      if (user) {
        setGuestHighScore(0);
        return;
      }

      const highScore = await getLocalHighScore(selectedGameId);
      if (isMounted) setGuestHighScore(highScore);
    }

    loadGuestHighScore();

    return () => {
      isMounted = false;
    };
  }, [selectedGameId, user]);

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
        <h2 className="saloon-title mb-3 text-lg leading-tight text-(--title-red) md:text-3xl">
          GLOBAL LEADERBOARDS - {selectedGame.title.toUpperCase()}
        </h2>
        <div className="mb-3 flex flex-wrap gap-2 text-[9px] md:text-[10px]">
          <label className="arcade-border flex items-center gap-2 bg-background px-2 py-1">
            <span>REGION:</span>
            <select className="bg-transparent" onChange={(event) => setRegion(event.target.value)} value={region}>
              {REGION_OPTIONS.map((option) => (
                <option key={option.value || "WORLD"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="min-w-130">
            <div className="grid grid-cols-[56px_1fr_92px_100px_84px] gap-x-2 border-b-2 border-foreground pb-2 text-[9px] md:text-[10px]">
              <span>RANK</span><span>PLAYER</span><span>SCORE</span><span>DATE</span><span>COUNTRY</span>
            </div>

            <div className="mt-2 space-y-1 pr-1 text-[9px] md:text-[10px]">
              {isLoading ? <p className="loading-blink px-1 py-1">LOADING...</p> : null}
              {error ? <p className="px-1 py-1 text-(--title-red)">{error}</p> : null}
              {rows.map((row) => {
                const isCurrentUserRow = Boolean(user?.id) && row.userId === user.id;
                const dateLabel = row.achievedAt ? new Date(row.achievedAt).toISOString().slice(0, 10) : "-";

                return (
                  <div
                    key={`${row.userId}-${row.rank}`}
                    className={[
                      "grid grid-cols-[56px_1fr_92px_100px_84px] gap-x-2 rounded px-1 py-1",
                      isCurrentUserRow ? "bg-(--accent-gold)/25 outline-2 outline-(--accent-gold)" : "",
                    ].join(" ")}
                  >
                    <span>{row.rank}</span>
                    <span className="truncate">{(row.playerName || "UNKNOWN").toUpperCase()}</span>
                    <span>{row.value}</span>
                    <span>{dateLabel}</span>
                    <span>{row.countryCode || "XX"}</span>
                  </div>
                );
              })}
              {!user && guestHighScore > 0 ? (
                <div className="grid grid-cols-[56px_1fr_92px_100px_84px] gap-x-2 rounded bg-(--accent-gold)/20 px-1 py-1 outline-2 outline-(--accent-gold)">
                  <span>-</span>
                  <span className="truncate">GUEST</span>
                  <span>{guestHighScore}</span>
                  <span>LOCAL</span>
                  <span>--</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
