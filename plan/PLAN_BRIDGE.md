# PLAN_BRIDGE.md — Emulator ↔ Game Integration Contract

> **This document defines the interface between the emulator platform and any game cartridge.**
> Games and emulator are **independently testable** but trivially composable via this contract.
> For the platform plan, see [PLAN_EMULATOR.md](PLAN_EMULATOR.md).
> For the Dustbowl Dash game plan, see [PLAN_DUSTBOWL_DASH.md](PLAN_DUSTBOWL_DASH.md).

---

## 0. Design Philosophy

The emulator and games are **decoupled modules**:

| Layer | Knows About | Does NOT Know About |
|---|---|---|
| **Emulator** (React/Next.js) | Game registry, EventBus events, Zustand stores | Phaser internals, scene logic, game objects |
| **Bridge** (this contract) | Both sides' public APIs | Implementation details of either |
| **Game** (Phaser) | EventBus events, its own scene/object code | React components, Zustand, API routes, auth |

**Key principle:** A game can be developed and tested in a standalone HTML page with a mocked EventBus. The emulator can be developed and tested with a mock game that just emits canned events. They join seamlessly when both follow this contract.

---

## 1. Bridge Dependencies

These packages belong to the bridge layer (installed once at the project root):

```bash
pnpm add phaser
```

Phaser is a **bridge dependency** because:
- The emulator uses `Phaser.Events.EventEmitter` for the EventBus (no game logic)
- Games use Phaser for rendering + physics
- Both import from the same `phaser` package

---

## 2. Persistence Adapter

**File: `src/lib/persistence.js`** (defined in PLAN_EMULATOR.md §Phase 3)

The persistence adapter is the bridge's data layer. It abstracts storage:

| User State | Storage Backend | Endpoint |
|---|---|---|
| **Logged in** | Prisma Postgres via API | `POST/GET /api/v1/scores/[gameId]`, `POST/GET /api/v1/saves/[gameId]` |
| **Guest** | `localStorage` | N/A (client-only) |

Games **never call fetch() or access localStorage directly.** They emit events. The bridge layer (SystemOverlay + EventBus listeners in React) calls the persistence adapter.

### Data Flow:

```
Game (Phaser)                    Bridge (EventBus)                Emulator (React)
─────────────                    ─────────────────                ────────────────
PLAYER_DIED { score,     ──→     SystemOverlay listens    ──→     persistence.submitScore(gameId, score, user, timePlayed)
  timePlayed }                                                    ├── user ? POST /api/v1/scores → ScoreLog + LeaderboardEntry + UserStat
                                                                  └── guest ? localStorage
                                 
SAVE_REQUESTED { state } ──→     SystemOverlay listens    ──→     persistence.saveGameState(gameId, state, user)
                                                                  ├── user ? POST /api/v1/saves → Prisma
                                                                  └── guest ? localStorage
```

---

## 3. The Singleton Event Bus

**File: `src/lib/eventBus.js`**

```javascript
import Phaser from 'phaser';

export const EventBus = new Phaser.Events.EventEmitter();

export const EVENTS = {
  // Game → React
  GAME_READY:     'game_ready',       // Game finished loading, ready to play
  GAME_START:     'game_start',       // Game run has begun (after countdown/intro)
  SCORE_UPDATED:  'score_updated',    // { score: number, ammo: number, ...gameSpecific }
  PLAYER_DIED:    'player_died',      // { score: number, timePlayed: number }
  SAVE_REQUESTED: 'save_requested',   // { state: object }

  // React → Game
  SYSTEM_PAUSE:   'system_pause',     // Pause the game scene
  SYSTEM_RESUME:  'system_resume',    // Resume the game scene
  GAME_RESTART:   'game_restart',     // Restart the game (from "Play Again")
};
```

### Event Contracts:

| Event | Direction | Payload | Emitters | Listeners |
|---|---|---|---|---|
| `GAME_READY` | Game → React | `void` | BootScene/MainScene `create()` | GameWrapper (optional: show "PRESS START") |
| `GAME_START` | Game → React | `void` | MainScene (after first input or countdown) | SystemOverlay (start HUD timer) |
| `SCORE_UPDATED` | Game → React | `{ score: number, ammo?: number }` | MainScene `update()` — **throttled to 500ms** | SystemOverlay → Zustand `emulatorStore` |
| `PLAYER_DIED` | Game → React | `{ score: number, timePlayed: number }` | MainScene collision handler (after stun delay) | SystemOverlay → Game Over modal + `persistence.submitScore()` |
| `SAVE_REQUESTED` | Game → React | `{ state: object }` | Any scene (checkpoint/auto-save) | SystemOverlay → `persistence.saveGameState()` |
| `SYSTEM_PAUSE` | React → Game | `void` | SystemOverlay pause button | MainScene → `this.scene.pause()` |
| `SYSTEM_RESUME` | React → Game | `void` | SystemOverlay resume button | MainScene → `this.scene.resume()` |
| `GAME_RESTART` | React → Game | `void` | Game Over "Play Again" button | MainScene → `this.scene.restart()` |

