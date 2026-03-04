"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { useLeaderboard } from "@/hooks/useLeaderboard";
import { getLocalHighScore } from "@/lib/persistence";
import { useArcadeStore } from "@/store/arcadeStore";
import { GAMES } from "@/utils/constants";

const COUNTRY_OPTIONS = ["", "US", "CA", "MX", "BR", "JP", "GB"];

export default function LeaderboardsView({ user }) {
  const selectedGameId = useArcadeStore((state) => state.selectedGameId);
  const [country, setCountry] = useState("");
  const [sort, setSort] = useState("score");
  const [guestHighScore, setGuestHighScore] = useState(0);

  const selectedGame = useMemo(
    () => GAMES.find((game) => game.id === selectedGameId) ?? GAMES[0],
    [selectedGameId],
  );

  const { rows, isLoading, error } = useLeaderboard(selectedGameId, { country, sort });

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
        <h2 className="saloon-title mb-3 text-xl text-(--title-red) md:text-3xl">
          GLOBAL LEADERBOARDS - {selectedGame.title.toUpperCase()}
        </h2>
        <div className="mb-3 flex gap-2 text-[9px] md:text-[10px]">
          <label className="arcade-border flex items-center gap-2 bg-background px-2 py-1">
            <span>FILTER:</span>
            <select className="bg-transparent" onChange={(event) => setCountry(event.target.value)} value={country}>
              <option value="">WORLD</option>
              {COUNTRY_OPTIONS.filter(Boolean).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="arcade-border flex items-center gap-2 bg-background px-2 py-1">
            <span>SORT:</span>
            <select className="bg-transparent" onChange={(event) => setSort(event.target.value)} value={sort}>
              <option value="score">TOP SCORE</option>
              <option value="recent">MOST RECENT</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-[10%_30%_20%_20%_20%] gap-x-2 border-b-2 border-foreground pb-2 text-[9px] md:text-[10px]">
          <span>RANK</span><span>PLAYER</span><span>SCORE</span><span>DATE</span><span>COUNTRY</span>
        </div>

        <div className="mt-2 space-y-1 overflow-y-auto overflow-x-hidden pr-1 text-[9px] md:text-[10px]">
          {isLoading ? <p className="loading-blink px-1 py-1">LOADING...</p> : null}
          {error ? <p className="px-1 py-1 text-(--title-red)">{error}</p> : null}
          {rows.map((row) => {
            const isCurrentUserRow = Boolean(user?.id) && row.userId === user.id;
            const dateLabel = row.achievedAt ? new Date(row.achievedAt).toISOString().slice(0, 10) : "-";

            return (
              <div
                key={`${row.userId}-${row.rank}`}
                className={[
                  "grid grid-cols-[10%_30%_20%_20%_20%] gap-x-2 rounded px-1 py-1",
                  isCurrentUserRow ? "bg-(--accent-gold)/25 outline-2 outline-(--accent-gold)" : "",
                ].join(" ")}
              >
                <span>{row.rank}</span>
                <span>{(row.playerName || "UNKNOWN").toUpperCase()}</span>
                <span>{row.value}</span>
                <span>{dateLabel}</span>
                <span>{row.countryCode || "XX"}</span>
              </div>
            );
          })}
          {!user && guestHighScore > 0 ? (
            <div className="grid grid-cols-[10%_30%_20%_20%_20%] gap-x-2 rounded bg-(--accent-gold)/20 px-1 py-1 outline-2 outline-(--accent-gold)">
              <span>-</span>
              <span>GUEST</span>
              <span>{guestHighScore}</span>
              <span>LOCAL</span>
              <span>--</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
