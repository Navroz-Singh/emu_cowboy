import ArcadeScreenClient from "@/components/ArcadeScreenClient";
import CabinetShell from "@/components/cabinet/CabinetShell";
import ScreenFrame from "@/components/cabinet/ScreenFrame";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user ?? null;

  return (
    <CabinetShell>
      <ScreenFrame user={user}>
        <ArcadeScreenClient user={user} />
      </ScreenFrame>
    </CabinetShell>
  );
}
