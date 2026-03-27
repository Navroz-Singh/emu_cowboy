import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GAME_REGISTRY } from "@/games/registry";

const MOBILE_CONTROLS = [
  { input: "SWIPE LEFT", result: "MOVE TO LEFT LANE" },
  { input: "SWIPE RIGHT", result: "MOVE TO RIGHT LANE" },
  { input: "SWIPE UP", result: "JUMP" },
  { input: "TAP", result: "SHOOT" },
  { input: "DOUBLE TAP (RABBIT MOMENT)", result: "LASSO" },
];

const DESKTOP_CONTROLS = [
  { input: "A OR LEFT ARROW", result: "MOVE LEFT" },
  { input: "D OR RIGHT ARROW", result: "MOVE RIGHT" },
  { input: "SPACE OR UP ARROW", result: "JUMP" },
  { input: "F", result: "SHOOT" },
  { input: "E", result: "LASSO" },
];

function SpriteSheetFrame({ sprite, alt, className = "h-full w-full" }) {
  const frame = Number(sprite.frame || 0);
  const columns = Number(sprite.columns || 1);
  const rows = Number(sprite.rows || 1);
  const colIndex = frame % columns;
  const rowIndex = Math.floor(frame / columns);
  const xPercent = columns > 1 ? (colIndex / (columns - 1)) * 100 : 0;
  const yPercent = rows > 1 ? (rowIndex / (rows - 1)) * 100 : 0;

  return (
    <div
      aria-label={alt}
      className={className}
      role="img"
      style={{
        backgroundImage: `url(${sprite.src})`,
        backgroundPosition: `${xPercent}% ${yPercent}%`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${columns * 100}% ${rows * 100}%`,
        imageRendering: "pixelated",
      }}
    />
  );
}

const DUSTBOWL_ACTION_GUIDE = [
  {
    title: "CACTUS",
    action: "JUMP OR EVADE",
    note: "Ground hazard. Keep your timing clean.",
    sprite: { src: "/sprites/obstacles.png", frame: 0, columns: 4, rows: 1 },
  },
  {
    title: "BISON SKULL",
    action: "JUMP OR EVADE",
    note: "Low obstacle that punishes late reactions.",
    sprite: { src: "/sprites/bison_totem.png", frame: 0, columns: 2, rows: 1 },
  },
  {
    title: "SIGN",
    action: "EVADE",
    note: "Tall blocker. Lane change is safest.",
    sprite: { src: "/sprites/obstacles.png", frame: 2, columns: 4, rows: 1 },
  },
  {
    title: "TOTEM",
    action: "EVADE",
    note: "Tall lane blocker. Stay mobile.",
    sprite: { src: "/sprites/bison_totem.png", frame: 1, columns: 2, rows: 1 },
  },
  {
    title: "BARREL",
    action: "EVADE OR SHOOT",
    note: "Either route around it or blast it.",
    sprite: { src: "/sprites/obstacles.png", frame: 1, columns: 4, rows: 1 },
  },
  {
    title: "ROCK BANDIT",
    action: "SHOOT IN TIME OR EVADE",
    note: "If ignored too long, it fires back.",
    sprite: { src: "/sprites/rock_bandit.png", frame: 2, columns: 5, rows: 1 },
  },
  {
    title: "QUICKSAND",
    action: "JUMP OVER",
    note: "Landing in it slows your run badly.",
    sprite: { src: "/sprites/quicksand.png", frame: 1, columns: 3, rows: 1 },
  },
  {
    title: "TUMBLEWEED",
    action: "JUMP OR EVADE",
    note: "Moving hazard that can drift across lanes.",
    sprite: { src: "/sprites/obstacles.png", frame: 3, columns: 4, rows: 1 },
  },
];

export default async function HowToGamePage({ params }) {
  const { gameId } = await params;
  const cartridge = GAME_REGISTRY[gameId];

  if (!cartridge) return notFound();

  if (gameId !== "dustbowl-dash") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-(--cabinet-tan) p-4 text-(--foreground)">
        <div className="arcade-border w-full max-w-xl bg-(--cabinet-tan)/45 p-5 text-center md:p-6">
          <h1 className="saloon-title text-2xl text-(--title-red) md:text-4xl">HOW TO PLAY</h1>
          <p className="mt-3 text-[10px] leading-6 md:text-xs">GUIDE FOR {cartridge.title.toUpperCase()} IS COMING SOON.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link className="pixel-button px-4 py-2 text-[10px] md:text-xs" href="/">
              BACK TO ARCADE
            </Link>
            <Link className="arcade-border bg-background px-4 py-2 text-[10px] md:text-xs" href={`/play/${gameId}`}>
              START GAME
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-(--cabinet-tan) p-3 text-(--foreground) md:p-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:gap-4">
        <section className="arcade-border bg-(--cabinet-tan)/55 p-4 md:p-5">
          <p className="text-[9px] text-(--border-brown)/80 md:text-[10px]">DUSTBOWL DASH</p>
          <h1 className="saloon-title text-2xl leading-tight text-(--title-red) md:text-5xl">HOW TO PLAY</h1>
          <p className="mt-3 text-[10px] leading-6 md:text-xs">RIDE HARD, DODGE SMART, SHOOT FAST, AND SURVIVE EACH SPECIAL EVENT.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link className="pixel-button px-4 py-2 text-[10px] md:text-xs" href="/">
              BACK TO ARCADE
            </Link>
            <Link className="arcade-border bg-background px-4 py-2 text-[10px] md:text-xs" href="/play/dustbowl-dash">
              START RUN
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <article className="arcade-border bg-(--cabinet-tan)/35 p-3 md:p-4">
            <h2 className="saloon-title text-xl text-(--title-red) md:text-3xl">MOBILE CONTROLS</h2>
            <p className="mt-2 text-[9px] italic text-(--border-brown)/80 md:text-[10px]">INPUT TO ACTION</p>
            <div className="mt-3 space-y-2">
              {MOBILE_CONTROLS.map((control) => (
                <div key={control.input} className="arcade-border flex items-center justify-between gap-2 bg-background/65 px-2 py-1.5">
                  <span className="text-[9px] font-bold text-(--title-red) md:text-[10px]">{control.input}</span>
                  <span className="text-[9px] font-semibold md:text-[10px]">{control.result}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="arcade-border bg-(--cabinet-tan)/35 p-3 md:p-4">
            <h2 className="saloon-title text-xl text-(--title-red) md:text-3xl">DESKTOP CONTROLS</h2>
            <p className="mt-2 text-[9px] italic text-(--border-brown)/80 md:text-[10px]">KEY TO ACTION</p>
            <div className="mt-3 space-y-2">
              {DESKTOP_CONTROLS.map((control) => (
                <div key={control.input} className="arcade-border flex items-center justify-between gap-2 bg-background/65 px-2 py-1.5">
                  <span className="text-[9px] font-bold text-(--title-red) md:text-[10px]">{control.input}</span>
                  <span className="text-[9px] font-semibold md:text-[10px]">{control.result}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="arcade-border bg-(--cabinet-tan)/35 p-3 md:p-4">
          <h2 className="saloon-title text-xl text-(--title-red) md:text-3xl">OBSTACLE GUIDE</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {DUSTBOWL_ACTION_GUIDE.map((entry) => (
              <div key={entry.title} className="arcade-border bg-background/65 p-3">
                <div className="flex items-start gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-(--cabinet-tan)/35 md:h-16 md:w-16">
                    <SpriteSheetFrame alt={entry.title} className="h-full w-full" sprite={entry.sprite} />
                  </div>
                  <div>
                    <p className="text-[10px] text-(--title-red) md:text-xs">{entry.title}</p>
                    <p className="mt-1 text-[10px] md:text-xs">BEST MOVE: {entry.action}</p>
                    <p className="mt-1 text-[9px] text-(--border-brown)/80 md:text-[10px]">{entry.note}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <article className="arcade-border bg-(--cabinet-tan)/35 p-3 md:p-4">
            <h3 className="saloon-title text-lg text-(--title-red) md:text-2xl">RABBIT EVENT</h3>
            <div className="mt-2 flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 rounded bg-background/65">
                <SpriteSheetFrame
                  alt="Rabbit"
                  className="h-full w-full"
                  sprite={{ src: "/sprites/rabbit.png", frame: 1, columns: 3, rows: 1 }}
                />
              </div>
              <div className="relative h-16 w-16 shrink-0 rounded bg-background/65">
                <SpriteSheetFrame
                  alt="Lasso action"
                  className="h-full w-full"
                  sprite={{ src: "/sprites/cowboy_actions.png", frame: 2, columns: 3, rows: 1 }}
                />
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-6 md:text-xs">
              RABBITS APPEAR FOR A SHORT WINDOW. USE LASSO QUICKLY TO SECURE BONUS REWARDS.
            </p>
          </article>

          <article className="arcade-border bg-(--cabinet-tan)/35 p-3 md:p-4">
            <h3 className="saloon-title text-lg text-(--title-red) md:text-2xl">TRAIN HEIST</h3>
            <div className="mt-2 flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 rounded bg-background/65">
                <SpriteSheetFrame
                  alt="Train"
                  className="h-full w-full"
                  sprite={{ src: "/sprites/train_kit_rev.png", frame: 1, columns: 3, rows: 1 }}
                />
              </div>
              <div className="relative h-16 w-16 shrink-0 rounded bg-background/65">
                <SpriteSheetFrame
                  alt="Jump to train"
                  className="h-full w-full"
                  sprite={{ src: "/sprites/cowboy_jump_to_train.png", frame: 1, columns: 2, rows: 1 }}
                />
              </div>
              <div className="relative h-16 w-16 shrink-0 rounded bg-background/65">
                <SpriteSheetFrame
                  alt="Jump to horse"
                  className="h-full w-full"
                  sprite={{ src: "/sprites/cowboy_jump_to_horse.png", frame: 1, columns: 2, rows: 1 }}
                />
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-6 md:text-xs">
              TIMING IS EVERYTHING. TAP JUMP TO TRANSITION AT HEIST START, THEN JUMP AGAIN NEAR THE END TO RETURN BEFORE IT
              IS TOO LATE.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}