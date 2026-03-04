# PLAN_DUSTBOWL_DASH.md — Dustbowl Dash Game Cartridge

> **This document covers the Dustbowl Dash game only — all Phaser scenes, objects, mechanics, and VFX.**
> This game plugs into the emulator via the bridge contract defined in [PLAN_BRIDGE.md](PLAN_BRIDGE.md).
> For the emulator platform, see [PLAN_EMULATOR.md](PLAN_EMULATOR.md).
>
> **Architectural Mandate:** *"The world scrolls, the player reacts, the engine validates."*
> Every generated scenario must remain physically solvable from the player's current lane and speed budget.
> Impossible patterns are engine bugs and must be rejected before spawn.

---

## 0. Game Overview

**Dustbowl Dash** is a wild-west-themed infinite runner viewed from a strict **90-degree Bird's-Eye (Top-Down)** perspective. The player controls a cowboy on horseback galloping "north" through an infinite orange desert, dodging obstacles across three lanes, shooting barrels, jumping over cacti, and lassoing checkpoint-gated rabbits for bonus points and ammo recovery.

**Game ID:** `dustbowl-dash`
**Engine:** Phaser 3 (3.80+), Arcade Physics
**Canvas:** 800×600px
**Physics Gravity:** `{ y: 0 }` (top-down — no vertical gravity)

---

## 1. Core Visual Concept

### 1.1 Perspective

Strict top-down. The camera is directly above the cowboy's Stetson hat. NOT a side-scroller.

### 1.2 Art Style

16-bit Arcade (SNES/Sega Genesis era). High-contrast pixels, dithering for sand texture, warm earthy palette (oranges, browns, sage greens).

### 1.3 The Arena — Spatial Kernel

A seamless, infinite orange desert with deterministic coordinate zones:

**Horizontal Grid:**

- **Track Lines (Wagon Ruts):** `[180, 325, 474, 620]` — four dark brown parallel lines
- **Lane Centers (Safe Spots):** Lane 0 (Left) = `252`, Lane 1 (Middle) = `400`, Lane 2 (Right) = `547`
- **Lane Width:** `148 px` (derived from lane center spacing)
- **Left Margin:** `0 ≤ X < 180` — rabbits and atmospheric sprites only
- **Right Margin:** `620 < X ≤ 800` — rabbits and atmospheric sprites only
- **Boundaries:** No canyons or walls. The desert floor extends to screen edges with static non-collidable "flavor" sprites (cracked earth, animal skulls).

**Vertical Flow:**

- **Horizon Spawn Line:** `Y = -100` — obstacles materialize here
- **Player Anchor:** `Y = 500` — cowboy's home position
- **Despawn Line:** `Y = 700` — objects reclaimed to pool

**The Illusion:** A `TileSprite` ground texture scrolls **vertically downward** (top-to-bottom). Obstacles spawn at the horizon and move down toward the player.

### 1.4 Direction of Motion

Obstacles spawn at the **top** of the screen (`Y = -100`) and move **downward**. The player's horse faces "North" (top of screen). The world scrolls down to create the illusion of forward motion.

### 1.5 Perspective Interpolation (Depth Illusion)

To sell the top-down perspective, approaching obstacles scale up from small (horizon) to full-size (player level):

$$
S = S_{min} + (S_{max} - S_{min}) \times \frac{y - Y_{horizon}}{Y_{player} - Y_{horizon}}
$$

Canonical range:

- `S_min = 0.2` at `Y = -100` (horizon)
- `S_max = 1.0` at `Y = 500` (player anchor)

---

## 2. Sprite Assets

All sprites are in `/images/sprites/` and must use the exact dimensions/frame layouts below.

| File | Dimensions | Frame Setup | Usage |
|---|---|---|---|
| `desert-bg.png` | `800 × 800` | Single image | TileSprite environment (scroll via `tilePositionY`) |
| `cowboy_gallop.png` | `64 × 512` | `1 col × 4 rows` (`64 × 128` each) | Gallop default state |
| `cowboy_actions.png` | `192 × 128` | `3 cols × 1 row` (`64 × 128` each) | Quick-draw (0), lasso-aim (1), lasso-throw (2) |
| `obstacles.png` | `320 × 80` | `4 cols × 1 row` (`80 × 80` each) | Cactus, barrel, wanted sign, tumbleweed |
| `wagon.png` | `200 × 140` | Single image | Heavy hazard that blocks two lanes |
| `rabbit.png` | `144 × 64` | `3 cols × 1 row` (`48 × 64` each) | Rabbit run animation |
| `vfx.png` | `192 × 96` | `4 cols × 2 rows` (`48 × 48` each) | Dust (0–3), muzzle flash (4), explosion (5), lasso loop (6), stun star (7) |
| `bullet.png` | `8 × 16` | Single image | Projectile (`velocityY = -1200`) |
| `shadow.png` | `48 × 24` | Single image | Depth shadow (`alpha: 0.5`) |

> **CRITICAL:** Use these exact frame sizes in `this.load.spritesheet()` calls.

---

## 3. Player Character: The Cowboy & Horse

The sprite is a narrow, streamlined oblong rectangle facing "North." Approximately 1:3 width:height ratio.

### 3.1 Character States & Animations

| State | Animation | Visual Feedback | Duration |
|---|---|---|---|
| **Idle Gallop** | `cowboy_gallop` frames `0–3` | Frames `0` & `2`: hooves on ground (lowest). Frames `1` & `3`: legs extended (highest). | Continuous |
| **Lane Switch** | Phaser Tween | Sprite moves to `targetX` over 150ms. Angle set to ±5° during move, then resets to 0°. | 150ms |
| **The Jump** | Scaling trick | Scale: 1.0 → 1.4 → 1.0. Shadow sprite shrinks + alpha decreases (0.5 → 0.2). | 400ms |
| **Quick-Draw** | `cowboy_actions` frame `0` | Revolver out, arm extended (SHIFT). | 200ms |
| **Lasso Aim** | `cowboy_actions` frame `1` | Coiled rope held high while SPACE action is primed. | — |
| **Lasso Throw** | `cowboy_actions` frame `2` | Arm snapped forward on rabbit-target attempt. | 300ms |

### 3.2 Shadow Sprite

A separate `shadow.png` oval (`48 × 24`) at 50% opacity, positioned at `(cowboy.x, 530)` (fixed Y baseline).

During jump, keep the shadow at ground Y (`530`) while the cowboy scales up. Shadow scales down and fades to ~0.2 alpha during jump.

---

## 4. Canonical Constants

All magic numbers live in a single constants block at the top of MainScene. This is the single source of truth.

| Variable | Value | Unit | Notes |
|---|---:|---|---|
| `CANVAS_WIDTH` | 800 | px | Fixed |
| `CANVAS_HEIGHT` | 600 | px | Fixed |
| `LANE_WIDTH` | 148 | px | Derived from lane centers |
| `LANE_CENTERS` | `[252, 400, 547]` | px | Fixed |
| `TRACK_LINES` | `[180, 325, 474, 620]` | px | Fixed |
| `SPAWN_Y` | `-100` | px | Horizon spawn line |
| `PLAYER_Y` | `500` | px | Player anchor position |
| `DESPAWN_Y` | `700` | px | Pool reclaim line |
| `SWITCH_DURATION` | `150` | ms | Lane tween duration |
| `JUMP_DURATION` | `400` | ms | Scale-jump arc duration |
| `SHOOT_DURATION` | `200` | ms | Quick-draw action lock |
| `LASSO_DURATION` | `300` | ms | Lasso throw action lock |
| `INPUT_BUFFER_WINDOW` | `200` | ms | Buffered lane-switch intent |
| `INITIAL_SPEED` | `400` | px/s | Start scroll speed |
| `MAX_SPEED` | `950` | px/s | Hard speed cap |
| `ACCEL_RATE` | `2` | px/s² | Baseline ramp (within surge) |
| `SURGE_INCREMENT` | `75` | px/s | Speed boost per surge cycle |
| `SURGE_CYCLE` | `30` | s | Seconds per surge-rest cycle |
| `BULLET_SPEED` | `1200` | px/s | Projectile upward velocity |
| `SCORE_EMIT_INTERVAL` | `500` | ms | EventBus throttle |
| `HOOF_BOX` | `40 × 30` | px | Player vulnerability hitbox |
| `NEAR_MISS_THRESHOLD` | `15` | px | Bonus trigger distance |
| `LEAD_RECOVERY` | `2` | units | Ammo restored per rabbit catch |
| `RABBIT_CHECKPOINTS` | `[5000, 25000, 80000, 200000, 500000]` | score | Checkpoint-gated rabbit encounters |

---

## 5. Action State Machine & Conflict Matrix

The player exists in exactly one **action state** at any time. Input is only accepted when the required transition is legal.

### 5.1 Action States

| State | Duration | Description |
|---|---|---|
| `IDLE` | — | Default galloping state. All actions available. |
| `SWITCHING` | 150ms | Lane change tween in progress. |
| `JUMPING` | 400ms | Scale-jump arc in progress. |
| `SHOOTING` | 200ms | Quick-draw firing animation. |
| `LASSOING` | 300ms | Lasso throw animation. |

