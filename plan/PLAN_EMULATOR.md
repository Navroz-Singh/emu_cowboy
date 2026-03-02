# PLAN_EMULATOR.md — Nexus Arcade Platform (Emulator Shell)

> **This document covers the emulator platform only — the arcade cabinet UI, authentication, database, API routes, and frontend shell.**
> For game-specific plans, see [PLAN_DUSTBOWL_DASH.md](PLAN_DUSTBOWL_DASH.md).
> For the integration contract between emulator and games, see [PLAN_BRIDGE.md](PLAN_BRIDGE.md).

---

## 0. Platform Overview

**Nexus Arcade** is a modular web-based "emulator platform" that hosts multiple HTML5/WebGL games ("cartridges"). Each game is a self-contained Phaser 3 module that plugs into the emulator shell via a standardized bridge contract (see PLAN_BRIDGE.md).

The platform is built with:
- **Next.js (App Router)** — pages, API routes, SSR for auth-dependent pages
- **PostgreSQL (Prisma Postgres)** — Prisma's own hosted PostgreSQL database with JSONB for flexible game saves
- **Prisma** — type-safe ORM and migrations
- **Better Auth** — session-based authentication (username/email + password only, NO social/OAuth providers)
- **Zustand** — lightweight client state management for HUD/overlay
- **Tailwind CSS v4** — styling (already installed)
- **Vercel** — hosting, edge functions, `x-vercel-ip-country` header for geo leaderboards
- **pnpm** — package manager (all commands use `pnpm`, never `npm` or `yarn`)

**Language:** JavaScript (ES6+) only. No TypeScript.

**Current state:** Fresh `create-next-app` scaffold (Next.js 16.1.6, React 19.2.3, Tailwind CSS 4).

**SSR Strategy:** Pages/components that display user details (Navbar user cluster, Profile view, leaderboard "your row" highlight) use **Server-Side Rendering** via `auth.api.getSession()` in Server Components. This ensures zero-latency rendering of auth state — no flash of "LOGIN" before session loads. Client components that need session use `authClient.useSession()` only when SSR is not feasible (e.g., inside modals, event handlers).

**Guest Persistence Strategy:** When a user is **not logged in**, all user-facing data (scores, high scores, preferences) is persisted to `localStorage`. When logged in, data is saved to the database via API routes. The persistence adapter (see PLAN_BRIDGE.md §2) abstracts this — callers never know which backend is active.

---

## 1. VISUAL DESIGN SPECIFICATION

### 1.1 Global Aesthetic

**Retro 16-bit pixel art.** The entire UI is designed to look like the screen of a physical sci-fi / desert-themed arcade cabinet. Everything inside the browser viewport simulates an arcade machine — the outer "cabinet casing" frames an inner "CRT screen."

### 1.2 Typography

| Usage | Font | Style |
|---|---|---|
| **Body / UI text** | `"Press Start 2P"` (Google Font) — monospaced pixel-art | ALL CAPS for nav/headers, mixed case for body text |
| **Display / Title text** | `"Rye"` (Google Font) — decorative thick pixel-art with Wild West saloon vibe (thick vertical stems, small serifs) | Used for game titles only |

Both fonts loaded via `next/font/google`.

### 1.3 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--cabinet-tan` | `#E2BA8C` | Cabinet exterior, inactive tab backgrounds |
| `--screen-bg` | `#F4DFB8` | Main screen background (warm beige/cream) |
| `--border-brown` | `#4A2E15` | All borders, standard text color |
| `--accent-gold` | `#F3A726` | Active glows, primary buttons, highlights |
| `--title-red` | `#C94A38` | Display titles (game names in saloon font) |
| `--border-inner` | `#F9F0DC` | Inner border (1-2px lighter cream for depth inset) |

### 1.4 Border Treatment

All UI containers within the screen use a **double-border inset** effect:
1. Thick dark brown outer border (`--border-brown`, ~3px)
2. Immediately followed by 1-2px lighter cream inner border (`--border-inner`)
3. Gently rounded corners (`border-radius: 8px`)

Implementation:
```css
.arcade-border {
  border: 3px solid var(--border-brown);
  box-shadow: inset 0 0 0 2px var(--border-inner);
  border-radius: 8px;
}
```

### 1.5 Global Layout Architecture

The UI is contained within a **fixed 16:9 aspect-ratio container**, centered in the viewport.

**The Outer Cabinet:**
- The entire `<body>` background acts as the physical machine casing
- Solid tan (`--cabinet-tan`) with etched horizontal tech lines and screw/rivet details (CSS pseudo-elements or subtle repeating background)
- Bottom-right corner: a glowing white four-pointed sparkle/star icon (CSS or inline SVG)

**The Main Screen:**
- Centered in the cabinet
- Very thick dark brown border with rounded corners
- Interior background: `--screen-bg` (warm beige/cream)

**Inside the Screen — Three Vertical Sections:**
1. **Top Navigation Bar** — horizontal flex container
2. **Main Content Area** — large dynamic container (tab-driven content)
3. **Bottom Game Carousel** — horizontal strip of game icons

---

## 2. PERSISTENT UI ELEMENTS (Present on all screens)

### 2.1 Top Navigation Bar

**Component: `src/components/ui/Navbar.jsx`**

| Position | Content |
|---|---|
| Left | Four text tab links in a row: `ALL GAMES`, `LEADERBOARDS`, `COMMUNITY`, `PROFILE` |
| Right | User profile cluster: small square pixel-art avatar + username text (`"User123"`) + pill-shaped `LOGIN` button (tan bg, brown text/border) |

