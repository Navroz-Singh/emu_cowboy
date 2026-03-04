import { headers } from "next/headers";
import { notFound } from "next/navigation";

import PlayClient from "@/app/play/[gameId]/PlayClient";
import { GAME_REGISTRY } from "@/games/registry";
import { auth } from "@/lib/auth";

export default async function PlayPage({ params }) {
  const { gameId } = await params;
  const cartridge = GAME_REGISTRY[gameId];

  if (!cartridge || !cartridge.config) {
    return notFound();
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user ?? null;

  return <PlayClient gameId={gameId} user={user} />;
}