### 5.2 Conflict Matrix

Rows = current state, columns = attempted action. ✅ = allowed, ❌ = blocked, 🔄 = buffered.

|  | Lane Switch | Jump | Quick-Draw | Lasso |
|---|:---:|:---:|:---:|:---:|
| **IDLE** | ✅ | ✅ | ✅ | ✅ |
| **SWITCHING** | 🔄 (buffer) | ❌ | ❌ | ❌ |
| **JUMPING** | ❌ | ❌ | ❌ | ❌ |
| **SHOOTING** | ❌ | ❌ | ❌ | ❌ |
| **LASSOING** | ❌ | ❌ | ❌ | ❌ |

**Key Rules:**

1. While **jumping**, the cowboy is airborne — no lane switching, no shooting, no lassoing.
2. While **shooting** (quick-draw), the arm is extended and the pose is locked for 200ms — no jumping, no lane switching, no lassoing.
3. While **lassoing**, the arm is committed to the throw for 300ms — no jumping, no shooting, no lane switching.
4. While **switching lanes**, only another lane switch can be **buffered** (consumed on tween completion after up to 200ms). All other actions are blocked during the 150ms tween.
5. Every action returns to `IDLE` on completion, at which point any action is available again.

### 5.3 Implementation Pattern

```javascript
// Action state enum
const ACTION_STATE = {
  IDLE: 'IDLE',
  SWITCHING: 'SWITCHING',
  JUMPING: 'JUMPING',
  SHOOTING: 'SHOOTING',
  LASSOING: 'LASSOING',
};

// In MainScene:
this.actionState = ACTION_STATE.IDLE;
this.inputBuffer = null; // buffered lane-switch direction

// Gate all actions:
// - switchLane: allowed if IDLE or SWITCHING (buffer)
// - jump: allowed only if IDLE
// - quickDraw: allowed only if IDLE
// - throwLasso: allowed only if IDLE
```

---

## 6. Folder Structure (Game Only)

```
src/games/dustbowl-dash/
├── scenes/
│   ├── BootScene.js          (asset preloader + animation definitions)
│   └── MainScene.js          (core gameplay loop)
└── objects/
    ├── Cowboy.js             (player: cowboy+horse composite sprite)
    ├── Obstacle.js           (generic obstacle handler — pool management)
    ├── Rabbit.js             (lasso target — margin runner)
    ├── Bullet.js             (quick-draw projectile)
    └── LassoLoop.js          (lasso rope/loop graphic)
```

---

## PHASE 7: Dustbowl Dash Game Implementation

### Step 7.1 — Boot Scene (Asset Preloader)

**File: `src/games/dustbowl-dash/scenes/BootScene.js`**

```javascript
import { Scene } from 'phaser';

export class BootScene extends Scene {
  constructor() { super('BootScene'); }
  
  preload() {
    // Loading progress bar
    const bar = this.add.graphics();
    const onProgress = (value) => {
      bar.clear();
      bar.fillStyle(0xF3A726, 1);
      bar.fillRect(200, 290, 400 * value, 20);
    };
    this.load.on('progress', onProgress);
    this.load.once('complete', () => {
      this.load.off('progress', onProgress);
      bar.destroy();
    });
    
    // Load assets from /images/sprites/
    this.load.image('desert-bg', '/images/sprites/desert-bg.png');
    this.load.spritesheet('cowboy-gallop', '/images/sprites/cowboy_gallop.png', { frameWidth: 64, frameHeight: 128 });
    this.load.spritesheet('cowboy-actions', '/images/sprites/cowboy_actions.png', { frameWidth: 64, frameHeight: 128 });
    this.load.spritesheet('obstacles', '/images/sprites/obstacles.png', { frameWidth: 80, frameHeight: 80 });
    this.load.image('wagon', '/images/sprites/wagon.png');
    this.load.spritesheet('rabbit', '/images/sprites/rabbit.png', { frameWidth: 48, frameHeight: 64 });
    this.load.spritesheet('vfx', '/images/sprites/vfx.png', { frameWidth: 48, frameHeight: 48 });
    this.load.image('bullet', '/images/sprites/bullet.png');
    this.load.image('shadow', '/images/sprites/shadow.png');
  }
  
  create() {
    // Define all animations
    this.anims.create({ key: 'gallop', frames: this.anims.generateFrameNumbers('cowboy-gallop', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'rabbit-run', frames: this.anims.generateFrameNumbers('rabbit', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'dust-puff', frames: this.anims.generateFrameNumbers('vfx', { start: 0, end: 3 }), frameRate: 12, repeat: 0 });
    this.anims.create({ key: 'muzzle-flash', frames: [{ key: 'vfx', frame: 4 }], frameRate: 16, repeat: 0 });
    this.anims.create({ key: 'explosion', frames: [{ key: 'vfx', frame: 5 }], frameRate: 14, repeat: 0 });
    
    this.scene.start('MainScene');
  }
}
```

### Step 7.2 — Main Scene — `create()` Setup

**File: `src/games/dustbowl-dash/scenes/MainScene.js`**

> **Import pattern:** MainScene uses a **combined import** — `Scene` as a named import for class extension, and `Phaser` as the default import for utility access (`Phaser.Math.Between()`, `Phaser.Input.Keyboard.JustDown()`, `Phaser.Utils.Array.GetRandom()`, `Phaser.Scenes.Events.SHUTDOWN`, etc.). This follows the Phaser Next.js template pattern where named imports are used for classes/constants and the default import is used only when nested utility namespaces are needed.

```javascript
import Phaser, { Scene } from 'phaser';
import { EventBus, EVENTS } from '@/lib/eventBus';

export class MainScene extends Scene {
  constructor() { super('MainScene'); }
  // ...
}
```

#### 7.2.1 Constants & State Variables

```javascript
// ─── Canonical Constants ───
const LANE_CENTERS = [252, 400, 547];
const TRACK_LINES = [180, 325, 474, 620];
const SPAWN_Y = -100;
const PLAYER_Y = 500;
const DESPAWN_Y = 700;
const SWITCH_DURATION = 150;
const JUMP_DURATION = 400;
const SHOOT_DURATION = 200;
const LASSO_DURATION = 300;
const INPUT_BUFFER_WINDOW = 200;
const INITIAL_SPEED = 400;
const MAX_SPEED = 950;
const SURGE_INCREMENT = 75;
const SURGE_CYCLE = 30000;       // 30s in ms
const BULLET_SPEED = 1200;
const SCORE_EMIT_INTERVAL = 500;
const NEAR_MISS_THRESHOLD = 15;
const LEAD_RECOVERY = 2;
const RABBIT_CHECKPOINTS = [5000, 25000, 80000, 200000, 500000];

const ACTION_STATE = {
  IDLE: 'IDLE',
  SWITCHING: 'SWITCHING',
  JUMPING: 'JUMPING',
  SHOOTING: 'SHOOTING',
  LASSOING: 'LASSOING',
};

// ─── Instance State (in create()) ───
this.score = 0;
this.gameSpeed = INITIAL_SPEED;
this.isGameOver = false;
this.actionState = ACTION_STATE.IDLE;
this.inputBuffer = null;              // buffered lane-switch direction
this.currentLane = 1;                 // 0=left, 1=middle, 2=right
this.ammoCount = 6;                   // Quick-Draw bullets ("Lead")
this.lastScoreEmit = 0;               // Throttle timestamp
this.startTime = Date.now();          // Session start — used for UserStat.totalTimePlayed
this.distanceTraveled = 0;            // total px scrolled (for distance-based spawning)
this.nextSpawnDistance = 600;          // first spawn at 600px traveled
this.spawnGapTier = 600;              // current gap between obstacle rows (shrinks with difficulty)
this.nextRabbitCheckpointIndex = 0;   // index into RABBIT_CHECKPOINTS
this.surgeTimer = 0;                  // tracks surge-rest cycle elapsed time
this.surgePhase = 'plateau';          // 'warning' | 'surge' | 'plateau'
```

#### 7.2.2 Background

```javascript
this.bg = this.add.tileSprite(0, 0, 800, 600, 'desert-bg').setOrigin(0, 0);
```

Scrolls **vertically** via `tilePositionY` in the update loop.

#### 7.2.3 Lane Ruts

Four parallel dark brown lines using `this.add.graphics()` at fixed X positions:
```javascript
const ruts = this.add.graphics();
ruts.lineStyle(2, 0x4A2E15, 0.6);
// Draw 4 vertical lines defining the 3 lanes
TRACK_LINES.forEach(x => {
  ruts.moveTo(x, 0);
  ruts.lineTo(x, 600);
});
ruts.strokePath();
```

#### 7.2.4 Player + Hoof-Box

```javascript
this.cowboy = this.physics.add.sprite(LANE_CENTERS[1], PLAYER_Y, 'cowboy-gallop');
this.cowboy.play('gallop');

// Hoof-box: primary vulnerability hitbox (40x30), offset to lower body
this.cowboy.body.setSize(40, 30);
this.cowboy.body.setOffset(12, 45);  // centered horizontally, lowered to hoof area

this.shadow = this.add.image(LANE_CENTERS[1], 530, 'shadow').setAlpha(0.5);
```