**Active Tab Behavior:**
- The active tab has a solid, slightly darker tan background block with rounded top corners
- The background connects **seamlessly** to the main content area below (no bottom border on active tab — merges visually)
- Inactive tabs: plain dark brown text, no background

**State management:** `activeTab` is stored in Zustand `arcadeStore`. The tab controls which view renders in the Main Content Area. This is **client-side tab switching**, NOT separate routes (except `/play/[gameId]` which is a separate page for the actual game).

**SSR for user cluster:** The Navbar receives user session data as a prop from a Server Component parent (see Step 5.7). The user profile cluster (avatar, username, login button) renders with zero-latency because session is resolved server-side.

### 2.2 Bottom Game Carousel

**Component: `src/components/ui/GameCarousel.jsx`**

- Wide rectangular container with standard `arcade-border`
- Contains **5 perfectly square game icons** spaced evenly horizontally
- Each icon:
  - Rounded dark brown border
  - Small title text below in dark brown
  - **Active state:** The currently selected game has a thick bright yellow/orange glowing halo (`box-shadow: 0 0 12px 4px var(--accent-gold)`)

**Icons (Left to Right):**

| # | Game | Icon Description |
|---|---|---|
| 1 | Dustbowl Dash | Cowboy on a horse |
| 2 | Pong MainScene | Top-down pong paddle and ball |
| 3 | Pixel Fistfight | Two boxers |
| 4 | Space Invaders | Classic alien ship |
| 5 | Debug Platformer | Platformer guy jumping |

Selecting a game in the carousel updates the Main Content Area to show that game's info. The carousel is persistent across all tabs.

---

## 3. VIEW-SPECIFIC CONTENT AREAS (Tab Content)

### 3.1 View: ALL GAMES

**Layout:** Two-column split — Left ~45%, Right ~55%.

**Left Column:**
- Large hero image of the currently selected game (from carousel)
- Standard `arcade-border`
- For Dustbowl Dash: pixel-art cowboy on horse, swinging lasso at rabbit, desert landscape

**Right Column — Vertically stacked:**
1. **Title:** `"DUSTBOWL DASH"` in large red saloon font (`--title-red`, Rye font)
2. **Description:** 2 lines of pixel text: _"Infinite runner in the wild west. Go the distance and lasso rabbits!"_
3. **CTA Button:** Massive full-width button
   - Yellow/orange gradient background (`--accent-gold`)
   - Thick dark brown border
   - Text: `"START / INSERT COIN"` in white with dark drop-shadow
   - On click → peephole transition → navigate to `/play/[gameId]`
4. **Leaderboard Snippet:** Smaller boxed area below button
   - Header: `"GLOBAL LEADERS"`
   - Ranks 1–3 with Name (left-justified) and Score (right-justified)
   - Standard `arcade-border`

### 3.2 View: LEADERBOARDS

**Layout:** Two-column split — Left ~30%, Right ~70%.

**Left Column:**
- Scaled-down hero image of selected game, pushed to top

**Right Column — Dense data table:**
1. **Header:** `"GLOBAL LEADERBOARDS - DUSTBOWL DASH"` in red saloon font
2. **Filters row:** Two pill-shaped dropdowns side-by-side
   - `FILTER: [Country dropdown]`
   - `SORT: [Sort order dropdown]`
3. **Table columns:** `RANK`, `PLAYER`, `SCORE`, `DATE`, `COUNTRY`
4. **Table rows:** 15 rows visible (scrollable if more)
   - Ranks 1, 2, 3 get tiny pixel-art medals (Gold, Silver, Bronze)
   - Current user's row highlighted with solid yellow outline + glowing yellow background tint
   - Guest user's local high score shown at bottom of table with "GUEST" label (fetched from localStorage)
   - Country column has tiny pixel-art national flags
5. Standard `arcade-border` on the table container

### 3.3 View: COMMUNITY

**Layout:** Three-column grid of equal width.

**Column 1 — FORUM DISCUSSIONS:**
- Three vertical list items: square icon (left) + text (right)
- Bottom: centered orange pill button — `"NEW POST"`

**Column 2 — TOP COMMUNITY CREATIONS:**
- Same format
- Bottom: orange pill button — `"VIEW ALL"`

**Column 3 — PLATFORM EVENTS:**
- Same format
- Bottom: orange pill button — `"VIEW CALENDAR"`

> Note: Community and Events are **static/placeholder** for MVP. No backend wiring needed yet. The UI must be pixel-perfect but content can be hardcoded.

### 3.4 View: PROFILE

**Layout:** Three-column layout — approx 35% / 25% / 40%.

**Column 1 — Identity:**
- Large square high-detail pixel-art avatar
- Username, member-since date, region with flag

**Column 2 — PLAYER STATS:**
- `TOTAL SCORE`, `GAMES PLAYED`, `TOTAL TIME PLAYED`, `MOST PLAYED GAME`
- Values appear directly below labels

**Column 3 — RECENT ACHIEVEMENTS:**
- 2×2 grid of badge icons: Pong Master, Dustbowl Veteran, Fistfight Champion, 10k Score Club

**Guest vs Logged-In behavior:**
- **Logged in:** SSR-fetched user data + server stats. Achievements hardcoded for MVP.
- **Guest (not logged in):** Show "GUEST" identity card with **local** stats from `localStorage` (total local score across games, games played locally). A prominent `"LOG IN TO SAVE YOUR PROGRESS"` banner replaces the identity section.

