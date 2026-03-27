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
    <header className="arcade-border flex flex-col gap-2 bg-(--cabinet-tan)/60 p-2 md:flex-row md:items-center md:justify-between">
      <nav className="flex w-full items-end gap-1 overflow-x-auto pb-1 text-[9px] md:w-auto md:pb-0 md:text-[11px]">
        {TAB_LIST.map((tab) => {
          const isActive = tab.key === activeTab;

          return (
            <button
              key={tab.key}
              className={[
                "shrink-0 rounded-t-md border-[3px] border-transparent px-2 py-1.5 leading-none transition-colors md:py-2",
                isActive
                  ? "border-foreground border-b-0 bg-(--cabinet-tan) text-foreground"
                  : "text-(--border-brown)/80 hover:bg-(--cabinet-tan)/40",
              ].join(" ")}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="flex w-full items-center justify-between gap-2 text-[9px] md:w-auto md:justify-end md:text-[10px]">
        <div className="arcade-border relative h-8 w-8 overflow-hidden bg-(--cabinet-tan)">
          <Image alt={user?.name ?? "Avatar"} className="object-cover" fill src={user?.image || AVATARS[0]} />
        </div>
        <span className="max-w-24 truncate text-[9px] md:max-w-none md:text-[10px]">{user?.name ?? "USER123"}</span>
        <button
          className={[
            "rounded-full border-2 border-foreground bg-(--cabinet-tan) px-3 py-1 text-foreground",
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
