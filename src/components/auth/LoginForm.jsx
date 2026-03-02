"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { migrateLocalDataToServer } from "@/lib/persistence";
import { useArcadeStore } from "@/store/arcadeStore";

export default function LoginForm() {
  const router = useRouter();
  const closeAuthModal = useArcadeStore((state) => state.closeAuthModal);
  const setAuthMode = useArcadeStore((state) => state.setAuthMode);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    const { data, error } = await authClient.signIn.email({
      email,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message || "Unable to sign in.");
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
        <label className="text-[10px] md:text-xs" htmlFor="email">EMAIL</label>
        <input
          className="arcade-border w-full bg-[var(--screen-bg)] px-2 py-2 text-[10px] md:text-xs"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] md:text-xs" htmlFor="password">PASSWORD</label>
        <input
          className="arcade-border w-full bg-[var(--screen-bg)] px-2 py-2 text-[10px] md:text-xs"
          id="password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
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
        {isSubmitting ? "SIGNING IN..." : "SIGN IN"}
      </button>

      <button
        className="w-full text-[9px] text-[var(--border-brown)]/80 underline md:text-[10px]"
        disabled={isSubmitting}
        onClick={() => setAuthMode("register")}
        type="button"
      >
        NEED AN ACCOUNT? REGISTER
      </button>
    </form>
  );
}
