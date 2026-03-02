# PLAN_DUSTBOWL_DASH.md — Dustbowl Dash Game Cartridge

> **This document covers the Dustbowl Dash game only — all Phaser scenes, objects, mechanics, and VFX.**
> This game plugs into the emulator via the bridge contract defined in [PLAN_BRIDGE.md](PLAN_BRIDGE.md).
> For the emulator platform, see [PLAN_EMULATOR.md](PLAN_EMULATOR.md).

---

## 0. Game Overview

**Dustbowl Dash** is a wild-west-themed infinite runner viewed from a strict **90-degree Bird's-Eye (Top-Down)** perspective. The player controls a cowboy on horseback galloping "north" through an infinite orange desert, dodging obstacles across three lanes, shooting barrels, jumping over cacti, and lassoing rabbits for bonus points.

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

### 1.3 The Arena

A seamless, infinite orange desert:
- **Lanes:** Three vertical lanes defined by four parallel wagon wheel ruts (dark brown lines) carved into the sand.
- **Track Lines:** Manual X positions: `180`, `325`, `474`, `620`.
- **Lane Centers (Safe Spots):** `252` (left), `400` (middle), `547` (right).
- **Boundaries:** No canyons or walls. The desert floor extends to screen edges with static non-collidable "flavor" sprites (cracked earth, animal skulls).
- **The Illusion:** A `TileSprite` ground texture scrolls **vertically downward** (top-to-bottom).

### 1.4 Direction of Motion

Obstacles spawn at the **top** of the screen (`Y < 0`) and move **downward**. The player's horse faces "North" (top of screen). The world scrolls down to create the illusion of forward motion.

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
| `bullet.png` | `8 × 16` | Single image | Projectile (`velocityY = -800`) |
| `shadow.png` | `48 × 24` | Single image | Depth shadow (`alpha: 0.5`) |

> **CRITICAL:** Use these exact frame sizes in `this.load.spritesheet()` calls.

---

## 3. Player Character: The Cowboy & Horse

The sprite is a narrow, streamlined oblong rectangle facing "North." Approximately 1:3 width:height ratio.

### 3.1 Character States & Animations

| State | Animation | Visual Feedback |
|---|---|---|
| **Idle Gallop** | `cowboy_gallop` frames `0–3` | Frames `0` & `2`: hooves on ground (lowest). Frames `1` & `3`: legs extended (highest). |
| **Lane Switch** | Phaser Tween | Sprite moves to `targetX` over 150ms. Angle set to ±5° during move, then resets to 0°. |
| **The Jump** | Scaling trick | Scale: 1.0 → 1.4 → 1.0 over ~400ms. Shadow sprite underneath shrinks + alpha decreases (0.5 → 0.2). |
| **Quick-Draw** | `cowboy_actions` frame `0` | Revolver out, arm extended (SHIFT). |
| **Lasso Aim** | `cowboy_actions` frame `1` | Coiled rope held high while SPACE action is primed. |
| **Lasso Throw** | `cowboy_actions` frame `2` | Arm snapped forward on rabbit-target attempt. |

### 3.2 Shadow Sprite

A separate `shadow.png` oval (`48 × 24`) at 50% opacity, always positioned at `(cowboy.x, cowboy.y + 30)`.

During jump, keep the shadow at ground Y while the cowboy scales up to create the 3D height illusion.

---

## 4. Folder Structure (Game Only)

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

## 5. Boot Scene (Asset Preloader)

**File: `src/games/dustbowl-dash/scenes/BootScene.js`**