#### 7.2.5 Object Pools (Zero-Alloc Runtime)

All game objects are pre-allocated at `create()` time. No `new Sprite()` during gameplay.

```javascript
// Generic obstacles (30 pool — covers high-density spawns)
this.obstaclePool = this.physics.add.group({ maxSize: 30 });
for (let i = 0; i < 30; i++) {
  const obs = this.obstaclePool.create(0, -200, 'obstacles', 0);
  obs.setActive(false).setVisible(false);
  obs.body.enable = false;
}

// Wagon pool (separate heavy hazard texture)
this.wagonPool = this.physics.add.group({ maxSize: 5 });
for (let i = 0; i < 5; i++) {
  const wagon = this.wagonPool.create(0, -200, 'wagon');
  wagon.setActive(false).setVisible(false);
  wagon.body.enable = false;
}

// Bullets (10 pool)
this.bulletPool = this.physics.add.group({ maxSize: 10 });
for (let i = 0; i < 10; i++) {
  const b = this.bulletPool.create(0, -200, 'bullet');
  b.setActive(false).setVisible(false);
  b.body.enable = false;
}

// Dust puff pool (20 — high-frequency VFX)
this.dustPool = this.add.group({ maxSize: 20 });
for (let i = 0; i < 20; i++) {
  const dust = this.add.sprite(0, 0, 'vfx').setActive(false).setVisible(false);
  this.dustPool.add(dust);
}
```

**Pool Lifecycle:**
- `spawn`: pull pooled object, `setActive(true).setVisible(true)`, enable body
- `despawn`: `setActive(false).setVisible(false)`, disable body, return to pool

#### 7.2.6 Collisions — Hoof-Box + Anti-Tunneling

```javascript
this.physics.add.overlap(this.cowboy, this.obstaclePool, this.handleCollision, null, this);
this.physics.add.overlap(this.cowboy, this.wagonPool, this.handleCollision, null, this);
this.physics.add.overlap(this.bulletPool, this.obstaclePool, this.handleBulletHit, null, this);
```

**Anti-Tunneling:** At high speeds, obstacles can skip past the hoof-box between frames. Stretch obstacle collision bodies vertically by:

$$
stretch = V \times \frac{\Delta t}{1000}
$$

Applied in the update loop to active obstacles approaching the player Y zone.

#### 7.2.7 Keyboard Input

```javascript
this.cursors = this.input.keyboard.createCursorKeys();
this.keys = this.input.keyboard.addKeys({
  leftA: Phaser.Input.Keyboard.KeyCodes.A,
  rightD: Phaser.Input.Keyboard.KeyCodes.D,
  jumpW: Phaser.Input.Keyboard.KeyCodes.W,
  quickDrawShift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
  lassoSpace: Phaser.Input.Keyboard.KeyCodes.SPACE,
});

// Use Phaser.Input.Keyboard.JustDown() in update loop for single-press actions
// All inputs gated through action state machine (§5) before execution
```

Input processing uses the action state machine (§5). Lane switch inputs during `SWITCHING` state are buffered for up to 200ms and consumed on tween completion. All other inputs are rejected if `actionState !== IDLE`.

#### 7.2.8 EventBus Listeners

```javascript
this.onSystemPause = () => this.scene.pause();
this.onSystemResume = () => this.scene.resume();
this.onGameRestart = () => this.scene.restart();

EventBus.on(EVENTS.SYSTEM_PAUSE, this.onSystemPause);
EventBus.on(EVENTS.SYSTEM_RESUME, this.onSystemResume);
EventBus.on(EVENTS.GAME_RESTART, this.onGameRestart);

this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
  EventBus.off(EVENTS.SYSTEM_PAUSE, this.onSystemPause);
  EventBus.off(EVENTS.SYSTEM_RESUME, this.onSystemResume);
  EventBus.off(EVENTS.GAME_RESTART, this.onGameRestart);
});

EventBus.emit(EVENTS.GAME_READY);
```

---

### Step 7.3 — Main Scene — `update()` Game Loop

The update loop is fully **delta-time normalized**. All movement uses the locomotion formula:

$$
D = V \times \frac{\Delta t}{1000}
$$

This ensures frame-rate independence — the game plays identically at 30fps and 144fps.

```javascript
update(time, delta) {
  if (this.isGameOver) return;
  
  const dt = delta / 1000;
  const moveAmount = this.gameSpeed * dt;
  
  // 1. Scroll background vertically
  this.bg.tilePositionY -= moveAmount;
  
  // 2. Track distance traveled (for distance-based spawning)
  this.distanceTraveled += moveAmount;
  
  // 3. Move all active obstacles manually (deterministic control)
  this.obstaclePool.getChildren().forEach((obs) => {
    if (!obs.active) return;
    
    const type = obs.getData('type');
    
    // Vertical movement
    if (type === 'tumbleweed') {
      // Tumbleweed: slight Y drift to simulate ground contact
      const velY = obs.getData('velY') || 0;
      obs.y += velY * dt;
    } else {
      // Standard obstacles: move with world scroll
      obs.y += moveAmount;
    }
    
    // Horizontal movement (tumbleweeds cross the screen)
    const velX = obs.getData('velX');
    if (velX) obs.x += velX * dt;
    
    // Perspective scale interpolation (§1.5)
    const progress = (obs.y - SPAWN_Y) / (PLAYER_Y - SPAWN_Y);
    const clamped = Phaser.Math.Clamp(progress, 0, 1);
    obs.setScale(0.2 + (0.8 * clamped));
    
    // Anti-tunneling: stretch collision body near player zone
    if (obs.y > 350 && obs.y < 550) {
      const stretch = this.gameSpeed * dt;
      obs.body.setSize(obs.body.width, obs.body.height + stretch);
    }
    
    // Despawn (off-screen vertically or horizontally)
    if (obs.y > DESPAWN_Y || obs.x < -100 || obs.x > 900) {
      obs.setActive(false).setVisible(false);
      obs.body.enable = false;
    }
  });
  
  // Move wagons with world scroll
  this.wagonPool.getChildren().forEach((wagon) => {
    if (!wagon.active) return;
    wagon.y += moveAmount;
    const progress = (wagon.y - SPAWN_Y) / (PLAYER_Y - SPAWN_Y);
    wagon.setScale(0.2 + (0.8 * Phaser.Math.Clamp(progress, 0, 1)));
    if (wagon.y > DESPAWN_Y) {
      wagon.setActive(false).setVisible(false);
      wagon.body.enable = false;
    }
  });
  
  // Move bullets upward
  this.bulletPool.getChildren().forEach((b) => {
    if (!b.active) return;
    b.y -= BULLET_SPEED * dt;
    if (b.y < -20) {
      b.setActive(false).setVisible(false);
      b.body.enable = false;
    }
  });
  
  // 4. Distance-based score
  this.score += Math.floor(moveAmount / 10);
  
  // 5. Throttled EventBus emit
  if (time - this.lastScoreEmit > SCORE_EMIT_INTERVAL) {
    EventBus.emit(EVENTS.SCORE_UPDATED, { score: this.score, ammo: this.ammoCount });
    this.lastScoreEmit = time;
  }
  
  // 6. Check rabbit checkpoint (§7.5.5)
  this.checkRabbitCheckpoint();
  
  // 7. Distance-based obstacle spawning (§7.4.1)
  if (this.distanceTraveled >= this.nextSpawnDistance) {
    this.spawnObstaclePattern();
    this.nextSpawnDistance = this.distanceTraveled + this.spawnGapTier;
  }
  
  // 8. Process input (through action state machine — §5, §7.3.2)
  this.processInput();
  
  // 9. Surge-and-rest pacing (§7.3.1)
  this.updateSurgePacing(time, dt);
  
  // 10. Near-miss detection (§7.7.3)
  this.checkNearMisses();
  
  // 11. Dust generation (on gallop frames 0 and 2)
  const gallopFrame = this.cowboy.anims.currentFrame?.index;
  if (gallopFrame === 0 || gallopFrame === 2) {
    this.spawnDustPuff(this.cowboy.x, this.cowboy.y + 20);
  }
  
  // 12. Speed lines at high speed
  if (this.gameSpeed > 600) {
    this.spawnSpeedLine();
  }
  
  // 13. Sync shadow position
  this.shadow.x = this.cowboy.x;
  // shadow.y stays at 530 (fixed ground baseline)
}
```

#### 7.3.1 Surge-and-Rest Pacing

Linear forever-acceleration is replaced by staged pacing cycles. Each cycle is 30 seconds:

1. **Warning Phase (1s):** Speed lines intensify, visual cue that a surge is coming
2. **Surge Phase (2s):** Speed tweens up by `+75 px/s` with power-curve easing
3. **Plateau Phase (27s):** Speed holds steady, player adapts to new pace

