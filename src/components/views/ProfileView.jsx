"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { getLocalStats } from "@/lib/persistence";
import { AVATARS } from "@/utils/constants";

export default function ProfileView({ user, userStat }) {
  const router = useRouter();
  const [avatarError, setAvatarError] = useState("");
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const [guestStats, setGuestStats] = useState(null);

  useEffect(() => {
    if (user) {
      setGuestStats(null);
      return;
    }

    setGuestStats(getLocalStats());
  }, [user]);

  const guestTimePlayedLabel = useMemo(() => {
    if (!guestStats) return "0H (LOCAL)";
    const hours = (guestStats.totalTimePlayed / 3600).toFixed(1);
    return `${hours}H (LOCAL)`;
  }, [guestStats]);

  const guestTotalScoreLabel = useMemo(() => {
    if (!guestStats) return "0 (LOCAL)";

    try {
      return `${BigInt(guestStats.totalScore).toLocaleString()} (LOCAL)`;
    } catch {
      return "0 (LOCAL)";
    }
  }, [guestStats]);

  const guestGamesPlayedLabel = useMemo(() => {
    if (!guestStats) return "0 (LOCAL)";
    return `${guestStats.gamesPlayed} (LOCAL)`;
  }, [guestStats]);

  const lastPlayedLabel = useMemo(() => {
    if (user) {
      if (!userStat?.lastPlayedGame) return "N/A";
      return userStat.lastPlayedGame.replaceAll("-", " ").toUpperCase();
    }
    if (!guestStats?.lastPlayedGame) return "N/A (LOCAL)";

    return `${guestStats.lastPlayedGame.toUpperCase()} (LOCAL)`;
  }, [guestStats, user, userStat?.lastPlayedGame]);

  const serverTotalScoreLabel = useMemo(() => {
    if (!user) return null;

    try {
      return BigInt(userStat?.totalScore || 0).toLocaleString();
    } catch {
      return "0";
    }
  }, [user, userStat?.totalScore]);

  const serverGamesPlayedLabel = useMemo(() => {
    if (!user) return null;
    return String(userStat?.gamesPlayed ?? 0);
  }, [user, userStat?.gamesPlayed]);

  const serverTimePlayedLabel = useMemo(() => {
    if (!user) return null;
    const totalSeconds = Number(userStat?.totalTimePlayed ?? 0);
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0.0H";
    return `${(totalSeconds / 3600).toFixed(1)}H`;
  }, [user, userStat?.totalTimePlayed]);

  const handleAvatarChange = async (image) => {
    if (!user || isAvatarSaving || user.image === image) return;

    setAvatarError("");
    setIsAvatarSaving(true);

    const response = await fetch("/api/v1/users/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });

    setIsAvatarSaving(false);

    if (!response.ok) {
      setAvatarError("Unable to update avatar.");
      return;
    }

    router.refresh();
  };

  return (
    <section className="grid h-full grid-cols-1 gap-3 md:grid-cols-[35%_25%_40%]">
      <div className="arcade-border flex flex-col gap-3 bg-(--cabinet-tan)/35 p-3 text-[10px] md:text-xs">
        <div className="arcade-border relative h-24 w-24 overflow-hidden bg-(--screen-bg)/70">
          <Image alt={user?.name ?? "Guest avatar"} className="object-cover" fill src={user?.image || AVATARS[0]} />
        </div>
        <div className="space-y-2 leading-5">
          <p>USERNAME: {user?.name ?? "GUEST"}</p>
          <p>MEMBER SINCE: {user ? "03/29/2011" : "N/A"}</p>
          <p>REGION: {user ? "USA" : "LOCAL"}</p>
        </div>
        {user ? (
          <div className="space-y-2">
            <p className="text-[9px] md:text-[10px]">SELECT AVATAR</p>
            <div className="relative">
              <div className="grid grid-cols-5 gap-1">
                {AVATARS.map((avatarSrc) => {
                  const isSelected = avatarSrc === user.image;

                  return (
                    <button
                      key={avatarSrc}
                      className={[
                        "arcade-border relative aspect-square overflow-hidden",
                        isSelected ? "glow-gold" : "",
                        isAvatarSaving ? "loading-blink" : "",
                      ].join(" ")}
                      disabled={isAvatarSaving}
                      onClick={() => handleAvatarChange(avatarSrc)}
                      type="button"
                    >
                      <Image alt="Avatar option" className="object-cover" fill src={avatarSrc} />
                    </button>
                  );
                })}
              </div>
              {isAvatarSaving ? (
                <div className="absolute inset-0 flex items-center justify-center bg-(--screen-bg)/55">
                  <div className="arcade-border loading-blink bg-(--cabinet-tan) px-2 py-1 text-[9px]">
                    SAVING AVATAR...
                  </div>
                </div>
              ) : null}
            </div>
            {avatarError ? <p className="text-[9px] text-(--title-red)">{avatarError}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="arcade-border bg-(--cabinet-tan)/35 p-3 text-[10px] leading-5 md:text-xs">
        <h3 className="mb-2">PLAYER STATS</h3>
        <p>TOTAL SCORE</p>
        <p className="mb-2">{user ? serverTotalScoreLabel : guestTotalScoreLabel}</p>
        <p>GAMES PLAYED</p>
        <p className="mb-2">{user ? serverGamesPlayedLabel : guestGamesPlayedLabel}</p>
        <p>TOTAL TIME PLAYED</p>
        <p className="mb-2">{user ? serverTimePlayedLabel : guestTimePlayedLabel}</p>
        <p>MOST PLAYED GAME</p>
        <p>{lastPlayedLabel}</p>
      </div>

      <div className="arcade-border bg-(--cabinet-tan)/35 p-3 text-[10px] md:text-xs">
        <h3 className="mb-3">RECENT ACHIEVEMENTS</h3>
        <div className="grid grid-cols-2 gap-2">
          {["PONG MASTER", "DUSTBOWL VETERAN", "FISTFIGHT CHAMPION", "10K SCORE CLUB"].map((label) => (
            <div key={label} className="arcade-border flex min-h-20 items-end justify-center bg-(--screen-bg)/70 p-2 text-center text-[8px] md:text-[9px]">
              {label}
            </div>
          ))}
        </div>
        {!user ? <p className="mt-3 text-[9px] text-(--title-red)">LOG IN TO SAVE YOUR PROGRESS</p> : null}
      </div>
    </section>
  );
}
