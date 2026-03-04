
### 1. Interactive Hazards & Enemies

#### **`rock_bandit.png` (The Ambush)**
*   **Total Size:** 500 × 100 pixels.
*   **Frame Size:** 100 × 100 pixels (5 Columns, 1 Row).
*   **Contents:**
    *   **Frame 0:** Large jagged gray desert boulder.
    *   **Frame 1:** Bandit peeks eyes/hat over the top (North) edge of the rock.
    *   **Frame 2:** Bandit aims silver revolver South (toward the player).
    *   **Frame 3:** Muzzle flash (Frame 2 + yellow spark).
    *   **Frame 4:** Static boulder (Bandit hidden/reset).
*   **Usage:** Spawns in any lane. Fires a projectile South. If player shoots the bandit during frames 1–3, the bandit is removed and the rock becomes a pass-through decoration.

#### **`quicksand.png` (The Trap)**
*   **Total Size:** 300 × 100 pixels.
*   **Frame Size:** 100 × 100 pixels (3 Columns, 1 Row).
*   **Animation:** `quicksand-swirl` (Looping 0 → 1 → 2).
*   **Contents:** Dark terracotta sand with a deep brown vortex center. The spiral pattern rotates 120° per frame to simulate a sucking motion.
*   **Usage:** Overlap trigger. Reduces player `gameSpeed` by 50% for 2.5 seconds. Non-lethal.

#### **`bison_totem.png` (Static Expansion)**
*   **Total Size:** 200 × 100 pixels.
*   **Frame Size:** 100 × 100 pixels (2 Columns, 1 Row).
*   **Contents:**
    *   **Frame 0:** **Bison Skull.** Sun-bleached white bone, dark brown horns. (Low height — jumpable).
    *   **Frame 1:** **Totem Pole.** Red/Black eagle top view with horizontal wings extending to the edges of the 100px frame. (Tall height — must dodge).
*   **Usage:** Lane-specific obstacles using the "isTall" jump logic.

---

### 2. The Heist Kit

#### **`train_kit.png` (Modular Locomotive)**
*   **Total Size:** 450 × 300 pixels.
*   **Frame Size:** 150 × 300 pixels (3 Columns, 1 Row).
*   **Contents:**
    *   **Frame 0:** **Engine.** Front-facing cowcatcher and chimney at the BOTTOM (South) of the frame.
    *   **Frame 1:** **Freight Car.** Vertically tileable wooden roof.
    *   **Frame 2:** **Caboose.** Rear balcony and lantern at the TOP (North) of the frame.
*   **Usage:** Blocks Lane 0. 150px width matches the 145px lane width with a 5px safety buffer.

#### **`cowboy_jump_to_train.png` (The Leap Out)**
*   **Total Size:** 128 × 64 pixels.
*   **Frame Size:** 64 × 64 pixels (2 Columns, 1 Row).
*   **Contents:**
    *   **Frame 0:** Cowboy standing in saddle, tilted slightly West (Left).
    *   **Frame 1:** Cowboy mid-air, hat-centric view, arms reaching Left.
*   **Usage:** Played during the Horse-to-Train X-axis tween.

#### **`cowboy_jump_to_horse.png` (The Leap In)**
*   **Total Size:** 128 × 64 pixels.
*   **Frame Size:** 64 × 64 pixels (2 Columns, 1 Row).
*   **Contents:**
    *   **Frame 0:** Cowboy launching off train roof toward East (Right).
    *   **Frame 1:** Cowboy landing/sitting pose (tucked).
*   **Usage:** Played during the Train-to-Horse X-axis tween.

---

### 3. Collectibles

#### **`coin.png` (The Loot)**
*   **Total Size:** 32 × 32 pixels.
*   **Frame Size:** 32 × 32 pixels (Single Frame).
*   **Contents:** Gold bullion coin. Bright yellow center with a brown/bronze anti-aliased rim. Features a 1-pixel white glint on the top-left edge.
*   **Usage:** Particle effect. Sprays out of train cars during the heist; +100 points per coin collected by the horse's hitbox.

#### **`bullet_refill.png` (Ammo Stash)**
*   **Total Size:** 100 × 100 pixels.
*   **Frame Size:** 100 × 100 pixels (Single Frame).
*   **Contents:** A leather bandolier pouch stuffed with silver/lead bullets. Large, high-visibility icon for fast-moving gameplay.
*   **Usage:** Spawns rarely in center lane. Collision restores ammo to 6.

---

### 🛠 Technical Placement Guide (Pixel-Perfect)

| Asset | Grid Alignment | Center Point (X,Y) | Use Case |
| :--- | :--- | :--- | :--- |
| **Train Cars** | 150w x 300h | (75, 150) | Lane 0 ($X \approx 252$) |
| **Bandit/Skull** | 100w x 100h | (50, 50) | Lane Centers |
| **Cowboy Jump** | 64w x 64h | (32, 32) | Mid-tween transition |
| **Coin** | 32w x 32h | (16, 16) | Particle emitters |


### 1. The Great Train Heist (The Modular Logic)

The heist is a "scripted-random" event that pauses the standard obstacle spawner and replaces Lane 0 with the Railroad tracks.

#### **A. The Trigger & Entry**
*   **The Spawner:** Every ~60 seconds, the game triggers `startTrainEvent()`.
*   **The Visuals:** A railroad track `TileSprite` overlays the sand in **Lane 0 ($X \approx 252$)**.
*   **The Locomotive (`train_kit.png` Frame 0):** The Engine enters from $Y = -300$. Its speed is $85\%$ of the player's current speed, meaning the player "chases it down" from **Lane 1 ($X \approx 400$)**.
*   **The Chain:** The Engine is followed by 5–10 **Middle Cars (Frame 1)**.