```javascript
updateSurgePacing(time, dt) {
  this.surgeTimer += dt * 1000;
  
  if (this.surgePhase === 'plateau' && this.surgeTimer >= (SURGE_CYCLE - 3000)) {
    // Enter warning phase (last 3s of cycle, first 1s is warning)
    this.surgePhase = 'warning';
  }
  
  if (this.surgePhase === 'warning' && this.surgeTimer >= (SURGE_CYCLE - 2000)) {
    // Enter surge phase
    this.surgePhase = 'surge';
    const targetSpeed = Math.min(this.gameSpeed + SURGE_INCREMENT, MAX_SPEED);
    this.tweens.add({
      targets: this,
      gameSpeed: targetSpeed,
      duration: 2000,
      ease: 'Cubic.easeIn',
    });
  }
  
  if (this.surgeTimer >= SURGE_CYCLE) {
    // Reset cycle
    this.surgeTimer = 0;
    this.surgePhase = 'plateau';
    // Tighten spawn gap (one tier down, minimum 420)
    this.spawnGapTier = Math.max(this.spawnGapTier - 20, 420);
  }
}
```

Speed is hard-capped at `MAX_SPEED = 950 px/s`.

At high speed (≥ 700 px/s), enable stronger feedback:
- Increased speed line density
- Optional background stretch simulation
- Optional chromatic offset post-processing (if performance budget allows)

#### 7.3.2 Input Processing (Action-State Gated)

```javascript
processInput() {
  if (this.isGameOver) return;
  
  // Lane switching (allowed from IDLE or SWITCHING with buffer)
  if (Phaser.Input.Keyboard.JustDown(this.keys.leftA) || Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
    this.handleLaneSwitchInput(-1);
  }
  if (Phaser.Input.Keyboard.JustDown(this.keys.rightD) || Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
    this.handleLaneSwitchInput(1);
  }
  
  // Jump (IDLE only)
  if (Phaser.Input.Keyboard.JustDown(this.keys.jumpW) || Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
    if (this.actionState === ACTION_STATE.IDLE) this.jump();
  }
  
  // Quick-Draw (IDLE only)
  if (Phaser.Input.Keyboard.JustDown(this.keys.quickDrawShift)) {
    if (this.actionState === ACTION_STATE.IDLE) this.quickDraw();
  }
  
  // Lasso (IDLE only)
  if (Phaser.Input.Keyboard.JustDown(this.keys.lassoSpace)) {
    if (this.actionState === ACTION_STATE.IDLE) this.throwLasso();
  }
}

handleLaneSwitchInput(direction) {
  if (this.actionState === ACTION_STATE.IDLE) {
    this.switchLane(direction);
  } else if (this.actionState === ACTION_STATE.SWITCHING) {
    // Buffer the intent (consumed on tween completion)
    this.inputBuffer = direction;
    this.time.delayedCall(INPUT_BUFFER_WINDOW, () => { this.inputBuffer = null; });
  }
  // All other states: input rejected
}
```

---

### Step 7.4 — Obstacle & Interaction Matrix

All hazards spawn at horizon (`Y = -100`), scale up from `0.2 → 1.0` via perspective interpolation, and move downward at `gameSpeed`.

| Obstacle | Visual | Player Response | On Collision | Jump Bypass? | Special Behavior |
|---|---|---|---|---|---|
| **Saguaro Cactus** | Vertical green plant | **Jump** (W) | Stun → Game Over | ✅ Yes (ground-level) | Spawns in lanes |
| **Explosive Barrel** | Wooden/iron barrel | **Quick-Draw** (Shift) | Stun → Game Over | ❌ No | Destructible by bullet |
| **Wanted Sign** | Small hanging sign | **Lane Switch** (A/D) | Stun → Game Over | ❌ No (tall) | Spawns in lanes |
| **Crashed Wagon** | `wagon.png` (200×140, blocks 2 lanes) | **Early Lane Choice** | Stun → Game Over | ❌ No (tall) | Uses separate pool |
| **Tumbleweed** | Beige scrub ball | **Jump** (W) or **Lane Switch** (A/D) | Stun → Game Over | ✅ Yes (ground-level) | Crosses screen horizontally (§7.4.2) |
| **Rabbit** | Small brown critter in margins | **Lasso** (Space) for bonus | No collision (margin only) | N/A | Checkpoint-gated special encounter (§7.5.5) |

> **Jump Bypass Rule:** Jumping only avoids **ground-level** obstacles (cactus, tumbleweed). Tall obstacles (wagon, wanted sign) still collide during jump.

#### 7.4.1 Distance-Based Spawn Logic with Pattern Deck

Spawning uses **distance traveled** rather than fixed timers, ensuring consistent difficulty across all frame rates.

Gap tiers scale with difficulty:
- **Tier 1 (safe):** `600 px` gap between rows
- **Tier 2:** `540 px`
- **Tier 3:** `480 px`
- **Tier 4 (tight):** `420 px`

**Pattern Deck — Solvable Templates:**

| Pattern | Lane Occupancy | Required Response | Min Gap |
|---|---|---|---|
| **Solo** | Single obstacle in random lane | Dodge or destroy | Standard |
| **Needle** | Lanes 0 & 2 blocked | Hold middle lane | Standard |
| **Wall** | Lanes 0 & 1 blocked | Move to lane 2 | Standard |
| **Inverse Wall** | Lanes 1 & 2 blocked | Move to lane 0 | Standard |
| **Slalom** | Sequence: 0 → 2 → 1 | Zig-zag timing | Extended (2× gap) |
| **Heavy** | Wagon blocks lane pair (0+1 or 1+2) | Move to open lane | Standard |
| **Tumbleweed Cross** | Horizontal crosser, any Y | Jump or time lane position | N/A (independent) |

**Spawn function:**

```javascript
spawnObstaclePattern() {
  // Select pattern (weighted random — solo is most common)
  const patterns = ['solo','solo','solo','needle','wall','inverseWall','heavy','slalom'];
  const pattern = Phaser.Utils.Array.GetRandom(patterns);
  
  // Path validation: check solvability from player's current lane
  if (!this.validatePattern(pattern)) {
    // Fallback to safe single-obstacle row
    this.spawnSingleObstacle();
    return;
  }
  
  this.executePattern(pattern);
}
```

**Path Validation (Mandatory Solvability Check):**

Before committing a pattern:
1. Read `player.currentLane`.
2. Compute reachable lane transitions within available vertical distance/time.
3. Reject pattern if required transitions exceed feasible switch count.
4. Fallback to solvable single-obstacle row.

Golden solvability formula:

$$
RequiredGap \ge (switchCount \times switchDurationSeconds) \times gameSpeed
$$

For Lane 0 → Lane 2, `switchCount = 2`, so minimum gap = `2 × 0.15 × gameSpeed × 1.2`.

```javascript
validatePattern(pattern) {
  const requiredSwitches = this.getRequiredSwitches(pattern, this.currentLane);
  const timeAvailable = this.spawnGapTier / this.gameSpeed;  // seconds
  const timeNeeded = requiredSwitches * (SWITCH_DURATION / 1000);
  
  return timeAvailable >= timeNeeded * 1.2;  // 20% safety margin
}
```

**Pattern execution:**

```javascript
executePattern(pattern) {
  switch(pattern) {
    case 'needle':
      this.spawnInLane(0, 'cactus');
      this.spawnInLane(2, 'cactus');
      break;
    case 'wall':
      this.spawnInLane(0, 'barrel');
      this.spawnInLane(1, 'sign');
      break;
    case 'inverseWall':
      this.spawnInLane(1, 'sign');
      this.spawnInLane(2, 'barrel');
      break;
    case 'heavy':
      this.spawnWagon();
      break;
    case 'slalom':
      // Staggered spawns with vertical offsets
      this.spawnInLane(0, 'cactus', 0);
      this.spawnInLane(2, 'barrel', -150);   // offset Y
      this.spawnInLane(1, 'sign', -300);
      break;
    default:
      this.spawnSingleObstacle();
  }
  
  // Randomly add a tumbleweed crosser (independent of pattern)
  if (Phaser.Math.Between(0, 100) < 15) {
    this.spawnTumbleweed();
  }
}

spawnSingleObstacle() {
  const types = ['cactus', 'cactus', 'barrel', 'barrel', 'sign', 'sign'];
  const type = Phaser.Utils.Array.GetRandom(types);
  const laneIndex = Phaser.Math.Between(0, 2);
  this.spawnInLane(laneIndex, type);
}
```

**In-lane spawn helper:**

```javascript
spawnInLane(laneIndex, type, yOffset = 0) {
  const obs = this.obstaclePool.getFirstDead(false);
  if (!obs) return;
  
  const frameMap = { cactus: 0, barrel: 1, sign: 2, tumbleweed: 3 };
  obs.setFrame(frameMap[type]);
  obs.setData('type', type);
  obs.setData('velX', null);
  obs.setData('velY', null);
  obs.setData('nearMissTriggered', false);
  obs.setData('nearMissBonusGiven', false);
  obs.x = LANE_CENTERS[laneIndex];
  obs.y = SPAWN_Y + yOffset;
  obs.setScale(0.2);
  obs.setActive(true).setVisible(true);
  obs.body.enable = true;
  obs.body.setVelocity(0, 0);  // movement handled manually in update
}
```

**Wagon spawn:**

