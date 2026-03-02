import GameCarousel from "@/components/ui/GameCarousel";
import Navbar from "@/components/ui/Navbar";

export default function ScreenFrame({ user, children }) {
  return (
    <div className="h-full w-full overflow-hidden rounded-2xl border-[8px] border-[var(--border-brown)] bg-[var(--screen-bg)] p-1.5 shadow-[0_0_0_3px_var(--border-inner)_inset] md:p-2">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1360px] flex-col gap-1.5 rounded-xl border-[4px] border-[var(--border-brown)] bg-[var(--screen-bg)] p-1.5 md:gap-2 md:p-2">
        <Navbar user={user} />
        <div className="arcade-border min-h-0 flex-1 overflow-y-auto overflow-x-auto bg-[var(--screen-bg)] p-2 md:p-4">{children}</div>
        <GameCarousel />
      </div>
    </div>
  );
}
