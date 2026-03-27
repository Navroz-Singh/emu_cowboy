import Link from "next/link";
import { notFound } from "next/navigation";

import { GAME_REGISTRY } from "@/games/registry";

export default async function ComingSoonPage({ params }) {
  const { gameId } = await params;
  const cartridge = GAME_REGISTRY[gameId];

  if (!cartridge) {
    return notFound();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-(--cabinet-tan) p-4 text-(--foreground)">
      <div className="arcade-border w-full max-w-xl bg-(--cabinet-tan)/40 p-6 text-center">
        <h1 className="saloon-title text-2xl leading-tight text-(--title-red) md:text-5xl">COMING SOON</h1>
        <p className="mt-4 text-xs leading-6 md:text-base">{cartridge.title.toUpperCase()} IS STILL IN DEVELOPMENT.</p>
        <p className="mt-2 text-[10px] md:text-xs">WE&apos;RE WORKING ON IT. CHECK BACK SOON.</p>

        <div className="mt-6 flex justify-center gap-2">
          <Link className="pixel-button px-4 py-2 text-[10px] md:text-xs" href="/">
            BACK TO ARCADE
          </Link>
        </div>
      </div>
    </main>
  );
}
