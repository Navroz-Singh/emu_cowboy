"use client";

import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";
import { useArcadeStore } from "@/store/arcadeStore";

export default function AuthModal() {
  const isAuthModalOpen = useArcadeStore((state) => state.isAuthModalOpen);
  const authMode = useArcadeStore((state) => state.authMode);
  const closeAuthModal = useArcadeStore((state) => state.closeAuthModal);

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/45 p-4">
      <div className="arcade-border max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto bg-[var(--cabinet-tan)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="saloon-title text-lg text-[var(--title-red)] md:text-2xl">
            {authMode === "register" ? "REGISTER" : "LOGIN"}
          </h3>
          <button
            className="rounded border-2 border-[var(--border-brown)] bg-[var(--screen-bg)] px-2 py-1 text-[9px]"
            onClick={closeAuthModal}
            type="button"
          >
            CLOSE
          </button>
        </div>

        {authMode === "register" ? <RegisterForm /> : <LoginForm />}
      </div>
    </div>
  );
}
