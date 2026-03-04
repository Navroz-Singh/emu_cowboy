import ArcadeScreenClient from "@/components/ArcadeScreenClient";
import CabinetShell from "@/components/cabinet/CabinetShell";
import ScreenFrame from "@/components/cabinet/ScreenFrame";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user ?? null;
  const rawUserStat = user
    ? await prisma.userStat.findUnique({
        where: { userId: user.id },
      })
    : null;

  const userStat = rawUserStat
    ? {
        totalScore: rawUserStat.totalScore.toString(),
        gamesPlayed: rawUserStat.gamesPlayed,
        totalTimePlayed: rawUserStat.totalTimePlayed,
        lastPlayedGame: rawUserStat.lastPlayedGame,
      }
    : null;

  return (
    <CabinetShell>
      <ScreenFrame user={user}>
        <ArcadeScreenClient user={user} userStat={userStat} />
      </ScreenFrame>
    </CabinetShell>
  );
}
