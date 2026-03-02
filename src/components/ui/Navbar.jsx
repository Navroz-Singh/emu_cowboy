"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { useArcadeStore } from "@/store/arcadeStore";
import { AVATARS } from "@/utils/constants";
import { TAB_LIST } from "@/utils/constants";

function NavbarComponent({ user }) {
  const router = useRouter();
  const activeTab = useArcadeStore((state) => state.activeTab);
  const setActiveTab = useArcadeStore((state) => state.setActiveTab);
  const openAuthModal = useArcadeStore((state) => state.openAuthModal);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleAuthAction = async () => {
    if (isAuthLoading) return;

    setIsAuthLoading(true);

    if (!user) {
      openAuthModal("login");
      window.setTimeout(() => setIsAuthLoading(false), 150);
      return;
    }

    try {
      await authClient.signOut();
      router.refresh();
    } finally {
      setIsAuthLoading(false);
    }
  };

  return (
    <header className="arcade-border flex items-center justify-between bg-[var(--cabinet-tan)]/60 p-2">
      <nav className="flex items-end gap-1 text-[10px] md:text-[11px]">
        {TAB_LIST.map((tab) => {
          const isActive = tab.key === activeTab;

          return (
            <button
              key={tab.key}
              className={[
                "rounded-t-md border-[3px] border-transparent px-2 py-2 leading-none transition-colors",
                isActive
                  ? "border-[var(--border-brown)] border-b-0 bg-[var(--cabinet-tan)] text-[var(--border-brown)]"
                  : "text-[var(--border-brown)]/80 hover:bg-[var(--cabinet-tan)]/40",
              ].join(" ")}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 text-[10px]">
        <div className="arcade-border relative h-8 w-8 overflow-hidden bg-[var(--cabinet-tan)]">
          <Image alt={user?.name ?? "Avatar"} className="object-cover" fill src={user?.image || AVATARS[0]} />
        </div>
        <span className="hidden md:inline">{user?.name ?? "USER123"}</span>
        <button
          className={[
            "rounded-full border-2 border-[var(--border-brown)] bg-[var(--cabinet-tan)] px-3 py-1 text-[var(--border-brown)]",
            isAuthLoading ? "loading-blink" : "",
          ].join(" ")}
          disabled={isAuthLoading}
          onClick={handleAuthAction}
          type="button"
        >
          {isAuthLoading ? (user ? "LOGGING OUT..." : "OPENING...") : user ? "LOGOUT" : "LOGIN"}
        </button>
      </div>
    </header>
  );
}

const Navbar = memo(NavbarComponent);

export default Navbar;
