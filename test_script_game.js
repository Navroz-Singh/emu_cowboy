const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PATHS = {
  bootScene: path.join(ROOT, "src", "games", "dustbowl-dash", "scenes", "BootScene.js"),
  mainScene: path.join(ROOT, "src", "games", "dustbowl-dash", "scenes", "MainScene.js"),
  gameConstants: path.join(ROOT, "src", "games", "dustbowl-dash", "constants", "GameConstants.js"),
  playerController: path.join(ROOT, "src", "games", "dustbowl-dash", "managers", "PlayerController.js"),
  obstacleManager: path.join(ROOT, "src", "games", "dustbowl-dash", "managers", "ObstacleManager.js"),
  spawnerSystem: path.join(ROOT, "src", "games", "dustbowl-dash", "managers", "SpawnerSystem.js"),
  vfxManager: path.join(ROOT, "src", "games", "dustbowl-dash", "managers", "VFXManager.js"),
  registry: path.join(ROOT, "src", "games", "registry.js"),
  spritesDir: path.join(ROOT, "public", "sprites"),
};

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function has(text, regex) {
  return regex.test(text);
}

function testFilesAndAssets() {
  section("Files & Assets");

  Object.values(PATHS).forEach((p) => {
    if (p.endsWith(".js")) {
      assert(fs.existsSync(p), `Missing required file: ${p}`);
    }
  });

  const requiredSprites = [
    "desert-bg.png",
    "cowboy_gallop.png",
    "cowboy_actions.png",
    "obstacles.png",
    "wagon.png",
    "rabbit.png",
    "vfx.png",
    "bullet.png",
    "shadow.png",
  ];

  requiredSprites.forEach((file) => {
    const abs = path.join(PATHS.spritesDir, file);
    assert(fs.existsSync(abs), `Missing sprite asset: public/sprites/${file}`);
  });

  console.log("PASS: Required scene files and sprite assets exist");
}