---

## 4. REACT PERFORMANCE & CODE QUALITY STANDARDS

### 4.1 React Performance Hooks

| Hook | When to Use |
|---|---|
| `useMemo` | Computed values, filtered/sorted data, expensive calculations, processed props. Use extensively. |
| `React.memo` | Components that re-render frequently but whose props rarely change (GameCard, LeaderboardRow, CarouselIcon). |
| `useCallback` | Event handlers passed as props to memoized children. |
| `useRef` | DOM references, Phaser game instance, mutable values that must NOT trigger re-renders. |

### 4.2 Performance Best Practices

| Practice | Implementation |
|---|---|
| **Dependency arrays** | Carefully manage `useEffect` / `useMemo` / `useCallback` deps. Never omit deps; never include entire objects when only a primitive is needed. |
| **Parallel API calls** | Use `Promise.all()` for concurrent DB operations. |
| **Lazy loading** | `next/dynamic` with `{ ssr: false }` for Phaser. `React.lazy()` for heavy modals, leaderboard table. `next/image` with `loading="lazy"` for thumbnails. |
| **Debounced inputs** | Apply 300ms debounce on search inputs, filter dropdowns, form validation. |
| **Optimistic updates** | Provide immediate UI feedback before API response confirms. Roll back on error. |
| **Event throttling** | Throttle `SCORE_UPDATED` EventBus emissions to every ~500ms. Do NOT emit every frame. |

### 4.3 Code Readability & Maintainability

| Rule | Detail |
|---|---|
| **Self-documenting code** | Use clear, descriptive variable and function names. |
| **Single-purpose functions** | Each function does one thing. No multi-responsibility monsters. |
| **Consistent patterns** | All API routes follow the same auth-check → validate → DB call → response pattern. |
| **Comment strategy** | JSDoc-style comments for complex business logic ONLY. No `// increment i` noise. |
| **Component size** | Max 300 lines per component. Extract sub-components when exceeded. |

### 4.4 Code Organization

| Area | Convention |
|---|---|
| **Import ordering** | 1) React hooks / Next.js builtins → 2) External libraries → 3) Internal components → 4) Utilities / constants → 5) Styles |
| **Component structure** | state declarations → `useEffect` hooks → event handlers → helper functions → `return` (JSX) |
| **File naming** | PascalCase for components (`GameCard.jsx`), camelCase for utilities (`eventBus.js`), camelCase for stores (`emulatorStore.js`) |
| **Folder structure** | `components/` (UI), `games/` (Phaser — each game is standalone), `lib/` (singletons/config), `store/` (Zustand), `app/api/` (routes) |

### 4.5 Debugging Protocol

1. **Always check official docs first** before making any claims about deprecated code or API changes.
2. **Ask for specific error details** and debug systematically — never shotgun-fix.
3. **Respect existing implementations** — suggest minimal, targeted fixes.
4. **Verify casing and naming consistency** as a first debugging step.
5. **Must follow the latest documentation** for all libraries (Next.js 16, React 19, Prisma 5, Better Auth 1.x).

---

## PHASE 1: Project Foundation & Environment Setup

### Step 1.1 — Install All Dependencies

> **All commands use `pnpm`.** Never use `npm`, `npx`, or `yarn`.

**Production dependencies:**
| Package | Purpose |
|---|---|
| `@prisma/client` | Prisma runtime client |
| `better-auth` | Authentication library |
| `zustand` | Lightweight state management |

**Dev dependencies:**
| Package | Purpose |
|---|---|
| `prisma` | Schema management & migrations CLI |

**Command:**
```bash
pnpm add @prisma/client better-auth zustand
pnpm add -D prisma
```

> Note: `phaser` is listed in PLAN_BRIDGE.md as a bridge-level dependency. Install it there.

### Step 1.2 — Initialize Prisma

```bash
pnpm exec prisma init
```

Creates `prisma/schema.prisma` and `.env` with `DATABASE_URL` placeholder.

### Step 1.3 — Configure Environment Variables

