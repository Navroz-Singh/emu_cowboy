"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { migrateLocalDataToServer } from "@/lib/persistence";
import { useArcadeStore } from "@/store/arcadeStore";
import { AVATARS } from "@/utils/constants";

export default function RegisterForm() {
  const router = useRouter();
  const closeAuthModal = useArcadeStore((state) => state.closeAuthModal);
  const setAuthMode = useArcadeStore((state) => state.setAuthMode);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    const { data, error } = await authClient.signUp.email({
      email,
      image: selectedAvatar,
      name,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message || "Unable to register.");
      return;
    }

    try {
      const sessionUser = data?.user ?? (await authClient.getSession())?.data?.user ?? null;
      await migrateLocalDataToServer(sessionUser);
    } catch {}

    closeAuthModal();
    router.refresh();
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label className="text-[10px] md:text-xs" htmlFor="register-name">USERNAME</label>
        <input
          className="arcade-border w-full bg-[var(--screen-bg)] px-2 py-2 text-[10px] md:text-xs"
          id="register-name"
          onChange={(event) => setName(event.target.value)}
          required
          type="text"
          value={name}
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] md:text-xs" htmlFor="register-email">EMAIL</label>
        <input
          className="arcade-border w-full bg-[var(--screen-bg)] px-2 py-2 text-[10px] md:text-xs"
          id="register-email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] md:text-xs" htmlFor="register-password">PASSWORD</label>
        <input
          className="arcade-border w-full bg-[var(--screen-bg)] px-2 py-2 text-[10px] md:text-xs"
          id="register-password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] md:text-xs">SELECT AVATAR</p>
        <div className="grid grid-cols-5 gap-2">
          {AVATARS.map((avatarSrc) => {
            const isSelected = avatarSrc === selectedAvatar;

            return (
              <button
                key={avatarSrc}
                className={[
                  "arcade-border relative aspect-square overflow-hidden",
                  isSelected ? "glow-gold" : "",
                ].join(" ")}
                disabled={isSubmitting}
                onClick={() => setSelectedAvatar(avatarSrc)}
                type="button"
              >
                <Image alt="Avatar option" className="object-cover" fill src={avatarSrc} />
              </button>
            );
          })}
        </div>
      </div>

      {errorMessage ? <p className="text-[9px] text-[var(--title-red)] md:text-[10px]">{errorMessage}</p> : null}

      <button
        className={[
          "pixel-button w-full px-3 py-2 text-[10px] md:text-xs",
          isSubmitting ? "loading-blink" : "",
        ].join(" ")}
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "CREATING ACCOUNT..." : "REGISTER"}
      </button>

      <button
        className="w-full text-[9px] text-[var(--border-brown)]/80 underline md:text-[10px]"
        disabled={isSubmitting}
        onClick={() => setAuthMode("login")}
        type="button"
      >
        ALREADY HAVE AN ACCOUNT? SIGN IN
      </button>
    </form>
  );
}