```javascript
export default class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  
  preload() {
    // Loading progress bar
    const bar = this.add.graphics();
    this.load.on('progress', (value) => {
      bar.clear();
      bar.fillStyle(0xF3A726, 1);
      bar.fillRect(200, 290, 400 * value, 20);
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

---

## 6. Main Scene — `create()` Setup

**File: `src/games/dustbowl-dash/scenes/MainScene.js`**

### 6.1 State Variables

```javascript
this.score = 0;
this.gameSpeed = 400;          // pixels/sec vertical scroll speed
this.isGameOver = false;
this.isSwitching = false;       // lane switch tween in progress
this.isJumping = false;         // jump tween in progress
this.currentLane = 1;           // 0=left, 1=middle, 2=right
this.ammoCount = 6;             // Quick-Draw bullets ("Lead")
this.trackLines = [180, 325, 474, 620];
this.lanes = [252, 400, 547];   // Safe centers for left/middle/right lanes
this.lastScoreEmit = 0;         // Throttle timestamp
this.startTime = Date.now();    // Session start — used for UserStat.totalTimePlayed
```

### 6.2 Background

```javascript
this.bg = this.add.tileSprite(0, 0, 800, 600, 'desert-bg').setOrigin(0, 0);
```

Scrolls **vertically** via `tilePositionY` in the update loop.

### 6.3 Lane Ruts

Four parallel dark brown lines using `this.add.graphics()` at fixed X positions:
```javascript
const ruts = this.add.graphics();
ruts.lineStyle(2, 0x4A2E15, 0.6);
// Draw 4 vertical lines defining the 3 lanes
this.trackLines.forEach(x => {
  ruts.moveTo(x, 0);
  ruts.lineTo(x, 600);
});
ruts.strokePath();
```

### 6.4 Player

```javascript
this.cowboy = this.physics.add.sprite(this.lanes[1], 500, 'cowboy-gallop');
this.cowboy.play('gallop');
this.shadow = this.add.image(this.lanes[1], 530, 'shadow').setAlpha(0.5);
```

### 6.5 Object Pools

```javascript
// Obstacles — unified pool
this.obstaclePool = this.physics.add.group({ maxSize: 15 });
for (let i = 0; i < 15; i++) {
  const obs = this.obstaclePool.create(0, -100, 'obstacles', 0);
  obs.setActive(false).setVisible(false);
  obs.body.enable = false;
}

// Wagon pool (separate heavy hazard texture)
this.wagonPool = this.physics.add.group({ maxSize: 4 });
for (let i = 0; i < 4; i++) {
  const wagon = this.wagonPool.create(0, -160, 'wagon');
  wagon.setActive(false).setVisible(false);
  wagon.body.enable = false;
}

// Bullets
this.bulletPool = this.physics.add.group({ maxSize: 6 });
for (let i = 0; i < 6; i++) {
  const b = this.bulletPool.create(0, -100, 'bullet');
  b.setActive(false).setVisible(false);
  b.body.enable = false;
}
```

### 6.6 Spawn Timers

```javascript
this.obstacleTimer = this.time.addEvent({
  delay: 1200,
  callback: this.spawnObstacle,
  callbackScope: this,
  loop: true,
});

this.rabbitTimer = this.time.addEvent({
  delay: 6000,
  callback: this.spawnRabbit,
  callbackScope: this,
  loop: true,
});
```

### 6.7 Collisions

```javascript
this.physics.add.overlap(this.cowboy, this.obstaclePool, this.handleCollision, null, this);
this.physics.add.overlap(this.bulletPool, this.obstaclePool, this.handleBulletHit, null, this);
```

### 6.8 Keyboard Input

```javascript
this.cursors = this.input.keyboard.createCursorKeys();
this.keyA = this.input.keyboard.addKey('A');
this.keyD = this.input.keyboard.addKey('D');
this.keyW = this.input.keyboard.addKey('W');
this.keyShift = this.input.keyboard.addKey('SHIFT');
this.keySpace = this.input.keyboard.addKey('SPACE');

// Use Phaser.Input.Keyboard.JustDown() in update loop for single-press actions
```

### 6.9 EventBus Listeners

```javascript
import { EventBus, EVENTS } from '@/lib/eventBus';

EventBus.on(EVENTS.SYSTEM_PAUSE, () => this.scene.pause());
EventBus.on(EVENTS.SYSTEM_RESUME, () => this.scene.resume());
EventBus.on(EVENTS.GAME_RESTART, () => this.scene.restart());