### Rules:
- **Throttle `SCORE_UPDATED`:** Emit at most every 500ms. Never per-frame.
- **No direct React↔Phaser prop passing.** EventBus is the ONLY bridge.
- **Cleanup on unmount.** React components must `EventBus.off()` in `useEffect` cleanup.
- **Payload shape is the contract.** Games must emit exactly these shapes. The emulator must consume exactly these shapes.

---

## 4. The Zustand Stores (Shared State)

### 4.1 Emulator Store

**File: `src/store/emulatorStore.js`**

This store is the React-side mirror of game state. Updated exclusively via EventBus listeners.

```javascript
import { create } from 'zustand';

export const useEmulatorStore = create((set, get) => ({
  // State
  isPaused: false,
  score: 0,
  highScore: 0,
  ammoCount: 6,         // Game-specific but surfaced in HUD

  // Actions
  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
  setScore: (n) => {
    const current = get().highScore;
    set({ score: n, highScore: Math.max(n, current) });
  },
  setAmmo: (n) => set({ ammoCount: n }),
  reset: () => set({ isPaused: false, score: 0, ammoCount: 6 }),
}));
```

### 4.2 Arcade Store

**File: `src/store/arcadeStore.js`**

```javascript
import { create } from 'zustand';

export const useArcadeStore = create((set) => ({
  activeTab: 'ALL_GAMES',
  selectedGameId: 'dustbowl-dash',

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedGame: (gameId) => set({ selectedGameId: gameId }),
}));
```

---

## 5. The Game Wrapper (Phaser ↔ React Bridge Component)

**File: `src/components/emulator/GameWrapper.jsx`**

This is the **only** React component that touches Phaser directly.

```
'use client'
```

### Responsibilities:
1. Render a `<div ref={containerRef}>` as the Phaser canvas parent
2. Dynamically import Phaser and game scenes inside `useEffect` (no SSR)
3. Create `new Phaser.Game(config)` with merged base + cartridge config
4. Guard against React Strict Mode double-init: `if (!gameRef.current && containerRef.current)`
5. Destroy game on unmount: `game.destroy(true)`

### Props:
| Prop | Type | Description |
|---|---|---|
| `gameId` | string | Registry key (e.g., `'dustbowl-dash'`) |
| `width` | number | Canvas width (default: 800) |
| `height` | number | Canvas height (default: 600) |

### Dynamic Import Strategy:

```javascript
useEffect(() => {
  let isMounted = true;
  
  async function initGame() {
    const Phaser = (await import('phaser')).default;
    const { GAME_REGISTRY } = await import('@/games/registry');
    const cartridge = GAME_REGISTRY[gameId];
    
    if (!cartridge?.sceneImporter || !isMounted || gameRef.current) return;
    
    // Each cartridge provides a `sceneImporter` function that returns scene classes
    const scenes = await cartridge.sceneImporter();
    
    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width, height,
      ...cartridge.config,
      scene: scenes,
    };
    
    gameRef.current = new Phaser.Game(config);
  }
  
  initGame();
  
  return () => {
    isMounted = false;
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }
  };
}, [gameId, width, height]);
```

---

## 6. The System Overlay (HUD Layer)

**File: `src/components/emulator/SystemOverlay.jsx`**

```
'use client'
```

### Responsibilities:
1. Render HUD on top of the game canvas (absolute positioned, `pointer-events-none`)
2. Display: game title, score, ammo count, pause button
3. Listen to EventBus events and update Zustand + trigger persistence
4. Render game-over modal when `PLAYER_DIED` fires

### EventBus Subscriptions (in `useEffect`):

```javascript
useEffect(() => {
  const onScoreUpdated = ({ score, ammo }) => {
    setScore(score);
    if (ammo !== undefined) setAmmo(ammo);
  };
  
  const onPlayerDied = async ({ score, timePlayed }) => {
    setScore(score);
    setGameOverVisible(true);
    // Persist score via adapter (writes to ScoreLog + LeaderboardEntry + UserStat on server)
    await submitScore(gameId, score, user, timePlayed);
  };
  
  EventBus.on(EVENTS.SCORE_UPDATED, onScoreUpdated);
  EventBus.on(EVENTS.PLAYER_DIED, onPlayerDied);
  
  return () => {
    EventBus.off(EVENTS.SCORE_UPDATED, onScoreUpdated);
    EventBus.off(EVENTS.PLAYER_DIED, onPlayerDied);
  };
}, [gameId, user]);
```