```javascript
spawnWagon() {
  const wagon = this.wagonPool.getFirstDead(false);
  if (!wagon) return;
  
  // Wagon blocks two adjacent lanes
  const pair = Phaser.Math.Between(0, 1);  // 0 = left pair (0+1), 1 = right pair (1+2)
  wagon.x = (LANE_CENTERS[pair] + LANE_CENTERS[pair + 1]) / 2;
  wagon.y = SPAWN_Y;
  wagon.setScale(0.2);
  wagon.setActive(true).setVisible(true);
  wagon.body.enable = true;
}
```

#### 7.4.2 Tumbleweed — Horizontal Cross-Screen Hazard

Tumbleweeds are unique: they enter from one side of the screen and **roll horizontally** to the other side, with slight vertical drift to simulate ground contact with the scrolling world. They are NOT spawned in lanes like other obstacles.

```javascript
spawnTumbleweed() {
  const obs = this.obstaclePool.getFirstDead(false);
  if (!obs) return;
  
  obs.setFrame(3);  // tumbleweed frame
  obs.setData('type', 'tumbleweed');
  obs.setData('nearMissTriggered', false);
  obs.setData('nearMissBonusGiven', false);
  
  // Enter from left or right edge
  const fromLeft = Phaser.Math.Between(0, 1) === 0;
  obs.x = fromLeft ? -40 : 840;
  obs.y = Phaser.Math.Between(200, 450);  // player-area Y range
  
  // Horizontal speed toward opposite edge
  const hSpeed = Phaser.Math.Between(200, 350);
  obs.setData('velX', fromLeft ? hSpeed : -hSpeed);
  
  // Slight downward Y drift — simulates the tumbleweed being "on the ground"
  // in a world that scrolls vertically. Without this it looks like it floats
  // at a fixed Y while the desert moves beneath it.
  obs.setData('velY', this.gameSpeed * 0.15);
  
  // Scale based on current Y depth
  const progress = (obs.y - SPAWN_Y) / (PLAYER_Y - SPAWN_Y);
  obs.setScale(0.2 + (0.8 * Phaser.Math.Clamp(progress, 0, 1)));
  
  obs.setActive(true).setVisible(true);
  obs.body.enable = true;
  
  // Rolling rotation animation
  this.tweens.add({
    targets: obs,
    angle: fromLeft ? 360 : -360,
    duration: 2000,
    repeat: -1,
  });
}
```

**Tumbleweed movement** is handled in the update loop (§7.3) via `velX` and `velY` data properties. It despawns when it exits the screen horizontally (`x < -100` or `x > 900`) or vertically (`y > DESPAWN_Y`).

**Player avoidance options:** Jump over it (ground-level obstacle — jump bypasses it) or position in a lane the tumbleweed won't cross through at the moment it arrives.

---

### Step 7.5 — Mechanics

#### 7.5.1 Lane Switching (A/D Keys) — Buffered

```javascript
switchLane(direction) {
  const newLane = this.currentLane + direction;
  if (newLane < 0 || newLane > 2) return;
  
  this.actionState = ACTION_STATE.SWITCHING;
  
  // Apply heavy-trot penalty if out of ammo
  const duration = this.ammoCount <= 0
    ? Math.round(SWITCH_DURATION * 1.2)  // 20% slower when no lead
    : SWITCH_DURATION;
  
  this.tweens.add({
    targets: this.cowboy,
    x: LANE_CENTERS[newLane],
    duration: duration,
    ease: 'Sine.easeInOut',
    onStart: () => { this.cowboy.angle = direction > 0 ? 5 : -5; },
    onComplete: () => {
      this.cowboy.angle = 0;
      this.currentLane = newLane;
      
      // Check for buffered input
      if (this.inputBuffer !== null) {
        const bufferedDir = this.inputBuffer;
        this.inputBuffer = null;
        this.switchLane(bufferedDir);  // Chain immediately
      } else {
        this.actionState = ACTION_STATE.IDLE;
      }
    },
  });
  
  // Tween shadow to match
  this.tweens.add({ targets: this.shadow, x: LANE_CENTERS[newLane], duration: duration });
}
```

#### 7.5.2 Jump Mechanic (W Key)

Uses a **scaling trick** — no actual Y-axis change. "Leaps over" ground-level obstacles only (cactus, tumbleweed). Tall hazards (wagon, wanted sign) still collide.

```javascript
jump() {
  this.actionState = ACTION_STATE.JUMPING;
  
  // Cowboy scale up/down
  this.tweens.add({
    targets: this.cowboy,
    scaleX: 1.4, scaleY: 1.4,
    duration: JUMP_DURATION / 2,
    yoyo: true,
    ease: 'Quad.easeOut',
    onComplete: () => {
      this.actionState = ACTION_STATE.IDLE;
    },
  });
  
  // Shadow shrinks + fades during jump
  this.tweens.add({
    targets: this.shadow,
    scaleX: 0.5, scaleY: 0.5,
    alpha: 0.2,
    duration: JUMP_DURATION / 2,
    yoyo: true,
    ease: 'Quad.easeOut',
  });
}
```

While `actionState === JUMPING`, collision callback filters by obstacle type —only ground-level hazards are bypassed (see §7.6.1).

#### 7.5.3 Quick-Draw Mechanic (Shift Key)

```javascript
quickDraw() {
  if (this.ammoCount <= 0) {
    // Heavy-trot penalty: no ammo = slower lane switches (20% penalty applied in switchLane)
    // Visual/audio feedback that gun is empty (click sound, sprite shake)
    return;
  }
  
  this.actionState = ACTION_STATE.SHOOTING;
  this.ammoCount--;
  
  // Quick-draw pose (cowboy_actions frame 0)
  this.cowboy.setTexture('cowboy-actions', 0);
  this.time.delayedCall(SHOOT_DURATION, () => {
    this.cowboy.setTexture('cowboy-gallop', 0);
    this.cowboy.play('gallop');
    this.actionState = ACTION_STATE.IDLE;
  });
  
  // Muzzle flash VFX
  const flash = this.add.sprite(this.cowboy.x, this.cowboy.y - 20, 'vfx');
  flash.play('muzzle-flash');
  flash.once('animationcomplete', () => flash.destroy());
  
  // Screen shake
  this.cameras.main.shake(100, 0.01);
  
  // Fire bullet upward
  const bullet = this.bulletPool.getFirstDead(false);
  if (!bullet) return;
  bullet.setPosition(this.cowboy.x, this.cowboy.y - 30);
  bullet.setActive(true).setVisible(true);
  bullet.body.enable = true;
  bullet.body.setVelocity(0, -BULLET_SPEED);
}
```

**Bullet vs Barrel collision (`handleBulletHit`):**

```javascript
handleBulletHit(bullet, obstacle) {
  if (obstacle.getData('type') !== 'barrel') return;
  
  // Destroy barrel
  obstacle.setActive(false).setVisible(false);
  obstacle.body.enable = false;
  
  // Explosion VFX
  const puff = this.add.sprite(obstacle.x, obstacle.y, 'vfx');
  puff.play('explosion');
  puff.once('animationcomplete', () => puff.destroy());
  
  // Splinter particles (3-4 small sprites with random velocity)
  for (let i = 0; i < 4; i++) {
    const splinter = this.add.sprite(obstacle.x, obstacle.y, 'obstacles', 1);
    splinter.setScale(0.3);
    this.tweens.add({
      targets: splinter,
      x: obstacle.x + Phaser.Math.Between(-60, 60),
      y: obstacle.y + Phaser.Math.Between(-60, 60),
      alpha: 0,
      duration: 400,
      onComplete: () => splinter.destroy(),
    });
  }
  
  // Screen shake
  this.cameras.main.shake(100, 0.01);
  
  // Bonus points
  this.score += 100;
  
  // Disable bullet
  bullet.setActive(false).setVisible(false);
  bullet.body.enable = false;
}
```

**Heavy-Trot Penalty (Zero Ammo):**
When `ammoCount === 0`, lane-switch duration increases by 20% (`SWITCH_DURATION * 1.2`). This creates pressure to catch rabbits for ammo recovery.

#### 7.5.4 Lasso Mechanic (Space Key)

Targets rabbits in the margins (far-left `X < 180` or far-right `X > 620`). Uses a quadratic Bezier arc for the throw trajectory.