#### **B. The Leap Out (`cowboy_jump_to_train.png`)**
*   **Action:** When the Cowboy is side-by-side with any part of the train (except the engine's front), a "JUMP" UI prompt appears.
*   **Input:** Player presses `SPACE`.
*   **Logic:**
    1.  The `cowboy_gallop` sprite is hidden.
    2.  The `horse_empty` sprite is activated at the player's current $X/Y$.
    3.  A new `jumping_cowboy` sprite uses `cowboy_jump_to_train.png`.
    4.  **Frame 0** plays as the cowboy stands up; **Frame 1** plays as a Tween moves him from $X = 400$ to $X = 252$ (onto the train roof) over 300ms.
    5.  Upon completion, the `jumping_cowboy` is hidden. The Cowboy is now "Inside/On top" of the train.

#### **C. The Looting Phase (`coin.png`)**
*   **The Fountain:** While the Cowboy is "inside," a particle emitter at the train's center sprays `coin.png` sprites into **Lane 1 and Lane 2**.
*   **Horse Control:** The player still controls the **Horse**. They must dodge obstacles in the remaining two lanes while positioning the horse to catch the flying coins.
*   **Score:** Each `coin.png` collected adds +100 points.

#### **D. The Escape (`cowboy_jump_to_horse.png`)**
*   **The Timer:** The **Caboose (`train_kit.png` Frame 2)** appears.
*   **Logic:** As the Caboose passes the horse, the player must be in **Lane 1** and press `SPACE`.
*   **Animation:** `cowboy_jump_to_horse.png` plays **Frame 0** (launching off) and **Frame 1** (landing) as he tweens back to the horse's back.
*   **Failure:** If the Caboose leaves the screen ($Y > 600$) and the Cowboy is still on the train, the game ends (Cowboy is kidnapped/stranded).

---

### 2. The Bandit Ambush (`rock_bandit.png`)

This is an "Active Threat" that punishes players who don't use their Quick-Draw.

*   **Placement:** Spawns like a standard 100x100 obstacle in any lane.
*   **Phase 1 (Hiding):** It enters the screen as a static **Rock (Frame 0)**.
*   **Phase 2 (The Peek):** When the Rock reaches $Y = 200$, the animation triggers. The Bandit peeks (**Frame 1**) and aims (**Frame 2**).
*   **Phase 3 (The Shot):** At **Frame 3 (Muzzle Flash)**, the Bandit spawns a `bullet.png` (reused from player assets but tinted Red) moving South at high speed.
*   **Interaction:**
    *   If the player shoots the Bandit (`SHIFT`) during **Frames 1, 2, or 3**, the Bandit is destroyed with a `dust-puff` VFX. The Rock remains but becomes "passable" (non-colliding).
    *   If the player hits the Rock while the Bandit is hidden: **Game Over**.

---

### 3. The Quicksand Trap (`quicksand.png`)

A tactical obstacle that makes the *next* threat more dangerous.

*   **Placement:** Spawns as a large 100x100 floor hazard.
*   **Visuals:** Plays the `swirl` animation (0-1-2) at a slow, hypnotic speed.
*   **Logic:**
    *   The game checks for an **Overlap** (not a collision) with the horse's hooves.
    *   **The Debuff:** On overlap, `this.gameSpeed` is instantly reduced by 50%. A "Sinking!" UI message appears.
    *   **The Recover:** After 2.5 seconds, the speed tweens back to normal.
    *   **The Trap:** Because the speed is slow, the player's "Distance per frame" is lower, but incoming obstacles still spawn at their normal rate—effectively "crowding" the screen.

---

### 4. Static Height Logic (`bison_totem.png`)

These assets teach the player when to jump and when to switch lanes.

*   **Bison Skull (Frame 0):**
    *   **Logic:** `isTall = false`. 
    *   **Interaction:** If the player is in the `jump` state (`W`), they pass over it safely. If they are on the ground, they crash.
*   **Totem Pole (Frame 1):**
    *   **Logic:** `isTall = true`.
    *   **Interaction:** Because the totem has "Wings" (visualized in the 100px width), it has a wider hitbox than a cactus. Even if the player is `jumping`, they hit the wings.
    *   **Player Action:** **Must** switch lanes (A/D). This is a "No-Jump Zone."

---

### 5. Consumable Logistics (`bullet_refill.png`)

This manages the "Lead" (Ammo) resource.

*   **Spawn Logic:** Only spawns if the player has **3 or fewer bullets** remaining. It always spawns in a "Clear Lane" (a lane with no other obstacles in that row).
*   **Interaction:** On collision, the player's `ammoCount` is reset to **6**.
*   **Visual Juice:** Upon collection, play a "Reload" sound effect and a quick `muzzle-flash` VFX at the player's hip to show they are ready to fire.

---

### 🛠 Summary Table of Asset Logic

| Asset | Collision Type | Action Required | Unique Logic |
| :--- | :--- | :--- | :--- |
| **Train Engine** | Solid | Evade | Only appears in Lane 0 during Heist. |
| **Rock Bandit** | Combat | Shoot or Evade | Fires back if not shot within 1 second. |
| **Quicksand** | Floor | Jump or Slow | Reduces speed; creates obstacle "clumping." |
| **Totem Pole** | Wall | Evade Only | Cannot be jumped; wider hitbox than cactus. |
| **Bison Skull** | Floor | Jump or Evade | Low-profile; safe to jump over. |
| **Ammo Pouch** | Trigger | Collect | Resets bullet count to max (6). |
| **Coins** | Trigger | Collect | High-frequency spawning during Heist. |