### Pause Flow:
1. Pause button click → `togglePause()` in Zustand
2. If pausing → `EventBus.emit(EVENTS.SYSTEM_PAUSE)` → Phaser `scene.pause()`
3. If resuming → `EventBus.emit(EVENTS.SYSTEM_RESUME)` → Phaser `scene.resume()`

### Game Over Modal:
- "GAME OVER" in saloon font
- Final score (gold)
- **Logged in:** "PLAY AGAIN" button → `EventBus.emit(EVENTS.GAME_RESTART)` + reset store, "HOME" button → `router.push('/')`
- **Guest:** Same + "LOG IN TO SAVE SCORE" button → opens auth modal

---

## 7. The Game Registry

**File: `src/games/registry.js`**

The registry maps `gameId` strings to cartridge metadata. This is the **only** file the emulator reads to know about available games.

```javascript
export const GAME_REGISTRY = {
  'dustbowl-dash': {
    title: 'Dustbowl Dash',
    description: 'Infinite runner in the wild west. Go the distance and lasso rabbits!',
    heroImage: '/assets/carousel/dustbowl-dash.png',
    carouselIcon: '/assets/carousel/dustbowl-dash.png',
    config: {
      physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    },
    // Dynamic scene importer — avoids bundling Phaser scenes in SSR
    sceneImporter: async () => {
      const { default: BootScene } = await import('@/games/dustbowl-dash/scenes/BootScene');
      const { default: MainScene } = await import('@/games/dustbowl-dash/scenes/MainScene');
      return [BootScene, MainScene];
    },
  },
  'pong': {
    title: 'Pong MainScene',
    description: 'Classic pong with a twist.',
    heroImage: '/assets/carousel/pong.png',
    carouselIcon: '/assets/carousel/pong.png',
    config: null,
    sceneImporter: null,  // Not yet implemented
  },
  'pixel-fistfight': {
    title: 'Pixel Fistfight',
    description: 'Duke it out in pixel art.',
    heroImage: '/assets/carousel/pixel-fistfight.png',
    carouselIcon: '/assets/carousel/pixel-fistfight.png',
    config: null,
    sceneImporter: null,
  },
  'space-invaders': {
    title: 'Space Invaders',
    description: 'Defend planet earth.',
    heroImage: '/assets/carousel/space-invaders.png',
    carouselIcon: '/assets/carousel/space-invaders.png',
    config: null,
    sceneImporter: null,
  },
  'debug-platformer': {
    title: 'Debug Platformer',
    description: 'Jump, run, debug.',
    heroImage: '/assets/carousel/debug-platformer.png',
    carouselIcon: '/assets/carousel/debug-platformer.png',
    config: null,
    sceneImporter: null,
  },
};
```

### How to Add a New Game:

1. Create a folder: `src/games/[your-game-id]/`
2. Add scenes (at minimum `BootScene.js` and `MainScene.js`)
3. Add an entry to `GAME_REGISTRY` with:
   - `title`, `description`, `heroImage`, `carouselIcon`
   - `config` (Phaser config object — physics, etc.)
   - `sceneImporter` (async function returning array of scene classes)
4. Your `MainScene` must:
   - Emit `GAME_READY` after `create()`
   - Emit `SCORE_UPDATED` (throttled) during `update()`
   - Emit `PLAYER_DIED` when the run ends
   - Listen for `SYSTEM_PAUSE`, `SYSTEM_RESUME`, `GAME_RESTART`
5. Add game icon to `public/assets/carousel/`
6. That's it. The emulator picks it up automatically.

---

## 8. The Dynamic Play Route

**File: `src/app/play/[gameId]/page.js`**

This is a **Server Component** that wires everything together for a game session:

```javascript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { GAME_REGISTRY } from "@/games/registry";
import PlayClient from "./PlayClient";

export default async function PlayPage({ params }) {
  const { gameId } = await params;
  const cartridge = GAME_REGISTRY[gameId];

  if (!cartridge || !cartridge.config) return notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user ?? null;

  return <PlayClient gameId={gameId} user={user} />;
}
```

**File: `src/app/play/[gameId]/PlayClient.jsx`**

```
'use client'
```

