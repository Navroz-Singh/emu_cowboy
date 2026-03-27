import { memo } from "react";
import Image from "next/image";

function GameCarouselIconComponent({ title, src, isSelected, onSelect }) {
  return (
    <button
      className="flex shrink-0 snap-center flex-col items-center gap-1 transition-transform duration-150 hover:-translate-y-0.5"
      onClick={onSelect}
      type="button"
    >
      <span
        className={[
          "arcade-border relative h-11 w-11 overflow-hidden rounded-md bg-(--cabinet-tan) md:h-14 md:w-14",
          isSelected ? "glow-gold" : "",
        ].join(" ")}
      >
        <Image alt={title} className="h-full w-full object-cover" height={56} src={src} width={56} />
      </span>
      <span className="max-w-20 truncate text-[8px] text-foreground md:max-w-none md:text-[9px]">{title}</span>
    </button>
  );
}

const GameCarouselIcon = memo(GameCarouselIconComponent);

export default GameCarouselIcon;