function testBootSceneContracts() {
  section("BootScene Contracts");
  const source = read(PATHS.bootScene);

  assert(has(source, /SPRITES_BASE_PATH\s*=\s*["']\/sprites["']/), "BootScene must use /sprites base path");
  assert(!has(source, /\/images\/sprites\//), "BootScene should not reference /images/sprites paths");

  const keys = [
    "desert-bg",
    "cowboy-gallop",
    "cowboy-actions",
    "obstacles",
    "wagon",
    "rabbit",
    "vfx",
    "bullet",
    "shadow",
  ];

  keys.forEach((key) => {
    assert(has(source, new RegExp(`["']${key}["']`)), `BootScene missing expected asset key: ${key}`);
  });

  assert(has(source, /createAnimationIfPossible/), "BootScene should guard animation creation");
  assert(has(source, /EventBus\.emit\(EVENTS\.GAME_READY\)/), "BootScene should emit GAME_READY");
  assert(has(source, /this\.scene\.start\(["']MainScene["']\)/), "BootScene should transition to MainScene");

  console.log("PASS: BootScene load path and animation guards verified");
}

function testRegistryPixelArtConfig() {
  section("Registry PixelArt Config");
  const source = read(PATHS.registry);

  assert(has(source, /"dustbowl-dash"\s*:\s*\{/), "Registry missing dustbowl-dash entry");
  assert(has(source, /pixelArt\s*:\s*true/), "Dustbowl config must enable pixelArt");
  assert(has(source, /antialias\s*:\s*false/), "Dustbowl config should disable antialias for crisp pixel art");

  console.log("PASS: Dustbowl pixel-art rendering config verified");
}

function testMainScene72And73Contracts() {
  section("MainScene 7.2 + 7.3 Contracts");
  const source = read(PATHS.mainScene);

  ["ObstacleManager", "PlayerController", "SpawnerSystem", "VFXManager"].forEach((managerName) => {
    assert(has(source, new RegExp(`new\\s+${managerName}\\(`)), `MainScene should construct ${managerName}`);
  });

  ["initObjectPools", "initCollisions", "initKeyboard", "initBridgeListeners", "processInput", "updateSurgePacing"].forEach((symbol) => {
    assert(has(source, new RegExp(`\\.${symbol}\\(`)), `MainScene should orchestrate ${symbol}`);
  });

  assert(has(source, /this\.scoreCarry\s*\+=\s*moveAmount\s*\/\s*10/), "MainScene should accumulate score carry from distance");
  assert(has(source, /if\s*\(this\.scoreCarry\s*>=\s*1\)/), "MainScene should convert score carry into whole points");
  assert(has(source, /EVENTS\.SCORE_UPDATED/), "MainScene should emit SCORE_UPDATED");
  assert(has(source, /ammo:\s*this\.ammoCount/), "SCORE_UPDATED payload should include ammoCount");

  assert(has(source, /cleanupSceneSystems\(/), "MainScene should provide centralized cleanup");
  assert(has(source, /EventBus\.off\(EVENTS\.SYSTEM_PAUSE/), "MainScene cleanup should remove pause listener");
}

function testModularManagerContracts() {
  section("Modular Manager Contracts");

  const constantsSource = read(PATHS.gameConstants);
  const playerSource = read(PATHS.playerController);
  const obstacleSource = read(PATHS.obstacleManager);
  const spawnerSource = read(PATHS.spawnerSystem);
  const vfxSource = read(PATHS.vfxManager);

  assert(has(constantsSource, /SURGE_CYCLE:\s*30000/), "SURGE_CYCLE constant should be 30000ms");
  assert(has(constantsSource, /SURGE_INCREMENT:\s*75/), "SURGE_INCREMENT constant should be 75");
  assert(has(constantsSource, /LASSO_DURATION:\s*300/), "Lasso duration should be 300ms");
  assert(has(constantsSource, /WAGON_SCALE:\s*1\.5/), "Wagon scale should be 1.5");
  assert(has(constantsSource, /SIGN_SCALE:\s*1\.8/), "Wanted sign scale should be 1.8");
  assert(has(constantsSource, /TOTEM_SCALE:\s*1\.8/), "Totem scale should be 1.8");
  assert(has(constantsSource, /BASE_SPRITE_SCALE:\s*1\.2/), "Base sprite scale should be 1.2");
  assert(has(constantsSource, /CACTUS_SCALE:\s*1\.0/), "Cactus scale should be 1.0");

  assert(has(playerSource, /Phaser\.Input\.Keyboard\.JustDown/), "PlayerController should use JustDown input handling");
  assert(has(playerSource, /KeyCodes\.A/), "PlayerController should bind A key");
  assert(has(playerSource, /KeyCodes\.D/), "PlayerController should bind D key");
  assert(has(playerSource, /KeyCodes\.SPACE/), "PlayerController should bind SPACE key for jump");
  assert(has(playerSource, /KeyCodes\.E/), "PlayerController should bind E key for lasso");
  assert(has(playerSource, /KeyCodes\.F/), "PlayerController should bind F key for shoot");
  assert(!has(playerSource, /KeyCodes\.W/), "PlayerController should not bind W key after remap");
  assert(!has(playerSource, /KeyCodes\.SHIFT/), "PlayerController should not bind SHIFT key after remap");
  assert(has(playerSource, /direction\s*>\s*0\s*\?\s*20\s*:\s*-20/), "Lane switch tilt should be 20 degrees");
  assert(has(playerSource, /scaleX:\s*this\.scene\.constants\.BASE_SPRITE_SCALE\s*\*\s*1\.15/), "Jump height should scale from base sprite size");
  assert(has(playerSource, /y:\s*this\.scene\.shadowBaseY\s*\+\s*40/), "Jump should move shadow slightly north/backward");
  assert(has(playerSource, /repeat:\s*7/), "Lasso vibration tween should run long enough for visible feedback");
  assert(has(playerSource, /const\s+caught\s*=\s*this\.scene\.spawnerSystem\?\.handleRabbitCaught\(rabbit\)/), "Lasso catch should be deterministic when a rabbit target exists");
  assert(!has(playerSource, /dist\s*<\s*40\s*&&\s*this\.scene\.spawnerSystem\?\.handleRabbitCaught/), "Lasso catch should not use distance miss-gating");

  assert(has(obstacleSource, /maxSize:\s*30/), "Obstacle pool maxSize should be 30");
  assert(has(obstacleSource, /maxSize:\s*5/), "Wagon pool maxSize should be 5");
  assert(has(obstacleSource, /maxSize:\s*10/), "Bullet pool maxSize should be 10");
  assert(has(obstacleSource, /physicsWorld\?\.removeCollider/), "Cleanup must guard removeCollider against null physics world");
  assert(has(obstacleSource, /if\s*\(this\.scene\.actionState\s*===\s*ACTION_STATE\.JUMPING\)/), "Collision logic should branch on jumping state");
  assert(has(obstacleSource, /OBSTACLE_TYPE\.CACTUS/), "Jump bypass should include cactus");
  assert(has(obstacleSource, /OBSTACLE_TYPE\.TUMBLEWEED/), "Jump bypass should include tumbleweed");
  assert(has(obstacleSource, /configureObstacleHitbox\(/), "ObstacleManager should configure obstacle hitboxes by type");
  assert(has(obstacleSource, /configureWagonHitbox\(/), "ObstacleManager should configure wagon hitbox");
  assert(has(obstacleSource, /setCircle\(18,\s*22,\s*22\)/), "Tumbleweed should use tighter circular hitbox");
  assert(has(obstacleSource, /spawnBarrelHitVfx\(/), "Barrel impact should trigger VFX manager");
  assert(has(obstacleSource, /this\.scene\.cameras\?\.main\?\.shake\(100,\s*0\.01\)/), "Barrel hit should trigger impact shake");
  assert(has(obstacleSource, /this\.scene\.tweens\.pauseAll\(\)/), "Collision should pause tweens to fully freeze game state");
  assert(has(obstacleSource, /this\.scene\.physics\.world\.pause\(\)/), "Collision should pause physics world to fully freeze game state");
  assert(has(obstacleSource, /this\.scene\.time\.delayedCall\(1500/), "Death sequence should delay PLAYER_DIED event");
  assert(has(obstacleSource, /checkNearMisses\(/), "Obstacle manager should perform per-frame near-miss checks");
  assert(has(obstacleSource, /nearMissFrames/), "Near-miss logic should track sustained frames");
  assert(has(obstacleSource, /EventBus\.emit\(EVENTS\.SCORE_UPDATED,\s*\{\s*score:\s*this\.scene\.score,\s*ammo:\s*this\.scene\.ammoCount\s*\}\)/), "Near-miss reward should emit score update");
  assert(!has(obstacleSource, /getPerspectiveScale\(/), "Obstacle manager should not use perspective scaling");
  assert(!has(obstacleSource, /setScale\(this\.getPerspectiveScale/), "Obstacles should not grow by Y-position interpolation");
  assert(!has(obstacleSource, /80\s*\+\s*stretch/), "Dynamic hitbox stretching should be removed to prevent false collisions");
  assert(has(obstacleSource, /Phaser\.Math\.Between\(200,\s*350\)/), "Tumbleweed should use horizontal speed range");
  assert(has(obstacleSource, /obstacle\.setData\("velX"/), "Tumbleweed should persist horizontal velocity metadata");
  assert(has(obstacleSource, /obstacle\.setData\("velY"/), "Tumbleweed should persist vertical drift metadata");
  assert(has(obstacleSource, /Math\.floor\(this\.scene\.constants\.CANVAS_HEIGHT\s*\*\s*0\.25\)/), "Tumbleweed should spawn within top 25% Y window");

  assert(has(spawnerSource, /spawnObstaclePattern\(/), "SpawnerSystem should implement spawnObstaclePattern");
  assert(has(spawnerSource, /validatePattern\(/), "SpawnerSystem should implement validatePattern");
  assert(has(spawnerSource, /getRequiredSwitches\(/), "SpawnerSystem should implement required-switch computation");
  assert(has(spawnerSource, /spawnPatternRows\(/), "SpawnerSystem should implement spawn rollback-safe batch helper");
  assert(has(spawnerSource, /spawnInLane\(/), "SpawnerSystem should call lane spawner");
  assert(has(spawnerSource, /spawnWagon\(/), "SpawnerSystem should call wagon spawner");
  assert(has(spawnerSource, /spawnTumbleweed\(/), "SpawnerSystem should call tumbleweed spawner");
  assert(has(spawnerSource, /this\.tumbleweedPatternLockUntil/), "SpawnerSystem should maintain tumbleweed pattern lock state");
  assert(has(spawnerSource, /hasActiveTumbleweed\(/), "SpawnerSystem should detect active tumbleweeds");
  assert(has(spawnerSource, /if\s*\(this\.hasActiveRabbit\(\)\)\s*\{\s*return false;/), "SpawnerSystem should pause obstacle patterns while rabbit is active");
  assert(has(spawnerSource, /expiresAt",\s*this\.scene\.time\.now\s*\+\s*catchWindowMs/), "Rabbit lifetime should be capped at ~3 seconds");
  assert(has(spawnerSource, /laneIndex",\s*laneIndex/), "Rabbit should run on a random gameplay lane");
  assert(has(spawnerSource, /fontSize:\s*"32px"/), "Rabbit alert text should use visible flash styling");

  assert(has(vfxSource, /spawnStunStars\(/), "VFXManager should spawn stun stars on death");
  assert(has(vfxSource, /"vfx",\s*7/), "Stun stars should use vfx frame 7 when available");
  assert(has(vfxSource, /"vfx",\s*5/), "Barrel impact should use big bang frame from vfx sheet");
  assert(has(vfxSource, /if\s*\(Phaser\.Math\.Between\(0,\s*10\)\s*>\s*2\)\s*return;/), "Speed lines should spawn sparsely");
  assert(has(vfxSource, /duration\s*=\s*Math\.round\(\(660\s*\/\s*speedFactor\)\s*\*\s*1000\)/), "Speed line duration should scale with game speed");

  console.log("PASS: MainScene 7.2 and 7.3 contracts verified");
}

function run() {
  testFilesAndAssets();
  testBootSceneContracts();
  testRegistryPixelArtConfig();
  testMainScene72And73Contracts();
  testModularManagerContracts();

  section("Summary");
  console.log("DUSTBOWL GAME TESTS PASSED");
}

try {
  run();
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
