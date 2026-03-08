import { EVENTS, EventBus } from "@/lib/eventBus";

export class LaneCoinManager {
  constructor(scene) {
    this.scene = scene;

    this.coinPool = null;
    this.cowboyCoinOverlap = null;
  }

  initObjectPools() {
    const textureKey = this.scene.textures.exists("coin") ? "coin" : "__DEFAULT";

    this.coinPool = this.scene.physics.add.group({ maxSize: 22, runChildUpdate: false });
    for (let index = 0; index < 22; index += 1) {
      const coin = this.coinPool.create(0, -220, textureKey);
      if (!coin) continue;

      coin.setActive(false).setVisible(false);
      coin.setScale(1.15);
      coin.setDepth(12);
      coin.setData("isCollectible", true);
      coin.setData("type", "laneCoin");

      if (coin.body) {
        coin.body.enable = false;
      }
    }
  }

  initCollisions() {
    if (!this.scene.physics?.add || !this.scene.cowboy || !this.coinPool?.children?.entries) return;

    this.cowboyCoinOverlap = this.scene.physics.add.overlap(
      this.scene.cowboy,
      this.coinPool,
      this.handleCoinCollected,
      undefined,
      this,
    );
  }

  cleanup() {
    const physicsWorld = this.scene.physics?.world;
    if (this.cowboyCoinOverlap && physicsWorld?.removeCollider) {
      physicsWorld.removeCollider(this.cowboyCoinOverlap);
    }
    this.cowboyCoinOverlap = null;

    const coins = this.getCoins();
    for (let index = 0; index < coins.length; index += 1) {
      const coin = coins[index];
      if (!coin?.active) continue;
      this.disableCoin(coin);
    }

    this.coinPool = null;
  }

  update(_dt, moveAmount) {
    const coins = this.getCoins();

    for (let index = 0; index < coins.length; index += 1) {
      const coin = coins[index];
      if (!coin?.active) continue;

      coin.y += moveAmount;
      if (coin.y > this.scene.constants.DESPAWN_Y + 40) {
        this.disableCoin(coin);
      }
    }
  }

  clearAllCoins() {
    const coins = this.getCoins();
    for (let index = 0; index < coins.length; index += 1) {
      const coin = coins[index];
      if (!coin?.active) continue;
      this.disableCoin(coin);
    }
  }

  spawnInLane(laneIndex, yOffset = 0) {
    if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex > 2) return null;
    if (!this.coinPool?.children?.entries) return null;

    const coin = this.coinPool.getFirstDead(false);
    if (!coin) return null;

    coin.setPosition(this.scene.lanes[laneIndex], this.scene.constants.SPAWN_Y + Number(yOffset || 0));
    coin.setActive(true).setVisible(true);
    coin.setScale(1.15);

    if (coin.body) {
      coin.body.enable = true;
      coin.body.setAllowGravity(false);
      coin.body.setVelocity(0, 0);
      coin.body.setCircle(15, 1, 1);
    }

    return coin;
  }

  getActiveCoinCount() {
    const coins = this.getCoins();
    let activeCount = 0;
    for (let index = 0; index < coins.length; index += 1) {
      if (coins[index]?.active) activeCount += 1;
    }
    return activeCount;
  }

  handleCoinCollected = (_cowboy, coin) => {
    if (!coin?.active || this.scene.hasDied || this.scene.isGameOver) return;

    this.disableCoin(coin);

    const coinValue = Number(this.scene.constants.COIN_LANE_SCORE_VALUE || 10);
    this.scene.score += coinValue;
    this.scene.coinsCollected = Number(this.scene.coinsCollected || 0) + 1;

    EventBus.emit(EVENTS.SCORE_UPDATED, {
      score: this.scene.score,
      ammo: this.scene.ammoCount,
      rabbitsCollected: Number(this.scene.rabbitsCollected || 0),
      coinsCollected: Number(this.scene.coinsCollected || 0),
    });
  };

  disableCoin(coin) {
    if (!coin) return;

    coin.setActive(false).setVisible(false);

    if (coin.body) {
      coin.body.enable = false;
      coin.body.setVelocity(0, 0);
    }
  }

  getCoins() {
    const entries = this.coinPool?.children?.entries;
    return Array.isArray(entries) ? entries : [];
  }
}
