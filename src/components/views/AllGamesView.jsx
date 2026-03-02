"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { useArcadeStore } from "@/store/arcadeStore";
import { GAMES } from "@/utils/constants";

export default function AllGamesView() {
  const router = useRouter();
  const selectedGameId = useArcadeStore((state) => state.selectedGameId);
  const [isLaunching, setIsLaunching] = useState(false);

  const selectedGame = useMemo(
    () => GAMES.find((game) => game.id === selectedGameId) ?? GAMES[0],
    [selectedGameId],
  );

  const handleLaunch = () => {
    if (isLaunching) return;
    setIsLaunching(true);

    window.setTimeout(() => {
      setIsLaunching(false);
      router.push(`/play/${selectedGameId}`);
    }, 700);
  };

  return (
    <section className="grid h-full grid-cols-1 gap-3 md:grid-cols-[45%_55%]">
      <div className="arcade-border bg-[var(--cabinet-tan)]/40 p-3">
        <div className="relative mx-auto aspect-square w-full max-w-[420px]">
          <Image
            alt={selectedGame.title}
            className="rounded-md border-2 border-[var(--border-brown)]/50 object-cover"
            fill
            src={selectedGame.src}
          />
        </div>
      </div>

      <div className="flex h-full flex-col gap-3">
        <h2 className="saloon-title text-3xl text-[var(--title-red)] md:text-5xl">{selectedGame.title.toUpperCase()}</h2>
        <p className="text-[10px] leading-6 md:text-xs">{selectedGame.shortDescription}</p>
        <button
          className={[
            "pixel-button w-full px-4 py-4 text-xs",
            isLaunching ? "loading-blink" : "",
          ].join(" ")}
          disabled={isLaunching}
          onClick={handleLaunch}
          type="button"
        >
          {isLaunching ? "LOADING GAME..." : "START / INSERT COIN"}
        </button>
        <div className="arcade-border mt-auto bg-[var(--cabinet-tan)]/40 p-3 text-[10px] md:text-xs">
          <p className="mb-2">GLOBAL LEADERS</p>
          <div className="space-y-1">
            <div className="flex justify-between"><span>1. DESERTKING</span><span>12,900</span></div>
            <div className="flex justify-between"><span>2. DUSTRIDER</span><span>11,440</span></div>
            <div className="flex justify-between"><span>3. LASSOLASS</span><span>10,805</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