- Uses `next/dynamic` to import `GameWrapper` with `{ ssr: false }`
- Renders `SystemOverlay` (absolute) on top
- Container: `relative w-[800px] h-[600px] mx-auto`
- Wrapped in `CabinetShell` + `ScreenFrame` to maintain arcade aesthetic
- Passes `user` to `SystemOverlay` (for persistence adapter decisions)

---

## 9. Bridge Folder Structure

```
src/
├── components/
│   └── emulator/
│       ├── GameWrapper.jsx          (Phaser <-> React bridge, no SSR)
│       └── SystemOverlay.jsx        (HUD: score, pause, game over)
├── games/
│   └── registry.js                  (cartridge registry — maps gameId to config/meta)
├── lib/
│   ├── eventBus.js                  (Phaser EventEmitter singleton + EVENTS constants)
│   └── persistence.js               (localStorage vs DB adapter — defined in PLAN_EMULATOR.md)
├── store/
│   └── emulatorStore.js             (Zustand: score, pause, ammo)
└── app/
    └── play/
        └── [gameId]/
            ├── page.js              (Server Component — SSR user + registry lookup)
            └── PlayClient.jsx       (Client Component — canvas + overlay)
```

---

## 10. Testing the Bridge in Isolation

### Mock Game (for testing emulator without a real game):

Create `src/games/mock-game/scenes/MockScene.js`:
```javascript
import { EventBus, EVENTS } from '@/lib/eventBus';

export default class MockScene extends Phaser.Scene {
  constructor() { super('MockScene'); }
  
  create() {
    EventBus.emit(EVENTS.GAME_READY);
    
    // Simulate score updates every second
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.score = (this.score || 0) + 100;
        EventBus.emit(EVENTS.SCORE_UPDATED, { score: this.score, ammo: 6 });
      },
    });
    
    // Simulate death after 5 seconds
    this.time.delayedCall(5000, () => {
      EventBus.emit(EVENTS.PLAYER_DIED, { score: this.score, timePlayed: 5 });
    });
    
    // Listen for system events
    EventBus.on(EVENTS.SYSTEM_PAUSE, () => this.scene.pause());
    EventBus.on(EVENTS.SYSTEM_RESUME, () => this.scene.resume());
    EventBus.on(EVENTS.GAME_RESTART, () => this.scene.restart());
  }
}
```

### Mock EventBus (for testing games without the emulator):

```javascript
// test/mockEventBus.js
class MockEventBus {
  constructor() { this.listeners = {}; this.emitted = []; }
  on(event, fn) { (this.listeners[event] ||= []).push(fn); }
  off(event, fn) { this.listeners[event] = (this.listeners[event] || []).filter(f => f !== fn); }
  emit(event, data) { this.emitted.push({ event, data }); (this.listeners[event] || []).forEach(fn => fn(data)); }
}
export const EventBus = new MockEventBus();
export const EVENTS = {
  GAME_READY: 'game_ready', GAME_START: 'game_start',
  SCORE_UPDATED: 'score_updated', PLAYER_DIED: 'player_died',
  SAVE_REQUESTED: 'save_requested', SYSTEM_PAUSE: 'system_pause',
  SYSTEM_RESUME: 'system_resume', GAME_RESTART: 'game_restart',
};
```

### Verification Checklist:

- [ ] GameWrapper creates Phaser instance, destroys on unmount
- [ ] EventBus events flow correctly in both directions
- [ ] SystemOverlay updates Zustand from SCORE_UPDATED
- [ ] PLAYER_DIED triggers persistence adapter (DB if logged in, localStorage if guest)
- [ ] SYSTEM_PAUSE / SYSTEM_RESUME pauses and resumes game
- [ ] GAME_RESTART resets game and Zustand store
- [ ] React Strict Mode doesn't double-init Phaser
- [ ] Navigator away destroys Phaser instance cleanly

---

## KEY ARCHITECTURAL RULES (Bridge)

1. **No React props to Phaser.** All communication goes through `EventBus`.
2. **No SSR for Phaser.** `GameWrapper` must use `next/dynamic` with `{ ssr: false }`.
3. **Games never call fetch() or localStorage directly.** They emit events; the bridge persists.
4. **Throttle `SCORE_UPDATED` to 500ms.** Never per-frame.
5. **Every game must emit: `GAME_READY`, `SCORE_UPDATED`, `PLAYER_DIED`.** Must listen for: `SYSTEM_PAUSE`, `SYSTEM_RESUME`, `GAME_RESTART`.
6. **`useEffect` cleanup:** Always unsubscribe EventBus listeners on unmount.
7. **Object pooling in games.** No `new Sprite()` in update loops.
8. **Delta-normalize all movement.** Multiply speed by `(delta / 1000)`.
9. **pnpm only.** All package commands use `pnpm`.