EventBus.emit(EVENTS.GAME_READY);
```

---

## 7. Main Scene — `update()` Game Loop

```javascript
update(time, delta) {
  if (this.isGameOver) return;
  
  const moveDistance = this.gameSpeed * (delta / 1000);
  
  // 1. Scroll background vertically
  this.bg.tilePositionY -= moveDistance;
  
  // 2. Increment distance-based score
  this.score += Math.floor(moveDistance / 10);
  
  // 3. Throttled EventBus emit (every 500ms)
  if (time - this.lastScoreEmit > 500) {
    EventBus.emit(EVENTS.SCORE_UPDATED, { score: this.score, ammo: this.ammoCount });
    this.lastScoreEmit = time;
  }
  
  // 4. Process input
  if (Phaser.Input.Keyboard.JustDown(this.keyA) || Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
    this.switchLane(-1);
  }
  if (Phaser.Input.Keyboard.JustDown(this.keyD) || Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
    this.switchLane(1);
  }
  if (Phaser.Input.Keyboard.JustDown(this.keyW) || Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
    this.jump();
  }
  if (Phaser.Input.Keyboard.JustDown(this.keyShift)) {
    this.quickDraw();
  }
  if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
    this.throwLasso();
  }
  
  // 5. Reclaim off-screen sprites
  this.obstaclePool.getChildren().forEach(obs => {
    if (obs.active && obs.y > 650) {
      obs.setActive(false).setVisible(false);
      obs.body.enable = false;
    }
  });
  this.bulletPool.getChildren().forEach(b => {
    if (b.active && b.y < -20) {
      b.setActive(false).setVisible(false);
      b.body.enable = false;
    }
  });
  
  // 6. Difficulty ramp
  this.gameSpeed += 0.02;
  
  // 7. Dust generation (on gallop frames 0 and 2)
  const gallopFrame = this.cowboy.anims.currentFrame?.index;
  if (gallopFrame === 0 || gallopFrame === 2) {
    this.spawnDustPuff(this.cowboy.x, this.cowboy.y + 20);
  }
  
  // 8. Speed lines at high speed
  if (this.gameSpeed > 600) {
    this.spawnSpeedLine();
  }
  
  // 9. Sync shadow position
  this.shadow.x = this.cowboy.x;
  this.shadow.y = this.cowboy.y + 30;
}
```

---

## 8. The Obstacle & Interaction Matrix

All hazards spawn at top (`Y < 0`), **scale up from 0.5 to 1.0** (depth illusion), move downward at `gameSpeed`.

| Obstacle | Visual | Player Action | Collision Result |
|---|---|---|---|
| **Saguaro Cactus** | Vertical green plant | **Jump** (W) | Hit = Stun → Game Over |
| **Explosive Barrel** | Wooden/iron barrel | **Quick-Draw** (Shift) | Hit = Stun → Game Over |
| **Wanted Sign** | Small hanging sign | **Lane Switch** (A/D) | Hit = Stun → Game Over |
| **Crashed Wagon** | `wagon.png` (`200 × 140`, blocks 2 lanes) | **Early Lane Choice** | Hit = Stun → Game Over |
| **Tumbleweed** | Beige scrub ball | **Diagonal Dodge** | Hit = Stun → Game Over |

### Spawn Logic (`spawnObstacle`)

```javascript
spawnObstacle() {
  const obs = this.obstaclePool.getFirstDead(false);
  if (!obs) return;  // Pool exhausted
  
  // Random type (weighted)
  const types = ['cactus','cactus','barrel','barrel','sign','sign','wagon','tumbleweed'];
  const type = Phaser.Utils.Array.GetRandom(types);
  
  // Wagon uses separate texture/pool
  if (type === 'wagon') {
    const wagon = this.wagonPool.getFirstDead(false);
    if (!wagon) return;
    const pair = Phaser.Math.Between(0, 1); // left pair or right pair
    wagon.x = (this.lanes[pair] + this.lanes[pair + 1]) / 2;
    wagon.y = -120;
    wagon.setActive(true).setVisible(true);
    wagon.body.enable = true;
    wagon.body.velocity.y = this.gameSpeed;
    return;
  }

  // Assign frame based on obstacles.png (4 frames)
  const frameMap = { cactus: 0, barrel: 1, sign: 2, tumbleweed: 3 };
  obs.setFrame(frameMap[type]);
  obs.setData('type', type);
  
  // Position
  const laneIndex = Phaser.Math.Between(0, 2);
  obs.x = this.lanes[laneIndex];
  obs.y = -50;
  
  // Activate
  obs.setScale(0.5);
  obs.setActive(true).setVisible(true);
  obs.body.enable = true;
  obs.body.velocity.y = this.gameSpeed;

  if (type === 'tumbleweed') {
    // Tumbleweed drifts diagonally
    obs.body.velocity.x = Phaser.Math.Between(-120, 120);
  }
  
  // Scale-up tween (depth illusion)
  this.tweens.add({
    targets: obs,
    scaleX: 1, scaleY: 1,
    duration: (550 / this.gameSpeed) * 1000,  // Scale as it approaches
    ease: 'Linear',
  });
}
```

---

## 9. Mechanics

### 9.1 Lane Switching (A/D Keys)

```javascript
switchLane(direction) {
  const newLane = this.currentLane + direction;
  if (newLane < 0 || newLane > 2 || this.isSwitching) return;
  
  this.isSwitching = true;
  
  this.tweens.add({
    targets: this.cowboy,
    x: this.lanes[newLane],
    duration: 150,
    ease: 'Sine.easeInOut',
    onStart: () => { this.cowboy.angle = direction > 0 ? 5 : -5; },
    onComplete: () => {
      this.isSwitching = false;
      this.cowboy.angle = 0;
      this.currentLane = newLane;
    },
  });
  
  // Tween shadow to match
  this.tweens.add({ targets: this.shadow, x: this.lanes[newLane], duration: 150 });
}
```

### 9.2 Jump Mechanic (W Key)

Uses a **scaling trick** — no actual Y-axis change. "Leaps over" ground-level obstacles.

```javascript
jump() {
  if (this.isJumping) return;
  this.isJumping = true;
  
  // Cowboy scale up/down
  this.tweens.add({
    targets: this.cowboy,
    scaleX: 1.4, scaleY: 1.4,
    duration: 200,
    yoyo: true,
    ease: 'Quad.easeOut',
    onComplete: () => { this.isJumping = false; },
  });
  
  // Shadow shrinks + fades
  this.tweens.add({
    targets: this.shadow,
    scaleX: 0.5, scaleY: 0.5,
    alpha: 0.2,
    duration: 200,
    yoyo: true,
    ease: 'Quad.easeOut',
  });
}
```

While `this.isJumping === true`, the collision callback (`handleCollision`) returns early → cactus passes under.

### 9.3 Quick-Draw Mechanic (Shift Key)

```javascript
quickDraw() {
  if (this.ammoCount <= 0) return;
  this.ammoCount--;
  
  // Quick-draw pose (cowboy_actions frame 0)
  this.cowboy.setTexture('cowboy-actions', 0);
  this.time.delayedCall(200, () => {
    this.cowboy.setTexture('cowboy-gallop', 0);
    this.cowboy.play('gallop');
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
  bullet.body.velocity.y = -800;
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

### 9.4 Lasso Mechanic (Space Key)

Rabbits run **only in margins** (far-left `X < 150` or far-right `X > 650`, outside the lane ruts).

```javascript
throwLasso() {
  // Find nearest active rabbit
  const rabbit = this.findNearestRabbit();
  if (!rabbit) return;
  
  // Lasso aim + throw (cowboy_actions frame 1 -> 2)
  this.cowboy.setTexture('cowboy-actions', 1);
  this.time.delayedCall(90, () => this.cowboy.setTexture('cowboy-actions', 2));
  this.time.delayedCall(300, () => {
    this.cowboy.setTexture('cowboy-gallop', 0);
    this.cowboy.play('gallop');
  });
  
  // Create lasso loop sprite (vfx frame 6)
  const lasso = this.add.sprite(this.cowboy.x, this.cowboy.y, 'vfx', 6);
  
  // Tween lasso toward rabbit
  this.tweens.add({
    targets: lasso,
    x: rabbit.x,
    y: rabbit.y,
    duration: 250,
    onComplete: () => {
      // Check distance for hit
      const dist = Phaser.Math.Distance.Between(lasso.x, lasso.y, rabbit.x, rabbit.y);
      if (dist < 40) {
        // HIT: Catch rabbit
        rabbit.setActive(false).setVisible(false);
        this.score += 500;
        EventBus.emit(EVENTS.SCORE_UPDATED, { score: this.score, ammo: this.ammoCount });
        // Tween lasso + "caught" indicator back to player
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
    },
  });
}
```

### 9.5 Rabbit Spawning

```javascript
spawnRabbit() {
  // Spawn on left or right margin
  const side = Phaser.Math.Between(0, 1);
  const x = side === 0 ? Phaser.Math.Between(20, 140) : Phaser.Math.Between(660, 780);
  
  const rabbit = this.add.sprite(x, -30, 'rabbit');
  rabbit.play('rabbit-run');
  rabbit.setData('isRabbit', true);
  
  // Move downward
  this.tweens.add({
    targets: rabbit,
    y: 650,
    duration: (650 + 30) / this.gameSpeed * 1000,
    onComplete: () => rabbit.destroy(),
  });
}
```

---

## 10. The "Stun" Mechanic (Game Over)

### Collision Handler

```javascript
handleCollision(cowboy, obstacle) {
  if (this.isGameOver || this.isJumping) return;
  if (!obstacle.active) return;
  
  this.isGameOver = true;
  
  // Freeze everything
  this.physics.pause();
  this.gameSpeed = 0;
  this.obstacleTimer.paused = true;
  this.rabbitTimer.paused = true;
  this.cowboy.anims.pause();
  
  // Spawn orbiting stars
  this.spawnStunStars();
  
  // Delayed death event (includes timePlayed for UserStat aggregation)
  this.time.delayedCall(1500, () => {
    const timePlayed = Math.floor((Date.now() - this.startTime) / 1000);
    EventBus.emit(EVENTS.PLAYER_DIED, { score: this.score, timePlayed });
  });
}
```

### Orbiting Stars

```javascript
spawnStunStars() {
  const starCount = 3;
  this.stunStars = [];
  
  for (let i = 0; i < starCount; i++) {
    const star = this.add.sprite(this.cowboy.x, this.cowboy.y - 40, 'vfx', 7);
    star.setData('angle', (i / starCount) * Math.PI * 2);  // Evenly spaced
    this.stunStars.push(star);
  }
  
  // Override update temporarily (scene is paused, use a timer for manual animation)
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

## 11. Procedural "Juice" (VFX)

| Effect | Trigger | Implementation |
|---|---|---|
| **Screen Shake** | Quick-Draw hit on barrel, player death | `this.cameras.main.shake(100, 0.01)` |
| **Speed Lines** | `gameSpeed > 600` | Spawn 1px white lines at screen edges, move down at `gameSpeed * 2`. Reclaim when off-screen. |
| **Dust Generation** | Gallop animation frames 0 & 2 | Spawn `dust-puff` animation near horse hooves. Auto-destroy on complete. |
| **Obstacle Scale-Up** | All obstacles, during approach | Tween scale 0.5 → 1.0 as obstacle moves from `Y = -50` to `Y = 500`. |

### Dust Puff Helper

```javascript
spawnDustPuff(x, y) {
  const puff = this.add.sprite(x, y, 'vfx');
  puff.setScale(0.6);
  puff.play('dust-puff');
  puff.once('animationcomplete', () => puff.destroy());
}
```

### Speed Line Helper

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

---

## 12. Registry Entry

This game's entry in `src/games/registry.js` (defined in PLAN_BRIDGE.md §7):

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
    const { default: BootScene } = await import('@/games/dustbowl-dash/scenes/BootScene');
    const { default: MainScene } = await import('@/games/dustbowl-dash/scenes/MainScene');
    return [BootScene, MainScene];
  },
},
```

---

## 13. EventBus Contract (What This Game Emits/Listens)

### Emits:
| Event | When | Payload |
|---|---|---|
| `GAME_READY` | After `BootScene.create()` transitions to `MainScene` and `MainScene.create()` completes | `void` |
| `SCORE_UPDATED` | Every 500ms during gameplay | `{ score: number, ammo: number }` |
| `PLAYER_DIED` | 1500ms after collision (after stun animation) | `{ score: number, timePlayed: number }` |

### Listens:
| Event | Response |
|---|---|
| `SYSTEM_PAUSE` | `this.scene.pause()` |
| `SYSTEM_RESUME` | `this.scene.resume()` |
| `GAME_RESTART` | `this.scene.restart()` |

---

## 14. Game Testing (Standalone)

The game can be tested independently of the emulator:

### Option A: In-emulator (normal flow)
1. `pnpm run dev` → navigate to `/play/dustbowl-dash`
2. Run through all mechanics

### Option B: Standalone HTML (mock EventBus)

Create a test file (not committed) that instantiates Phaser with BootScene + MainScene directly, using the mock EventBus from PLAN_BRIDGE.md §10.

### Verification Checklist:

- [ ] Desert background scrolls vertically downward
- [ ] Cowboy on horse near bottom center, gallop animation loops
- [ ] A/D → lane switch with smooth tween + 5° tilt
- [ ] W → jump (scale 1.0→1.4→1.0, shadow shrinks)
- [ ] Shift → fires bullet upward (muzzle flash, ammo decrements, shake)
- [ ] Bullet hits barrel → explosion (dust puff + splinters + shake + 100pts)
- [ ] Bullet hits non-barrel → nothing (bullet destroyed)
- [ ] Space → lasso thrown toward nearest margin rabbit
- [ ] Lasso hits rabbit → +500pts, rabbit captured
- [ ] Lasso misses → retracts visually
- [ ] Obstacles spawn at top, scale up 0.5→1.0 as they approach
- [ ] Collision (while not jumping) → freeze, orbiting stars, 1500ms delay, PLAYER_DIED
- [ ] Speed increases over time (gradual difficulty ramp)
- [ ] Dust puffs on gallop frames 0/2
- [ ] Speed lines appear at high speed
- [ ] Score emitted every 500ms (not per frame)
- [ ] SYSTEM_PAUSE pauses the scene; SYSTEM_RESUME resumes
- [ ] GAME_RESTART restarts the scene (score/ammo reset)

---

## KEY GAME RULES (Do Not Violate)

1. **No `new Sprite()` in `update()`.** Use object pooling for obstacles, bullets, VFX.
2. **No `setVelocityX()` for lane switching.** Use Tweens for precision.
3. **Delta-normalize all movement.** Multiply speed by `(delta / 1000)`.
4. **Never call fetch() or localStorage.** Emit events — the bridge handles persistence.
5. **Throttle `SCORE_UPDATED` to 500ms.** Never per-frame.
6. **Import EventBus from `@/lib/eventBus`.** Never create a new EventEmitter.
7. **All sprites from `/images/sprites/` using the specified files and exact dimensions.**
8. **Use fixed lane geometry:** track lines `[180,325,474,620]`, lane centers `[252,400,547]`.
9. **Jump disables collision, not position.** Scale trick only — no Y-axis change.
10. **Rabbits in margins only.** Never in the 3 lane ruts.