```javascript
throwLasso() {
  const rabbit = this.findNearestRabbit();
  if (!rabbit) return;
  
  this.actionState = ACTION_STATE.LASSOING;
  
  // Lasso aim + throw (cowboy_actions frame 1 -> 2)
  this.cowboy.setTexture('cowboy-actions', 1);
  this.time.delayedCall(90, () => this.cowboy.setTexture('cowboy-actions', 2));
  this.time.delayedCall(LASSO_DURATION, () => {
    this.cowboy.setTexture('cowboy-gallop', 0);
    this.cowboy.play('gallop');
    this.actionState = ACTION_STATE.IDLE;
  });
  
  // Lasso throw arc (quadratic Bezier)
  const lasso = this.add.sprite(this.cowboy.x, this.cowboy.y, 'vfx', 6);
  
  // Bezier control points:
  // P0 = cowboy position
  // P1 = elevated midpoint (arc peak)
  // P2 = rabbit position
  const midX = (this.cowboy.x + rabbit.x) / 2;
  const midY = Math.min(this.cowboy.y, rabbit.y) - 60;  // arc above both
  
  // Animate along quadratic Bezier
  // B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
  let t = 0;
  const arcTimer = this.time.addEvent({
    delay: 16,
    repeat: 15,  // ~250ms at 60fps
    callback: () => {
      t += 1/16;
      const ct = Phaser.Math.Clamp(t, 0, 1);
      const oneMinusT = 1 - ct;
      lasso.x = oneMinusT * oneMinusT * this.cowboy.x + 2 * oneMinusT * ct * midX + ct * ct * rabbit.x;
      lasso.y = oneMinusT * oneMinusT * this.cowboy.y + 2 * oneMinusT * ct * midY + ct * ct * rabbit.y;
    },
  });
  
  // On arc complete, check hit
  this.time.delayedCall(260, () => {
    const dist = Phaser.Math.Distance.Between(lasso.x, lasso.y, rabbit.x, rabbit.y);
    if (dist < 40) {
      // HIT: Catch rabbit
      rabbit.setActive(false).setVisible(false);
      this.score += 500;
      this.ammoCount = Math.min(this.ammoCount + LEAD_RECOVERY, 6);  // Ammo economy
      EventBus.emit(EVENTS.SCORE_UPDATED, { score: this.score, ammo: this.ammoCount });
      
      // 0.5s global slowdown (bullet-time) for safe recovery
      const savedSpeed = this.gameSpeed;
      this.gameSpeed *= 0.3;
      this.time.delayedCall(500, () => { this.gameSpeed = savedSpeed; });
      
      // Retract lasso with "caught" indicator
      this.tweens.add({
        targets: lasso, x: this.cowboy.x, y: this.cowboy.y,
        duration: 300, onComplete: () => lasso.destroy(),
      });
    } else {
      // MISS: Lasso retracts
      this.tweens.add({
        targets: lasso, x: this.cowboy.x, y: this.cowboy.y,
        duration: 200, onComplete: () => lasso.destroy(),
      });
    }
  });
}
```

#### 7.5.5 Rabbit Spawning — Checkpoint-Gated Special Encounters

Rabbits are **rare, special encounters** tied to score checkpoints. They do NOT spawn on a regular timer.

**Checkpoint thresholds:** `[5000, 25000, 80000, 200000, 500000]`

When the player's score crosses a checkpoint threshold, a single rabbit spawns in one of the margins. The player must lasso it before it exits the screen. Missing a rabbit means waiting until the next checkpoint.

```javascript
checkRabbitCheckpoint() {
  if (this.nextRabbitCheckpointIndex >= RABBIT_CHECKPOINTS.length) return;
  
  const threshold = RABBIT_CHECKPOINTS[this.nextRabbitCheckpointIndex];
  if (this.score >= threshold) {
    this.nextRabbitCheckpointIndex++;
    this.spawnRabbit();
    
    // Visual/audio cue: "RABBIT!" flash text
    this.showRabbitAlert();
  }
}

spawnRabbit() {
  // Spawn on left or right margin
  const side = Phaser.Math.Between(0, 1);
  const x = side === 0 ? Phaser.Math.Between(20, 140) : Phaser.Math.Between(660, 780);
  
  const rabbit = this.add.sprite(x, -30, 'rabbit');
  rabbit.play('rabbit-run');
  rabbit.setData('isRabbit', true);
  rabbit.setActive(true).setVisible(true);
  
  // Move downward through the margin
  this.tweens.add({
    targets: rabbit,
    y: 650,
    duration: ((650 + 30) / this.gameSpeed) * 1000,
    onComplete: () => rabbit.destroy(),
  });
}

showRabbitAlert() {
  // Flash "RABBIT!" text near top of screen
  const alert = this.add.text(400, 100, 'RABBIT!', {
    fontFamily: 'monospace', fontSize: '32px', color: '#FFD700',
    stroke: '#000', strokeThickness: 4,
  }).setOrigin(0.5);
  
  this.tweens.add({
    targets: alert,
    alpha: 0, y: 60,
    duration: 1200,
    ease: 'Quad.easeOut',
    onComplete: () => alert.destroy(),
  });
}
```

After all defined checkpoints are exhausted, no more rabbits spawn unless the checkpoint array is extended.

---

### Step 7.6 — The "Stun" Mechanic & Death Sequence

#### 7.6.1 Collision Handler (Jump-Aware, Type-Filtered)

```javascript
handleCollision(cowboy, obstacle) {
  if (this.isGameOver) return;
  if (!obstacle.active) return;
  
  const obstacleType = obstacle.getData('type');
  
  // Jump bypass: only ground-level hazards (cactus, tumbleweed)
  if (this.actionState === ACTION_STATE.JUMPING) {
    if (obstacleType === 'cactus' || obstacleType === 'tumbleweed') {
      this.handleNearMiss(obstacle);
      return;  // Jumped over it
    }
    // Tall obstacles (wagon, sign) still collide during jump — fall through to death
  }
  
  this.triggerDeath();
}

handleNearMiss(obstacle) {
  // Check proximity for near-miss bonus
  const dist = Phaser.Math.Distance.Between(this.cowboy.x, this.cowboy.y, obstacle.x, obstacle.y);
  if (dist < NEAR_MISS_THRESHOLD + 30) {
    this.score += 50;
    // "WHEW!" floating text
    const text = this.add.text(this.cowboy.x, this.cowboy.y - 50, '+50 WHEW!', {
      fontFamily: 'monospace', fontSize: '16px', color: '#FFD700',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: text, alpha: 0, y: text.y - 40,
      duration: 800, onComplete: () => text.destroy(),
    });
    
    // Extra dust burst
    this.spawnDustPuff(this.cowboy.x - 10, this.cowboy.y + 20);
    this.spawnDustPuff(this.cowboy.x + 10, this.cowboy.y + 20);
  }
}
```

#### 7.6.2 Death Trigger — Full Failure Sequence

```javascript
triggerDeath() {
  this.isGameOver = true;
  
  // 1. Freeze frame (~100ms perceptual pause)
  // Pause physics immediately (visual freeze), keep scene clock active for delayed sequencing.
  this.physics.world.pause();
  
  // 2. Impact camera shake
  this.cameras.main.shake(200, 0.02);
  
  // 3. Freeze game systems
  this.gameSpeed = 0;
  this.cowboy.anims.pause();
  
  // 4. Spawn orbiting stun stars
  this.spawnStunStars();
  
  // 5. Emit PLAYER_DIED after full sequence (~1.5s)
  // Persistence routing happens in React bridge layer:
  //   - Authenticated → API submit via bridge adapter
  //   - Guest → local high-score/profile update via adapter
  this.time.delayedCall(1500, () => {
    const timePlayed = Math.floor((Date.now() - this.startTime) / 1000);
    EventBus.emit(EVENTS.PLAYER_DIED, { score: this.score, timePlayed });
  });
}
```

#### 7.6.3 Orbiting Stun Stars

```javascript
spawnStunStars() {
  const starCount = 3;
  this.stunStars = [];
  
  for (let i = 0; i < starCount; i++) {
    const star = this.add.sprite(this.cowboy.x, this.cowboy.y - 40, 'vfx', 7);
    star.setData('angle', (i / starCount) * Math.PI * 2);  // Evenly spaced
    this.stunStars.push(star);
  }
  
  // Manual animation via timer (scene physics is paused)
  this.stunTimer = this.time.addEvent({
    delay: 16,  // ~60fps
    loop: true,
    callback: () => {
      this.stunStars.forEach(star => {
        const angle = star.getData('angle') + 0.05;
        star.setData('angle', angle);
        star.x = this.cowboy.x + Math.cos(angle) * 30;
        star.y = (this.cowboy.y - 40) + Math.sin(angle) * 10;
      });
    },
  });
}
```

Stars orbit in a 16-bit ellipse: wide X radius (30px), narrow Y radius (10px).

---

### Step 7.7 — Juice Engine (VFX & Psychological Responsiveness)

| Effect | Trigger | Implementation |
|---|---|---|
| **Screen Shake** | Quick-Draw hit, barrel explosion, player death | `this.cameras.main.shake(duration, intensity)` |
| **Speed Lines** | `gameSpeed > 600` | Spawn 1px white lines at screen edges, move down at `gameSpeed * 2`. Reclaim off-screen. |
| **Dust Generation** | Gallop frames 0 & 2 | Spawn `dust-puff` animation near hooves. Pool-based, auto-reclaim. |
| **Obstacle Scale-Up** | All obstacles during approach | Perspective interpolation 0.2 → 1.0 (see §1.5) |
| **Near-Miss Bonus** | Hoof-box passes within < 15px of obstacle for ≥ 3 frames | `+50 WHEW!` floating text, extra dust burst (see §7.7.3) |
| **Bullet-Time** | Rabbit caught by lasso | 0.5s global slowdown (speed × 0.3) for safe recovery |
| **Tumbleweed Roll** | Tumbleweed crossing screen | Continuous rotation tween (§7.4.2) |
| **Rabbit Alert** | Checkpoint rabbit spawns | `"RABBIT!"` gold flash text (§7.5.5) |

#### 7.7.1 Dust Puff (Pooled)

