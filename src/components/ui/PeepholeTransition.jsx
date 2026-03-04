"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function PeepholeTransition({ gameId, children, disabled = false, className = "", onClick }) {
  const router = useRouter();
  const [isAnimating, setIsAnimating] = useState(false);
  const [origin, setOrigin] = useState({ x: "50%", y: "50%" });

  const clipPath = useMemo(
    () => (isAnimating ? `circle(150% at ${origin.x} ${origin.y})` : `circle(0% at ${origin.x} ${origin.y})`),
    [isAnimating, origin.x, origin.y],
  );

  const handleStart = (event) => {
    if (disabled || isAnimating) return;

    if (typeof onClick === "function") {
      onClick(event);
    }

    const x = `${Math.round(event.clientX)}px`;
    const y = `${Math.round(event.clientY)}px`;

    setOrigin({ x, y });
    setIsAnimating(true);

    window.setTimeout(() => {
      router.push(`/play/${gameId}`);
    }, 600);
  };

  return (
    <>
      <button className={className} disabled={disabled || isAnimating} onClick={handleStart} type="button">
        {children}
      </button>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-130 bg-foreground transition-[clip-path] duration-600 ease-out"
        style={{ clipPath }}
      />
    </>
  );
}
