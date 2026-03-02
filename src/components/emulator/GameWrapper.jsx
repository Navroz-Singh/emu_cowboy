"use client";

import { useEffect, useRef, useState } from "react";

export default function GameWrapper({ gameId, width = 800, height = 600 }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function initGame() {
      try {
        const Phaser = await import("phaser");
        const { GAME_REGISTRY } = await import("@/games/registry");
        const cartridge = GAME_REGISTRY[gameId];

        if (!cartridge?.sceneImporter || !isMounted || !containerRef.current || gameRef.current) {
          return;
        }

        const scenes = await cartridge.sceneImporter();

        const config = {
          type: Phaser.AUTO,
          parent: containerRef.current,
          width,
          height,
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width,
            height,
          },
          ...cartridge.config,
          scene: scenes,
        };

        gameRef.current = new Phaser.Game(config);
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
    <div className="arcade-border flex h-full w-full items-center justify-center overflow-hidden bg-[var(--screen-bg)]/65">
      {error ? (
        <div className="arcade-border bg-[var(--cabinet-tan)] px-3 py-2 text-[10px] text-[var(--title-red)]">{error}</div>
      ) : null}
      <div className="h-full w-full" ref={containerRef} />
    </div>
  );
}
