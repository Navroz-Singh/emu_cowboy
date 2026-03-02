"use client";

import { useMemo } from "react";

import GameCarouselIcon from "@/components/ui/GameCarouselIcon";
import { useArcadeStore } from "@/store/arcadeStore";
import { GAMES } from "@/utils/constants";

export default function GameCarousel() {
  const selectedGameId = useArcadeStore((state) => state.selectedGameId);
  const setSelectedGame = useArcadeStore((state) => state.setSelectedGame);

  const gameList = useMemo(() => GAMES, []);

  return (
    <div className="arcade-border relative overflow-hidden bg-[var(--cabinet-tan)]/50 px-3 py-2">
      <div className="pointer-events-none absolute inset-y-2 left-2 hidden w-32 md:block">
        <div className="tumbleweed absolute bottom-1 left-0 h-3 w-3" />
        <div className="tumbleweed absolute bottom-2 left-6 h-2.5 w-2.5 [animation-duration:10s] [animation-delay:500ms]" />
      </div>
      <div className="pointer-events-none absolute inset-y-2 right-2 hidden w-32 md:block">
        <div className="tumbleweed absolute bottom-1 right-0 h-3 w-3 [animation-duration:9s]" />
        <div className="tumbleweed absolute bottom-2 right-8 h-2.5 w-2.5 [animation-duration:11s] [animation-delay:800ms]" />
      </div>
      <div className="relative flex items-center justify-center gap-2 md:gap-4">
        {gameList.map((game) => (
          <GameCarouselIcon
            key={game.id}
            isSelected={game.id === selectedGameId}
            onSelect={() => setSelectedGame(game.id)}
            src={game.src}
            title={game.title}
          />
        ))}
      </div>
    </div>
  );
}
