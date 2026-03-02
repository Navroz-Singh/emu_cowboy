# THEPLAN.md — Nexus Arcade Master Plan Index

> **This project's plan is split into three modular documents for independent development and testing.**

---

## Plan Documents

| Document | Scope | Description |
|---|---|---|
| [PLAN_EMULATOR.md](PLAN_EMULATOR.md) | **Emulator / Platform** | Arcade cabinet UI, authentication (Better Auth), database (Prisma Postgres), API routes, frontend shell (Next.js), views, deployment. |
| [PLAN_BRIDGE.md](PLAN_BRIDGE.md) | **Integration Contract** | EventBus protocol, Zustand stores, GameWrapper, SystemOverlay, persistence adapter (localStorage ↔ DB), game registry. Defines how emulator and games communicate. |
| [PLAN_DUSTBOWL_DASH.md](PLAN_DUSTBOWL_DASH.md) | **Dustbowl Dash Game** | Top-down infinite runner — all Phaser scenes, player mechanics (lane switch, jump, quick-draw, lasso), obstacles, VFX, stun/death. |

---

## Execution Order

```
Phase 1  →  PLAN_EMULATOR.md    Foundation & Environment Setup (pnpm, Prisma, env vars)
Phase 2  →  PLAN_EMULATOR.md    Database & Authentication (schema, Better Auth, SSR)
Phase 3  →  PLAN_EMULATOR.md    Persistence Adapter (localStorage ↔ DB)
             ↕ parallel
Phase 4  →  PLAN_BRIDGE.md      EventBus, Stores, GameWrapper, SystemOverlay, Registry
Phase 5  →  PLAN_EMULATOR.md    Backend API Routes (scores, saves)
Phase 6  →  PLAN_EMULATOR.md    Frontend Shell (cabinet, navbar, views, auth modal)
             ↕ parallel
Phase 7  →  PLAN_DUSTBOWL_DASH  Game Implementation (scenes, mechanics, VFX)
Phase 8  →  PLAN_EMULATOR.md    Polish & Integration
Phase 9  →  All documents       Testing & Verification
Phase 10 →  PLAN_EMULATOR.md    Deployment
```

---

## Key Principles

- **Modular:** Game and emulator are independently testable.
- **pnpm only:** All package commands use `pnpm` (never `npm`/`yarn`).
- **Guest persistence:** Scores/saves go to localStorage for guests, database for logged-in users, auto-migrated on login.
- **No TypeScript.** JavaScript (ES6+) only.
- **EventBus is the only bridge** between React and Phaser.
- **Before writing code, explain what you're going to do and how you're going to do it and always ask for confirmation**