```javascript
spawnDustPuff(x, y) {
  const puff = this.dustPool.getFirstDead(false);
  if (!puff) return;
  puff.setPosition(x, y).setScale(0.6).setAlpha(1);
  puff.setActive(true).setVisible(true);
  puff.play('dust-puff');
  puff.once('animationcomplete', () => {
    puff.setActive(false).setVisible(false);
  });
}
```

#### 7.7.2 Speed Line Helper

```javascript
spawnSpeedLine() {
  if (Phaser.Math.Between(0, 10) > 2) return;  // Sparse spawning
  const x = Phaser.Math.Between(0, 1) === 0 ? Phaser.Math.Between(0, 50) : Phaser.Math.Between(750, 800);
  const line = this.add.rectangle(x, -10, 1, Phaser.Math.Between(20, 60), 0xFFFFFF, 0.3);
  this.tweens.add({
    targets: line,
    y: 650,
    duration: (660 / (this.gameSpeed * 2)) * 1000,
    onComplete: () => line.destroy(),
  });
}
```

#### 7.7.3 Near-Miss Detection (Per-Frame Check)

Near-miss applies when the hoof-box passes within `< 15px` of an obstacle for ≥ 3 frames without collision:

```javascript
checkNearMisses() {
  this.obstaclePool.getChildren().forEach(obs => {
    if (!obs.active) return;
    if (obs.y < 460 || obs.y > 540) return;  // Only check danger zone
    if (obs.getData('type') === 'barrel') return;  // Barrels are shot, not dodged
    
    const dist = Phaser.Math.Distance.Between(this.cowboy.x, this.cowboy.y, obs.x, obs.y);
    
    if (dist < NEAR_MISS_THRESHOLD && !obs.getData('nearMissTriggered')) {
      obs.setData('nearMissTriggered', true);
      obs.setData('nearMissFrames', 0);
    }
    
    if (obs.getData('nearMissTriggered')) {
      obs.setData('nearMissFrames', (obs.getData('nearMissFrames') || 0) + 1);
      if (obs.getData('nearMissFrames') >= 3 && !obs.getData('nearMissBonusGiven')) {
        obs.setData('nearMissBonusGiven', true);
        this.score += 50;
        
        // Float "+50 WHEW!" text
        const text = this.add.text(this.cowboy.x, this.cowboy.y - 50, '+50 WHEW!', {
          fontFamily: 'monospace', fontSize: '16px', color: '#FFD700',
          stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        this.tweens.add({
          targets: text, alpha: 0, y: text.y - 40,
          duration: 800, onComplete: () => text.destroy(),
        });
        this.spawnDustPuff(this.cowboy.x - 10, this.cowboy.y + 20);
        this.spawnDustPuff(this.cowboy.x + 10, this.cowboy.y + 20);
      }
    }
  });
}
```

---

## 8. Registry Entry

This game's entry in `src/games/registry.js` (defined in PLAN_BRIDGE.md §4.5):

```javascript
'dustbowl-dash': {
  title: 'Dustbowl Dash',
  description: 'Infinite runner in the wild west. Go the distance and lasso rabbits!',
  heroImage: '/assets/carousel/dustbowl-dash.png',
  carouselIcon: '/assets/carousel/dustbowl-dash.png',
  config: {
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  },
  sceneImporter: async () => {
    const { BootScene } = await import('@/games/dustbowl-dash/scenes/BootScene');
    const { MainScene } = await import('@/games/dustbowl-dash/scenes/MainScene');
    return [BootScene, MainScene];
  },
},
```

---

## 9. EventBus Contract (What This Game Emits/Listens)

### Emits:
| Event | When | Payload |
|---|---|---|
| `GAME_READY` | After `BootScene.create()` transitions to `MainScene` and `MainScene.create()` completes | `void` |
| `SCORE_UPDATED` | Every 500ms during gameplay | `{ score: number, ammo: number }` |
| `PLAYER_DIED` | ~1.5s after collision (after full stun/failure sequence) | `{ score: number, timePlayed: number }` |

### Listens:
| Event | Response |
|---|---|
| `SYSTEM_PAUSE` | `this.scene.pause()` |
| `SYSTEM_RESUME` | `this.scene.resume()` |
| `GAME_RESTART` | `this.scene.restart()` |

---

## PHASE 9: Game Testing & Verification

### Step 9.1 — Verification Checklist

- [ ] Desert background scrolls vertically downward
- [ ] Cowboy on horse near bottom center, gallop animation loops
- [ ] A/D → lane switch with smooth tween + 5° tilt + input buffering
- [ ] W → jump (scale 1.0→1.4→1.0, shadow shrinks)
- [ ] Shift → fires bullet upward (muzzle flash, ammo decrements, shake)
- [ ] Bullet hits barrel → explosion (dust puff + splinters + shake + 100pts)
- [ ] Bullet hits non-barrel → nothing (bullet destroyed)
- [ ] Space → lasso thrown toward nearest margin rabbit (Bezier arc)
- [ ] Lasso hits rabbit → +500pts, +2 ammo, 0.5s bullet-time, rabbit captured
- [ ] Lasso misses → retracts visually
- [ ] Obstacles spawn distance-based, scale 0.2→1.0 via perspective interpolation
- [ ] Tumbleweed crosses screen horizontally with slight Y drift + rolling rotation
- [ ] Rabbit only appears at score checkpoints (5k, 25k, 80k, 200k, 500k)
- [ ] "RABBIT!" alert flashes when checkpoint rabbit spawns
- [ ] **Action conflicts enforced:** can't jump while switching, can't shoot while jumping, etc.
- [ ] Only lane switch can be buffered (during SWITCHING state); all else blocked
- [ ] Jump bypasses cactus/tumbleweed but NOT wagon/sign
- [ ] Near-miss bonus (+50 WHEW!) triggers when dodging within 15px for ≥3 frames
- [ ] Collision → freeze frame → shake → stun stars → 1.5s delay → PLAYER_DIED
- [ ] Surge-and-rest pacing: speed surges every 30s, capped at 950 px/s
- [ ] Spawn gap tightens each cycle (600 → 420 minimum)
- [ ] Pattern deck produces solvable obstacle layouts (golden solvability check)
- [ ] Dust puffs on gallop frames 0/2 (pooled, not created per-frame)
- [ ] Speed lines appear at high speed (>600 px/s)
- [ ] Score emitted every 500ms (not per frame)
- [ ] Anti-tunneling stretch applied to obstacles near player zone at high speed
- [ ] Zero ammo → 20% slower lane switch duration (heavy-trot penalty)
- [ ] Hoof-box collision (40×30), not full-sprite overlap
- [ ] SYSTEM_PAUSE pauses the scene; SYSTEM_RESUME resumes
- [ ] GAME_RESTART restarts the scene (all state reset)

---

## KEY GAME RULES (Do Not Violate)

1. **No `new Sprite()` in `update()`.** Use object pooling. Pool sizes: 30 obstacles, 5 wagons, 10 bullets, 20 dust puffs.
2. **No `setVelocityX()` for lane switching.** Use Tweens for precision.
3. **Delta-normalize all movement.** Multiply speed by `(delta / 1000)`.
4. **Never call fetch() or localStorage.** Emit events — the bridge handles persistence.
5. **Throttle `SCORE_UPDATED` to 500ms.** Never per-frame.
6. **Import EventBus from `@/lib/eventBus`.** Never create a new EventEmitter.
7. **All sprites from `/images/sprites/` using the specified files and exact dimensions.**
8. **Use fixed lane geometry:** track lines `[180,325,474,620]`, lane centers `[252,400,547]`.
9. **Jump bypasses ground-level obstacles only.** Cactus and tumbleweed — not wagon/sign. Scale trick only — no Y-axis change.
10. **Rabbits are checkpoint-gated.** They spawn only when score crosses `[5000, 25000, 80000, 200000, 500000]`. Never on a periodic timer.
11. **Tumbleweeds cross horizontally.** They enter from a screen edge and roll across with slight Y drift. Not spawned in lanes like other obstacles.
12. **Action state machine enforced.** No simultaneous actions. Jump blocks all. Shoot blocks all. Lasso blocks all. Lane switch allows only buffered lane switch.
13. **Named imports from Phaser.** Use `import { Scene } from 'phaser'` + `extends Scene`. Combined import (`import Phaser, { Scene } from 'phaser'`) when utility access is needed.
14. **Named class exports.** Use `export class BootScene extends Scene` (not `export default class`).
15. **Every spawned pattern must be solvable.** Validate reachability from current lane before committing. Impossible patterns are engine bugs.
16. **Surge-and-rest pacing.** No linear forever-acceleration. 30s cycles with surge (+75 px/s) and plateau. Hard cap at 950 px/s.
17. **Hoof-box collision (40×30).** Not full-sprite overlap. Apply anti-tunneling stretch at high speed.
18. **Architectural mandate: "The world scrolls, the player reacts, the engine validates."**
19. **Use `KeyCodes`-based keyboard binding.** Prefer `this.input.keyboard.addKeys({...Phaser.Input.Keyboard.KeyCodes...})` over string-only key literals.
20. **Clean up scene listeners on shutdown.** Any EventBus subscriptions created in `create()` must be removed in `this.events.once(Phaser.Scenes.Events.SHUTDOWN, ...)`.