Create/update `.env` (gitignored):
```env
# Prisma Postgres (Prisma's hosted PostgreSQL — get URL from Prisma Data Platform)
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"

# Better Auth
BETTER_AUTH_SECRET="generate-a-random-32-char-string"
BETTER_AUTH_URL="http://localhost:3000"

# Public (exposed to client)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

> **No Supabase.** We use Prisma Postgres — Prisma's own managed PostgreSQL. Obtain the connection URL from the Prisma Data Platform dashboard (console.prisma.io).

### Step 1.4 — Verify `jsconfig.json` Path Aliases

Ensure `@/` alias resolves to `src/`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Step 1.5 — Create Base Folder Structure (Emulator Only)

```
src/
├── app/
│   ├── globals.css                 (global styles, CSS vars, arcade theme)
│   ├── layout.js                   (root layout — fonts, metadata, CabinetShell)
│   ├── page.js                     (main arcade screen — SSR shell with client tabs)
│   ├── play/
│   │   └── [gameId]/
│   │       └── page.js             (dynamic emulator route — separate page)
│   └── api/
│       ├── auth/
│       │   └── [...all]/
│       │       └── route.js        (Better Auth catch-all handler)
│       └── v1/
│           ├── scores/
│           │   └── [gameId]/
│           │       └── route.js    (GET leaderboard, POST new score)
│           └── saves/
│               └── [gameId]/
│                   └── route.js    (POST upsert save, GET load save)
├── components/
│   ├── cabinet/
│   │   ├── CabinetShell.jsx        (outer cabinet casing with etched lines)
│   │   └── ScreenFrame.jsx         (inner thick-bordered screen container)
│   ├── ui/
│   │   ├── Navbar.jsx               (top nav tabs + user profile cluster)
│   │   ├── GameCarousel.jsx          (bottom game icon strip)
│   │   ├── GameCarouselIcon.jsx      (single icon — React.memo'd)
│   │   ├── PeepholeTransition.jsx    (click-to-play peephole animation)
│   │   └── ArcadeBorder.jsx          (reusable double-border wrapper)
│   ├── views/
│   │   ├── AllGamesView.jsx
│   │   ├── LeaderboardsView.jsx
│   │   ├── CommunityView.jsx
│   │   └── ProfileView.jsx
│   ├── leaderboard/
│   │   ├── LeaderboardTable.jsx
│   │   ├── LeaderboardRow.jsx
│   │   └── LeaderboardSnippet.jsx
│   └── auth/
│       ├── LoginForm.jsx
│       └── RegisterForm.jsx
├── hooks/
│   ├── useLeaderboard.js
│   ├── useUserProfile.js
│   └── useDebounce.js
├── lib/
│   ├── prisma.js                    (PrismaClient singleton)
│   ├── auth.js                      (Better Auth server config)
│   ├── auth-client.js               (Better Auth client helper)
│   └── persistence.js               (Persistence adapter — localStorage vs DB)
├── store/
│   └── arcadeStore.js               (Zustand: activeTab, selectedGameId)
├── utils/
│   └── constants.js                 (shared constants: tab names, etc.)
prisma/
└── schema.prisma
public/
└── assets/
    ├── icons/                        (medals, flags, screw, sparkle)
    └── carousel/                     (5 square game icons)
```

> Note: `src/components/emulator/`, `src/store/emulatorStore.js`, `src/lib/eventBus.js`, and `src/games/` are defined in PLAN_BRIDGE.md and PLAN_DUSTBOWL_DASH.md respectively.

---

## PHASE 2: Database & Authentication

### Step 2.1 — Write Prisma Schema

**File: `prisma/schema.prisma`**

The full schema uses a **split-table strategy** — separating write-heavy score logs from read-heavy leaderboard data, plus a pre-aggregated stats table for instant profile loads.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==========================================
// 1. IDENTITY & AUTHENTICATION (Better Auth Strict)
// ==========================================

model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  emailVerified Boolean
  image         String?
  createdAt     DateTime
  updatedAt     DateTime

  sessions           Session[]
  accounts           Account[]
  scores             ScoreLog[]
  leaderboardEntries LeaderboardEntry[]
  gameSaves          GameSave[]
  stats              UserStat?

  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime
  updatedAt DateTime
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?   // Critical for Email/Password auth
  createdAt             DateTime
  updatedAt             DateTime

  @@map("account")
}

model Verification {
  id         String    @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime?
  updatedAt  DateTime?

  @@map("verification")
}

// ==========================================
// 2. ARCADE PLATFORM CORE
// ==========================================

// ScoreLog (WRITE HEAVY)
// Immutable audit trail of every game ever played.
// Used for: "Recent Activity", Anti-cheat analysis, History.
model ScoreLog {
  id          String   @id @default(cuid())
  userId      String
  gameId      String
  value       Int
  countryCode String   @db.Char(2)
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, gameId, createdAt(sort: Desc)])
  @@index([gameId, createdAt(sort: Desc)])
  @@map("score_log")
}

// LeaderboardEntry (READ HEAVY)
// Stores ONLY the single best score per user per game.
// This table is small (Users × Games) and blazing fast to query.
model LeaderboardEntry {
  id          String   @id @default(cuid())
  userId      String
  gameId      String
  value       Int
  countryCode String   @db.Char(2)
  achievedAt  DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, gameId])
  @@index([gameId, value(sort: Desc)])
  @@index([gameId, countryCode, value(sort: Desc)])
  @@map("leaderboard_entry")
}

// UserStat (AGGREGATION)
// Pre-calculated stats for the User Profile.
// Updated atomically via `increment` on every game end.
model UserStat {
  userId          String   @id
  totalScore      BigInt   @default(0)
  gamesPlayed     Int      @default(0)
  totalTimePlayed Int      @default(0) // In seconds
  lastPlayedGame  String?
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_stat")
}

// GameSave (PERSISTENCE)
// JSON storage for game states (checkpoints, RPG saves).
model GameSave {
  id        String   @id @default(cuid())
  userId    String
  gameId    String
  state     Json
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, gameId])
  @@map("game_save")
}
```

**Models — Design Decisions:**

| Model | Purpose | Strategy |
|---|---|---|
| **User** | Core identity | Better Auth strict fields (`emailVerified`, `image`, exact timestamps) |
| **Session** | Auth sessions | Better Auth strict (`token` unique, `ipAddress`, `userAgent`) |
| **Account** | Auth provider link | Includes `password` field critical for email/password auth |
| **Verification** | Email verification tokens | Better Auth strict |
| **ScoreLog** | Immutable audit trail of every game played | **Write-heavy** — append-only, used for history/analytics |
| **LeaderboardEntry** | Single best score per user per game | **Read-heavy** — tiny table (`Users × Games` rows), blazing fast leaderboard queries |
| **UserStat** | Pre-aggregated profile totals | **Aggregation** — atomically incremented on game end, zero-cost profile loads |
| **GameSave** | JSON storage for game checkpoints | One save slot per user per game (`@@unique`) |

**Split-Table Strategy:** `ScoreLog` accepts writes as fast as they come (history, anti-cheat). `LeaderboardEntry` stores only one row per user/game — even with 100k users this table is tiny. Leaderboard API stays under 20ms.

**BigInt Handling:** `UserStat.totalScore` is `BigInt` to prevent overflow from accumulated arcade scores. Prisma returns `BigInt` as JavaScript `BigInt` objects, which `JSON.stringify` cannot handle by default. Add a helper in `src/lib/utils.js`:
```javascript
// Allows JSON.stringify to handle BigInt
BigInt.prototype.toJSON = function() { return this.toString() }
```
Or explicitly convert when returning API responses: `totalScore: stats.totalScore.toString()`.

All models use `@@map()` to lowercase table names.

### Step 2.2 — Push Schema to Prisma Postgres

```bash
pnpm exec prisma db push
```

Use `db push` for prototyping. Switch to `pnpm exec prisma migrate dev` for production migrations.

### Step 2.3 — Create Prisma Singleton

**File: `src/lib/prisma.js`**

```javascript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
```

### Step 2.4 — Configure Better Auth (Server)

**File: `src/lib/auth.js`**

```javascript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  // NO social providers. Username/email + password ONLY.
});
```

**No Google OAuth. No social providers. Ever.**

### Step 2.5 — Configure Better Auth (Client)

**File: `src/lib/auth-client.js`**

```javascript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});
```

### Step 2.6 — Create Better Auth API Route

**File: `src/app/api/auth/[...all]/route.js`**

```javascript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### Step 2.7 — SSR Auth Helper

```javascript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Inside any Server Component or server-side function:
const session = await auth.api.getSession({ headers: await headers() });
```

Used in:
- `src/app/page.js` (pass user to Navbar as prop)
- `src/app/play/[gameId]/page.js` (pass user to SystemOverlay for score submission)
- Profile view data fetching

### Step 2.8 — Verify Auth Works

```bash
pnpm run dev
```

- Test `POST /api/auth/sign-up/email` with `{ name, email, password }`
- Confirm user row appears in Prisma Postgres (check via `pnpm exec prisma studio`)
- Test `POST /api/auth/sign-in/email` with `{ email, password }`
- Verify session cookie is set

---

## PHASE 3: Persistence Adapter (Local ↔ Database)

> This is an emulator-level concern. The adapter is consumed by the bridge layer (PLAN_BRIDGE.md) and exposed to games via EventBus.

### Step 3.1 — Create the Persistence Adapter

**File: `src/lib/persistence.js`**

This module exports functions that transparently handle **localStorage** (guest) vs **API/DB** (logged-in) persistence.

```javascript
/**
 * Persistence adapter.
 * - If `user` is provided (logged in): calls API routes (server → Prisma Postgres).
 * - If `user` is null (guest): reads/writes to localStorage.
 *
 * All functions return Promises for a uniform interface.
 */

const LOCAL_SCORES_KEY = 'nexus_arcade_scores';
const LOCAL_SAVES_KEY = 'nexus_arcade_saves';

// --- SCORES ---

export async function submitScore(gameId, value, user, timePlayed = 0) {
  if (user) {
    const res = await fetch(`/api/v1/scores/${gameId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, timePlayed }),
    });
    return res.json();
  }
  // Guest: save to localStorage (includes timePlayed for local profile stats)
  const scores = JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) || '{}');
  if (!scores[gameId]) scores[gameId] = [];
  scores[gameId].push({ value, timePlayed, date: new Date().toISOString() });
  // Keep only top 50 scores per game locally
  scores[gameId].sort((a, b) => b.value - a.value);
  scores[gameId] = scores[gameId].slice(0, 50);
  localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(scores));
  return { success: true, local: true };
}

export async function getLocalHighScore(gameId) {
  const scores = JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) || '{}');
  if (!scores[gameId] || scores[gameId].length === 0) return 0;
  return scores[gameId][0].value;
}

/**
 * Compute aggregated stats from localStorage for guest Profile view.
 * Mirrors the shape of UserStat from the database.
 */
export function getLocalStats() {
  const scores = JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) || '{}');
  let totalScore = 0;
  let gamesPlayed = 0;
  let totalTimePlayed = 0;
  let lastPlayedGame = null;
  let lastDate = null;

  for (const [gameId, entries] of Object.entries(scores)) {
    for (const entry of entries) {
      totalScore += entry.value;
      gamesPlayed += 1;
      totalTimePlayed += entry.timePlayed || 0;
      const d = new Date(entry.date);
      if (!lastDate || d > lastDate) {
        lastDate = d;
        lastPlayedGame = gameId;
      }
    }
  }

  return { totalScore, gamesPlayed, totalTimePlayed, lastPlayedGame };
}

// --- SAVES ---

export async function saveGameState(gameId, state, user) {
  if (user) {
    const res = await fetch(`/api/v1/saves/${gameId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    });
    return res.json();
  }
  // Guest: save to localStorage
  const saves = JSON.parse(localStorage.getItem(LOCAL_SAVES_KEY) || '{}');
  saves[gameId] = { state, updatedAt: new Date().toISOString() };
  localStorage.setItem(LOCAL_SAVES_KEY, JSON.stringify(saves));
  return { success: true, local: true };
}

export async function loadGameState(gameId, user) {
  if (user) {
    const res = await fetch(`/api/v1/saves/${gameId}`);
    return res.json();
  }
  // Guest: load from localStorage
  const saves = JSON.parse(localStorage.getItem(LOCAL_SAVES_KEY) || '{}');
  return saves[gameId] || { state: null };
}

// --- MIGRATION (Guest → Logged-in) ---

export async function migrateLocalDataToServer(user) {
  if (!user) return;
  
  // Migrate scores
  const scores = JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) || '{}');
  for (const [gameId, entries] of Object.entries(scores)) {
    // Submit only the best local score per game (timePlayed defaults to 0 for migrated scores)
    if (entries.length > 0) {
      await submitScore(gameId, entries[0].value, user, entries[0].timePlayed || 0);
    }
  }
  
  // Migrate saves
  const saves = JSON.parse(localStorage.getItem(LOCAL_SAVES_KEY) || '{}');
  for (const [gameId, save] of Object.entries(saves)) {
    if (save.state) {
      await saveGameState(gameId, save.state, user);
    }
  }
  
  // Clear local data after successful migration
  localStorage.removeItem(LOCAL_SCORES_KEY);
  localStorage.removeItem(LOCAL_SAVES_KEY);
}
```

### Step 3.2 — Trigger Migration on Login

When a user logs in (in `LoginForm.jsx` after successful `authClient.signIn.email()`):
1. Call `migrateLocalDataToServer(user)` in a fire-and-forget `try/catch`
2. Then `router.refresh()` to re-trigger SSR

This ensures guest progress is **never lost** when they create an account or log in.

### Step 3.3 — Profile View Local Mode

When user is a guest (not logged in), the Profile view reads from `localStorage`:
- Call `getLocalStats()` from the persistence adapter to compute `totalScore`, `gamesPlayed`, `totalTimePlayed`, `lastPlayedGame` — mirrors the `UserStat` table shape
- Display a `"LOG IN TO SAVE YOUR PROGRESS"` banner
- Local stats are labeled `"(LOCAL)"` to distinguish from server stats

---

## PHASE 4: Backend API Routes

### Step 4.1 — Score Submission & Leaderboard Endpoint

**File: `src/app/api/v1/scores/[gameId]/route.js`**

**`POST` — Submit a new score (Split-Table Write):**
1. Authenticate via `auth.api.getSession({ headers: req.headers })`
2. If no session → 401
3. Extract `gameId` from params, `{ value, timePlayed }` from request body
4. Validate `value` is a positive integer, `timePlayed` is a non-negative integer → 400 if invalid
5. Read `countryCode` from `req.headers.get('x-vercel-ip-country')` — fallback to `'XX'` for local dev
6. **Three parallel operations** via `Promise.all()`:
   - `prisma.scoreLog.create({ data: { userId, gameId, value, countryCode } })` — append to audit trail
   - `prisma.leaderboardEntry.upsert()` — update personal best **only if new score is higher**:
     ```javascript
     prisma.leaderboardEntry.upsert({
       where: { userId_gameId: { userId, gameId } },
       create: { userId, gameId, value, countryCode, achievedAt: new Date() },
       update: { /* conditionally update only when value > existing — use raw SQL UPDATE ... WHERE value < $newValue */ },
     })
     ```
   - `prisma.userStat.upsert()` — atomically increment aggregated stats:
     ```javascript
     prisma.userStat.upsert({
       where: { userId },
       create: { userId, totalScore: value, gamesPlayed: 1, totalTimePlayed: timePlayed, lastPlayedGame: gameId },
       update: {
         gamesPlayed: { increment: 1 },
         totalScore: { increment: value },
         totalTimePlayed: { increment: timePlayed },
         lastPlayedGame: gameId,
       },
     })
     ```
7. Return `{ success: true }`

**`GET` — Fetch leaderboard (from LeaderboardEntry — instant):**
1. Extract `gameId` from params
2. Read optional `?country=US` query param
3. Query `LeaderboardEntry` directly — **no raw SQL or `DISTINCT ON` needed**:
   ```javascript
   prisma.leaderboardEntry.findMany({
     where: { gameId, ...(country ? { countryCode: country } : {}) },
     orderBy: { value: 'desc' },
     take: 15,
     include: { user: { select: { name: true, image: true } } },
   })
   ```
4. Return with `Cache-Control: public, s-maxage=60, stale-while-revalidate=30`

### Step 4.2 — Save State (Memory Card) Endpoint

**File: `src/app/api/v1/saves/[gameId]/route.js`**

**`POST` — Save game state:**
1. Authenticate → 401 if no session
2. Extract `gameId` from params, `state` (JSON object) from body
3. `prisma.gameSave.upsert()` with composite unique `userId_gameId`
4. Return `{ success: true, updatedAt }`

**`GET` — Load game state:**
1. Authenticate → 401 if no session
2. `prisma.gameSave.findUnique({ where: { userId_gameId: { userId, gameId } } })`
3. Return `{ state: save.state, updatedAt }` or `{ state: null }`

---

## PHASE 5: Frontend — The Arcade Cabinet Shell

### Step 5.1 — Global Styles & CSS Variables

**File: `src/app/globals.css`**

```css
@import "tailwindcss";

