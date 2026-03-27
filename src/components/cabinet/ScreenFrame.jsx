import GameCarousel from "@/components/ui/GameCarousel";
import Navbar from "@/components/ui/Navbar";

export default function ScreenFrame({ user, children }) {
  return (
    <div className="h-full w-full overflow-hidden rounded-xl border-5 border-foreground bg-background p-1 shadow-[0_0_0_3px_var(--border-inner)_inset] md:rounded-2xl md:border-8 md:p-2">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-340 flex-col gap-1.5 rounded-lg border-3 border-foreground bg-background p-1.5 md:gap-2 md:rounded-xl md:border-4 md:p-2">
        <Navbar user={user} />
        <div
          className="arcade-border min-h-0 flex-1 overflow-y-scroll overflow-x-hidden bg-background p-2 md:p-4"
          style={{ scrollbarGutter: "stable both-edges" }}
        >
          {children}
        </div>
        <GameCarousel />
      </div>
    </div>
  );
}