---

## PHASE 10: Further Additions Implementation Plan (Concrete, Revised)

This revision incorporates all correction notes and supersedes the previous Phase 10 text.

### 10.0 Scope Lock (Revised)

Implement exactly these systems:

1. Interactive hazards/enemies:
   - `rock_bandit.png`
   - `quicksand.png`
   - `bison_totem.png`
2. Heist system:
   - `train_kit.png`
   - `cowboy_jump_to_train.png`
   - `cowboy_jump_to_horse.png`
   - `only_horse_running.png`
3. Collectibles/logistics:
   - `coin.png`
   - `bullet_refill.png`

Critical constraints:

- **Do not create a separate manager for bison/totem.** Integrate bison/totem into the existing obstacle pattern/spawner system.
- `quicksand` remains separate because it uses overlap/debuff logic.

---

### 10.1 Asset & Animation Integration

**Files:** `BootScene.js`, `GameConstants.js`

#### 10.1.1 Load New Spritesheets/Images
- `rock-bandit` (`100x100`, 5 frames)
- `quicksand` (`100x100`, 3 frames)
- `bison-totem` (`100x100`, 2 frames)
- `train-kit` (`150x300`, 3 frames)
- `cowboy-jump-to-train` (`64x64`, 2 frames)
- `cowboy-jump-to-horse` (`64x64`, 2 frames)
- `only-horse-running` (`64x512`, 2 frames)
- `coin` (`32x32`, single frame)
- `bullet-refill` (`100x100`, single frame)

#### 10.1.2 Define New Animations
- `quicksand-swirl` (0→1→2 loop)
- `bandit-cycle` (0→1→2→3→4 with fire timing state)
- `cowboy-leap-out` (0→1)
- `cowboy-leap-in` (0→1)
- `horse-only-run` (new horse-only running loop for heist phase)

#### 10.1.3 Add Constants
- Train event cadence, heist pattern cadence, bandit fire delay, quicksand debuff timing.
- Ammo refill gates:
  - `AMMO_REFILL_MIN_AMMO = 2`
  - `AMMO_REFILL_SCORE_INTERVAL = 1000`

---

### 10.2 Manager Layout (Revised)

**Create under:** `src/games/dustbowl-dash/managers/`

1. `TrainHeistManager.js`
   - event trigger, train chain spawn, leap-out/in flow, fail state.
2. `EnemyManager.js`
   - rock bandit behavior and hostile bullet emission.
3. `QuicksandManager.js`
   - quicksand overlap + slowdown + recovery.
4. `CollectibleManager.js`
   - coin + ammo refill spawning/collection.

No `HazardManager` for bison/totem; bison/totem are pattern entries handled by existing spawner/obstacle modules.

---

### 10.3 Great Train Heist (Corrected Behavior)

#### 10.3.1 Trigger
- Every ~60s (`trainCooldownMs`) when not game-over and not already in heist.

#### 10.3.2 Track Overlay + Train Chain
- Lane 0 railroad overlay enabled.
- Spawn train: engine (frame 0), 5–10 freight cars (frame 1), caboose (frame 2).
- Train speed = `gameSpeed * 0.85`.

#### 10.3.3 Leap Out (Horse → Train)
- `SPACE` jump-to-train is enabled **only when player is next to a freight car (frame 1)**.
- Jump-to-train is **not allowed** when side-by-side with engine.
- On leap-out, cowboy sprite transitions to train state and horse-only runner becomes active.

#### 10.3.4 Horse-Only Control While Cowboy Is On Train
- During train-roof/inside phase:
  - Allowed inputs: **left/right/jump** only.
  - Blocked inputs: **lasso/gun**.
- Horse uses `only_horse_running` animation.

#### 10.3.5 Escape (Train → Horse)
- When horse aligns with caboose zone, cowboy **auto-jumps back** to horse.
- No `SPACE` press required for return jump.
- Failure condition remains: if caboose exits and cowboy has not returned, trigger fail/death state.

#### 10.3.6 Heist-Only Pattern Deck
- During heist, disable normal obstacle pattern deck.
- Use **10 dedicated heist-safe patterns** (lanes 1/2 centered because lane 0 is train lane).
- Heist patterns must exclude barrels (cowboy unavailable for shooting).
- Heist patterns must pass solvability checks under horse-only controls.

---

### 10.4 Rock Bandit Ambush (Corrected Outcome)

#### 10.4.1 Spawn + State Machine
- Spawn as rock frame 0.
- At `Y≈200`, bandit enters peek/aim/fire window (frames 1–3), then reset frame 4 behavior.

#### 10.4.2 Hostile Shot
- If not neutralized in time, spawn southbound hostile bullet.

#### 10.4.3 Counterplay
- If player shoots bandit during early frames (before fire):
  - Bandit is removed.
  - **Rock remains on screen as a solid obstacle** and must still be dodged.
- Rock is not destroyed by successful anti-bandit shot.

---

### 10.5 Quicksand Trap (Control-Safe)

#### 10.5.1 Spawn & Visual
- `quicksand-swirl` overlap hazard, non-solid.

#### 10.5.2 Debuff Logic
- On overlap: apply 50% speed reduction for 2.5s.
- Show `Sinking!` feedback.
- Recover by tweening speed back after timer.
- Prevent debuff stacking.

#### 10.5.3 Input Guarantee
- While slowed by quicksand, player **must retain lane-switch control (left/right)**.
- Quicksand affects speed only; it does not disable steering input.

---

### 10.6 Bison/Totem Integration Into Existing Pattern System

#### 10.6.1 Obstacle Pool Integration
- Add bison skull and totem as new obstacle types within existing obstacle manager/spawner.
- Mix with legacy obstacle set (cactus, sign, barrel/tumbleweed where applicable by mode).

#### 10.6.2 Height/Bypass Rules
- Skull (`isTall=false`) remains jump-bypassable.
- Totem (`isTall=true`) remains jump-unsafe; must lane-switch.

#### 10.6.3 Pattern Variety Requirement
- Update standard pattern deck to include combined rows/segments using old + new types for higher variety without breaking solvability.

---

### 10.7 Consumables: Ammo Refill (Corrected Spawn Policy)

#### 10.7.1 Spawn Gate
- Ammo refill can spawn only when `ammoCount <= 2`.
- Randomized spawn point is allowed, but frequency is capped:
  - **max one ammo refill every 1000 score points**.
- Spawn lane/row must be validated clear.

#### 10.7.2 Collection Effect
- On collection: `ammoCount = 6`.
- Play reload cue and short readiness VFX.

---

### 10.8 Event/Spawner Coordination Rules (Revised)

1. During active heist:
   - Disable normal pattern deck.
   - Use 10 heist-specific patterns only.
2. During active tumbleweed lock:
   - Keep lock behavior (no conflicting row spawn).
3. During active rabbit:
   - Keep existing pattern pause behavior.
4. During quicksand debuff:
   - Preserve left/right input responsiveness.

All new patterns/spawns remain subject to solvability checks.

---

### 10.9 Data Model Additions

Each dynamic object should expose behavior flags:

- `type`
- `isTall`
- `isGroundBypassable`
- `isHostileProjectile`
- `isCollectible`
- `isHeistEntity`
- `isBanditNeutralized`
- `heistPatternOnly`

No behavior should depend on texture frame alone.

---

### 10.10 Integration Order (Implementation Sequence, Revised)

1. Asset + constants expansion (`BootScene`, `GameConstants`).
2. Integrate bison/totem into existing obstacle/spawner pattern system.
3. Implement `QuicksandManager` (debuff + control-safe behavior).
4. Implement `EnemyManager` for bandit and pre-fire neutralization behavior.
5. Implement `TrainHeistManager` with freight-only leap-out and auto caboose return.
6. Add 10 heist-only patterns (no barrels) and wire mode switching.
7. Implement ammo refill cadence policy (`<=2 ammo`, one per 1000 score).
8. Extend tests and perform balancing.

---

### 10.11 Testing Plan (Must Pass, Revised)

1. Bison/totem appear inside normal pattern deck mixed with legacy obstacle types.
2. Jumping can bypass skull but not totem.
3. Quicksand slows speed but left/right still works.
4. Jump-to-train prompt appears only beside freight cars, never beside engine.
5. Caboose alignment auto-returns cowboy to horse without input.
6. While cowboy is on train, horse accepts only left/right/jump.
7. Heist uses only 10 dedicated patterns and contains no barrels.
8. Bandit shot before fire removes bandit only; rock remains collidable.
9. Ammo refill appears only when ammo <=2 and at most once per 1000 score points.
10. Existing rabbit/tumbleweed/death sequence contracts remain valid.

---

### 10.12 Acceptance Criteria (Revised)

This phase is complete when:

- Bison/totem are integrated through existing pattern/spawner flow (no separate bison/totem manager).
- Heist entry/exit behavior exactly matches freight-only manual entry + caboose auto-return.
- Heist obstacle flow is isolated to 10 heist-safe, no-barrel patterns.
- Quicksand never blocks lane input.
- Bandit neutralization leaves rock obstacle active.
- Ammo refill cadence follows `ammo<=2` and one-spawn-per-1000-score rule.