:root {
  --cabinet-tan: #E2BA8C;
  --screen-bg: #F4DFB8;
  --border-brown: #4A2E15;
  --accent-gold: #F3A726;
  --title-red: #C94A38;
  --border-inner: #F9F0DC;
}

body {
  background: var(--cabinet-tan);
  margin: 0;
  overflow: hidden;
}

.arcade-border {
  border: 3px solid var(--border-brown);
  box-shadow: inset 0 0 0 2px var(--border-inner);
  border-radius: 8px;
}

.glow-gold {
  box-shadow: 0 0 12px 4px var(--accent-gold);
}
```

### Step 5.2 — Root Layout

**File: `src/app/layout.js`**

- Import `"Press Start 2P"` and `"Rye"` via `next/font/google`
- Assign CSS variables: `--font-pixel` and `--font-saloon`
- Set metadata: `title: "Nexus Arcade"`, `description: "The Dustbowl Emulator Platform"`
- `<html>` and `<body>` get the pixel font by default
- Do NOT include `<Navbar>` here — it lives inside the screen frame

### Step 5.3 — Cabinet Shell Component

**File: `src/components/cabinet/CabinetShell.jsx`**

- Outermost container, fills the viewport
- Background: `--cabinet-tan` with etched horizontal tech lines (CSS repeating-linear-gradient)
- Screw/rivet decorations in corners
- Bottom-right: glowing white four-pointed sparkle star
- Centers the `<ScreenFrame>` child

### Step 5.4 — Screen Frame Component

**File: `src/components/cabinet/ScreenFrame.jsx`**

- Fixed 16:9 aspect ratio container
- Very thick dark brown border, rounded corners
- Interior: `--screen-bg`
- Three vertical sections: Navbar → {children} → GameCarousel

### Step 5.5 — Navbar Component

**File: `src/components/ui/Navbar.jsx`**

- `'use client'` (for tab switching interactivity)
- **Receives `user` prop from Server Component parent** — NOT from `authClient.useSession()`
- 4 tab buttons from `arcadeStore`
- Active tab: darker tan background, rounded top corners, no bottom border
- Right side: user avatar + name + LOGOUT (if `user`), or LOGIN pill (if `null`)
- Login → opens auth modal. Logout → `authClient.signOut()` then `router.refresh()`
- `React.memo` the entire Navbar

### Step 5.6 — Game Carousel Component

**File: `src/components/ui/GameCarousel.jsx`**

- `'use client'`, reads `selectedGameId` from `arcadeStore`
- 5 square icons via `<GameCarouselIcon>` (React.memo'd)
- Selected icon gets `.glow-gold`

### Step 5.7 — Main Page (Arcade Screen Shell — SSR)

**File: `src/app/page.js`**

```javascript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import CabinetShell from "@/components/cabinet/CabinetShell";
import ScreenFrame from "@/components/cabinet/ScreenFrame";
import ArcadeScreenClient from "@/components/ArcadeScreenClient";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user ?? null;

  return (
    <CabinetShell>
      <ScreenFrame user={user}>
        <ArcadeScreenClient user={user} />
      </ScreenFrame>
    </CabinetShell>
  );
}
```

**`ArcadeScreenClient`** (`'use client'`):
- Reads `activeTab` from `arcadeStore`
- Renders the active view (AllGames, Leaderboards, Community, Profile)
- Passes `user` prop to views that need it

### Step 5.8 — ALL GAMES View

- Reads `selectedGameId` from `arcadeStore`
- Looks up game data from `GAME_REGISTRY` (defined in PLAN_BRIDGE.md)
- Two-column: hero image + title, description, CTA button, leaderboard snippet
- CTA → `PeepholeTransition` → `/play/[gameId]`

### Step 5.9 — LEADERBOARDS View

- Two-column: small hero image + full data table
- `useLeaderboard(gameId, { country, sort })` custom hook
- Current user row highlighted; guest local high score shown at bottom
- `useMemo` for filtered/sorted data

### Step 5.10 — COMMUNITY View

- Three-column hardcoded placeholder grid
- No backend wiring for MVP

### Step 5.11 — PROFILE View

- Three-column: identity + stats + achievements
- **Logged in:** SSR user data + `UserStat` from database (pre-aggregated: `totalScore`, `gamesPlayed`, `totalTimePlayed`, `lastPlayedGame`). Fetched server-side via `prisma.userStat.findUnique({ where: { userId } })`. `totalScore` is `BigInt` — convert to string before sending to client.
- **Guest:** Local stats from `getLocalStats()` persistence helper (mirrors `UserStat` shape), with `"LOG IN TO SAVE YOUR PROGRESS"` banner
- `useMemo` for computed stat values

### Step 5.12 — Auth Forms

**Files: `LoginForm.jsx`, `RegisterForm.jsx`**

- Modal overlay on arcade screen
- `arcade-border` styled
- Email + password only. **No Google/social login buttons.**
- On success: call `migrateLocalDataToServer(user)` → close modal → `router.refresh()`
- Debounced validation (300ms)
- Optimistic UI: disable button + spinner on submit

### Step 5.13 — Peephole Transition Component

1. Capture click coordinates → full-screen overlay
2. `clip-path: circle(0px)` → animate to `circle(150%)`
3. After ~600ms → `router.push('/play/[gameId]')`

---

## PHASE 6: Polish & Integration

### Step 6.1 — Pixel-Perfect Arcade Theme

- Cabinet etched lines (CSS repeating-linear-gradient on body)
- Screw/rivet decorations
- Sparkle icon
- Double-border treatment everywhere
- Font sizing for "Press Start 2P" (10-14px body, 8-10px table data)

### Step 6.2 — Game Over Screen (in SystemOverlay — defined in PLAN_BRIDGE.md)

When `PLAYER_DIED` fires:
- "GAME OVER" in saloon font
- Final score (large gold text)
- Guest: "PLAY AGAIN" + "LOG IN TO SAVE SCORE" buttons
- Logged in: "PLAY AGAIN" + "HOME" buttons

### Step 6.3 — Responsive Considerations

- 16:9 container scales via `max-width` + `aspect-ratio`
- `transform: scale()` for very small screens
- Touch controls: stretch goal, not MVP

### Step 6.4 — Auth Modal Integration

- Modal over arcade screen when LOGIN clicked
- Tab toggle Login / Register
- **No social buttons.**
- On success: migrate local data → close → `router.refresh()`

---

## PHASE 7: Emulator Testing & Verification

### Step 7.1 — Verify Arcade Shell
1. `pnpm run dev`
2. Cabinet exterior visible (tan background, etched lines, sparkle)
3. Screen frame centered with thick brown border
4. Navbar shows 4 tabs + login button (server-rendered — no flash)
5. Game carousel at bottom with 5 icons
6. Tabs switch views, carousel icons update selection

### Step 7.2 — Verify Views
1. ALL GAMES: hero image, title, CTA button, leaderboard snippet
2. LEADERBOARDS: data table, filters, medals, user highlight
3. COMMUNITY: 3-column hardcoded grid
4. PROFILE (guest): local stats, "LOG IN" banner
5. PROFILE (logged in): SSR user data, server stats

### Step 7.3 — Verify Auth Flow (SSR)
1. Page loads → "LOGIN" button (no auth flash)
2. Click LOGIN → modal with email + password
3. Register → account created → local data migrated → Navbar shows username instantly (SSR)
4. Refresh → user persists
5. Logout → `router.refresh()` → LOGIN returns

### Step 7.4 — Verify Guest Persistence
1. Play game as guest → score saved to localStorage
2. Check Profile → local stats shown with "(LOCAL)" label
3. Register/login → local scores migrated to DB
4. localStorage cleared after migration
5. Profile now shows server stats

### Step 7.5 — Verify API Endpoints
1. POST score → saved to DB
2. GET leaderboard → top 15 unique users
3. Filter by country works
4. Save/load memory card works
5. Verify data via `pnpm exec prisma studio`

### Step 7.6 — Verify Performance
1. No unnecessary re-renders (React DevTools Profiler)
2. Leaderboard table stable when unrelated state changes
3. Carousel icons don't mass-re-render
4. Score emit throttled to 500ms

---

## PHASE 8: Deployment

### Step 8.1 — Pre-Deployment Checklist
- [ ] All `.env` variables set in Vercel dashboard
- [ ] `DATABASE_URL` points to Prisma Postgres production instance
- [ ] `BETTER_AUTH_URL` set to production domain
- [ ] `BETTER_AUTH_SECRET` is a strong random string
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] Prisma schema synced with production DB (`pnpm exec prisma db push`)
- [ ] `next.config.mjs` has no dev-only settings
- [ ] All placeholder assets replaced (or acceptable for MVP)

### Step 8.2 — Deploy to Vercel
```bash
vercel deploy --prod
```
Or connect GitHub repo for automatic deploys.

### Step 8.3 — Post-Deploy Verification
- Test auth flow on production (SSR session rendering, modal, local→DB migration)
- Verify leaderboard API returns data (with `x-vercel-ip-country` header now real)
- Check Edge caching on leaderboard endpoint
- Test guest flow: play → local save → register → migration → server stats

---

## KEY ARCHITECTURAL RULES (Emulator)

1. **No TypeScript.** All code is JavaScript (ES6+).
2. **pnpm only.** Never use `npm`, `npx`, or `yarn`. Use `pnpm exec` for bin commands.
3. **SSR for auth-dependent rendering.** Navbar, Profile, and play page user prop resolved server-side. No client-side auth flash.
4. **No Google/social OAuth.** Auth is strictly email + password via Better Auth.
5. **Prisma Postgres only.** No Supabase. Database URL from Prisma Data Platform.
6. **Prisma singleton in dev.** Prevent hot-reload connection exhaustion via `globalThis` caching.
7. **Guest persistence via localStorage.** Scores/saves stored locally when not logged in, migrated to DB on login.
8. **One save per user per game.** Enforced by `@@unique([userId, gameId])` + `upsert()`.
9. **One personal best per user on leaderboard.** Enforced by `@@unique([userId, gameId])` on `LeaderboardEntry` + conditional `upsert`.
10. **Country code from Vercel header.** `x-vercel-ip-country` in prod, fallback `'XX'` in dev.
11. **`useMemo` for all computed/filtered data.** Never compute derived state inline in JSX.
12. **`React.memo` on frequently-rendered leaf components.** CarouselIcon, LeaderboardRow.
13. **`useCallback` for handlers passed to memoized children.**
14. **300ms debounce on all text/filter inputs.**
15. **Components under 300 lines.** Extract sub-components when exceeded.
16. **Import order:** React → External libs → Internal components → Utils → Styles.
17. **Always consult latest docs.** Never assume deprecated APIs still work.
