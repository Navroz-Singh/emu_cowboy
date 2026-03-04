"use client";

import { useEffect, useRef, useState } from "react";
import { AUTO, Game, Scale } from "phaser";

import { GAME_REGISTRY } from "@/games/registry";

export default function GameWrapper({ gameId, width = 800, height = 600 }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function initGame() {
      try {
        const cartridge = GAME_REGISTRY[gameId];

        if (!cartridge?.sceneImporter || !isMounted || gameRef.current || !containerRef.current) {
          return;
        }

        const scenes = await cartridge.sceneImporter();
        if (!isMounted) return;

        const config = {
          type: AUTO,
          parent: containerRef.current,
          width,
          height,
          scale: {
            mode: Scale.FIT,
            autoCenter: Scale.CENTER_BOTH,
            width,
            height,
          },
          ...cartridge.config,
          scene: scenes,
        };

        gameRef.current = new Game(config);
      } catch {
        setError("Unable to initialize game cartridge.");
      }
    }

    initGame();

    return () => {
      isMounted = false;

      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [gameId, width, height]);

  return (
    <div className="arcade-border relative h-full w-full overflow-hidden bg-(--screen-bg)/65">
      {error ? (
        <div className="arcade-border absolute left-3 top-3 z-10 bg-(--cabinet-tan) px-3 py-2 text-[10px] text-(--title-red)">
          {error}
        </div>
      ) : null}
      <div className="h-full w-full" ref={containerRef} />
    </div>
  );
}
