const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;

const PATHS = {
  persistence: path.join(ROOT, "src", "lib", "persistence.js"),
  eventBus: path.join(ROOT, "src", "lib", "eventBus.js"),
  emulatorStore: path.join(ROOT, "src", "store", "emulatorStore.js"),
  arcadeStore: path.join(ROOT, "src", "store", "arcadeStore.js"),
  registry: path.join(ROOT, "src", "games", "registry.js"),
  gameWrapper: path.join(ROOT, "src", "components", "emulator", "GameWrapper.jsx"),
  systemOverlay: path.join(ROOT, "src", "components", "emulator", "SystemOverlay.jsx"),
  layout: path.join(ROOT, "src", "app", "layout.js"),
  homePage: path.join(ROOT, "src", "app", "page.js"),
  playClient: path.join(ROOT, "src", "app", "play", "[gameId]", "PlayClient.jsx"),
  screenClient: path.join(ROOT, "src", "components", "ArcadeScreenClient.jsx"),
  cabinetShell: path.join(ROOT, "src", "components", "cabinet", "CabinetShell.jsx"),
  screenFrame: path.join(ROOT, "src", "components", "cabinet", "ScreenFrame.jsx"),
  navbar: path.join(ROOT, "src", "components", "ui", "Navbar.jsx"),
  gameCarousel: path.join(ROOT, "src", "components", "ui", "GameCarousel.jsx"),
  gameCarouselIcon: path.join(ROOT, "src", "components", "ui", "GameCarouselIcon.jsx"),
  peephole: path.join(ROOT, "src", "components", "ui", "PeepholeTransition.jsx"),
  allGames: path.join(ROOT, "src", "components", "views", "AllGamesView.jsx"),
  leaderboards: path.join(ROOT, "src", "components", "views", "LeaderboardsView.jsx"),
  community: path.join(ROOT, "src", "components", "views", "CommunityView.jsx"),
  profile: path.join(ROOT, "src", "components", "views", "ProfileView.jsx"),
  authModal: path.join(ROOT, "src", "components", "auth", "AuthModal.jsx"),
  loginForm: path.join(ROOT, "src", "components", "auth", "LoginForm.jsx"),
  registerForm: path.join(ROOT, "src", "components", "auth", "RegisterForm.jsx"),
  useDebounce: path.join(ROOT, "src", "hooks", "useDebounce.js"),
  useLeaderboard: path.join(ROOT, "src", "hooks", "useLeaderboard.js"),
  scoresRoute: path.join(ROOT, "src", "app", "api", "v1", "scores", "[gameId]", "route.js"),
  savesRoute: path.join(ROOT, "src", "app", "api", "v1", "saves", "[gameId]", "route.js"),
};

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function printSection(name) {
  console.log(`\n=== ${name} ===`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} | expected=${expected} actual=${actual}`);
  }
}

function transformExportedFunctions(source) {
  const exported = [];

  let transformed = source.replace(/export\s+async\s+function\s+(\w+)\s*\(/g, (_, name) => {
    exported.push(name);
    return `async function ${name}(`;
  });

  transformed = transformed.replace(/export\s+function\s+(\w+)\s*\(/g, (_, name) => {
    exported.push(name);
    return `function ${name}(`;
  });

  transformed = transformed.replace(/export\s+const\s+(\w+)\s*=\s*/g, (_, name) => {
    exported.push(name);
    return `const ${name} = `;
  });

  const lines = [...new Set(exported)].map((name) => `exports.${name} = ${name};`).join("\n");
  return `${transformed}\n${lines}\n`;
}

function createStorageMock() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
    dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

function createFetchMock() {
  const calls = [];

  const mock = async (url, options = {}) => {
    const method = (options.method || "GET").toUpperCase();
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ url, method, body });

    if (url.startsWith("/api/v1/scores/")) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { success: true, url, method, body };
        },
      };
    }

    if (url.startsWith("/api/v1/saves/") && method === "POST") {
      return {
        ok: true,
        status: 200,
        async json() {
          return { success: true, updatedAt: new Date().toISOString() };
        },
      };
    }

    if (url.startsWith("/api/v1/saves/") && method === "GET") {
      return {
        ok: true,
        status: 200,
        async json() {
          return { success: true, state: { restored: true }, updatedAt: new Date().toISOString() };
        },
      };
    }

    return {
      ok: false,
      status: 404,
      async json() {
        return { error: "Not found" };
      },
    };
  };

  mock.calls = calls;
  return mock;
}

function createZustandCreateMock() {
  return function create(initializer) {
    let state;

    const getState = () => state;
    const setState = (updater) => {
      const partial = typeof updater === "function" ? updater(state) : updater;
      state = { ...state, ...(partial || {}) };
      return state;
    };

    state = initializer(setState, getState);

    const store = (selector = (value) => value) => selector(state);
    store.getState = getState;
    store.setState = setState;

    return store;
  };
}

function loadPersistenceModule({ storage, fetch }) {
  const source = readText(PATHS.persistence);
  const transformed = transformExportedFunctions(source);

  const context = {
    exports: {},
    module: { exports: {} },
    window: { localStorage: storage },
    localStorage: storage,
    fetch,
    console,
    Date,
    JSON,
    Number,
    BigInt,
    Math,
    Object,
    Array,
    String,
    Boolean,
    Promise,
    Error,
    setTimeout,
    clearTimeout,
  };

  vm.createContext(context);
  vm.runInContext(transformed, context, { filename: "persistence.runtime.js" });

  return context.exports;
}

function loadStoreModule(filePath, exportName) {
  const source = readText(filePath)
    .replace(/import\s+[^;]+;\s*/g, "")
    .replace(/import\s+\{\s*create\s*\}\s+from\s+"zustand";?/g, "")
    .replace(new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*`, "g"), `const ${exportName} = `)
    .concat(`\nexports.${exportName} = ${exportName};\n`);

  const context = {
    exports: {},
    module: { exports: {} },
    create: createZustandCreateMock(),
    TABS: {
      ALL_GAMES: "ALL_GAMES",
      LEADERBOARDS: "LEADERBOARDS",
      COMMUNITY: "COMMUNITY",
      PROFILE: "PROFILE",
    },
    window: { setTimeout },
    setTimeout,
    clearTimeout,
    Number,
    Math,
    Object,
    console,
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: `${exportName}.runtime.js` });
  return context.exports[exportName];
}

function createHeaders(initial = {}) {
  const map = new Map(Object.entries(initial).map(([k, v]) => [String(k).toLowerCase(), String(v)]));
  return {
    get(name) {
      return map.get(String(name).toLowerCase()) ?? null;
    },
  };
}

function createRequest({ url, method = "GET", headers = {}, body } = {}) {
  return {
    url,
    method,
    headers: createHeaders(headers),
    async json() {
      return body;
    },
  };
}

function transformRouteSource(source) {
  return source
    .replace(/import\s+\{\s*auth\s*\}\s+from\s+"@\/lib\/auth";?/g, "const { auth } = __mocks;")
    .replace(/import\s+\{\s*GAME_REGISTRY\s*\}\s+from\s+"@\/games\/registry";?/g, "const { GAME_REGISTRY } = __mocks;")
    .replace(/import\s+prisma\s+from\s+"@\/lib\/prisma";?/g, "const { prisma } = __mocks;")
    .replace(/export\s+async\s+function\s+(GET|POST)\s*\(/g, "async function $1(")
    .concat("\nexports.GET = GET;\nexports.POST = POST;\n");
}

function loadRouteModule(filePath, mocks) {
  const source = transformRouteSource(readText(filePath));
  const context = {
    __mocks: mocks,
    exports: {},
    module: { exports: {} },
    URL,
    Date,
    Number,
    BigInt,
    Math,
    Object,
    Array,
    String,
    Boolean,
    Promise,
    Response,
    console,
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: path.basename(filePath) });
  return context.exports;
}

function createAuthMock(userId = null) {
  return {
    api: {
      async getSession() {
        if (!userId) return null;
        return { user: { id: userId } };
      },
    },
  };
}

function createScoresPrismaMock() {
  const calls = {
    findMany: [],
    findUnique: [],
    leaderboardCreate: [],
    leaderboardUpdate: [],
    scoreLogCreate: [],
    userStatUpsert: [],
  };

  const prisma = {
    leaderboardEntry: {
      async findMany(args) {
        calls.findMany.push(args);
        return [
          {
            userId: "user_1",
            value: 1000,
            countryCode: "US",
            achievedAt: new Date("2026-03-01T00:00:00.000Z"),
            user: { id: "user_1", name: "ALPHA", image: null },
          },
        ];
      },
      async findUnique(args) {
        calls.findUnique.push(args);
        return null;
      },
      async create(args) {
        calls.leaderboardCreate.push(args);
        return args.data;
      },
      async update(args) {
        calls.leaderboardUpdate.push(args);
        return args.data;
      },
    },
    scoreLog: {
      async create(args) {
        calls.scoreLogCreate.push(args);
        return { id: "score_1", ...args.data };
      },
    },
    userStat: {
      async upsert(args) {
        calls.userStatUpsert.push(args);
        return { userId: args.where.userId };
      },
    },
  };

  return { prisma, calls };
}

function createSavesPrismaMock() {
  const calls = { findUnique: [], upsert: [] };

  const prisma = {
    gameSave: {
      async findUnique(args) {
        calls.findUnique.push(args);
        return null;
      },
      async upsert(args) {
        calls.upsert.push(args);
        return { updatedAt: new Date("2026-03-03T00:00:00.000Z"), ...args.create };
      },
    },
  };

  return { prisma, calls };
}

async function responseJson(response) {
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}

function testFilePresence() {
  printSection("File Presence");

  const requiredFiles = [
    PATHS.useDebounce,
    PATHS.useLeaderboard,
    PATHS.peephole,
    PATHS.scoresRoute,
    PATHS.savesRoute,
    PATHS.layout,
    PATHS.homePage,
    PATHS.navbar,
    PATHS.gameCarousel,
    PATHS.gameCarouselIcon,
    PATHS.allGames,
    PATHS.leaderboards,
    PATHS.community,
    PATHS.profile,
    PATHS.loginForm,
    PATHS.registerForm,
    PATHS.authModal,
  ];

  for (const filePath of requiredFiles) {
    assert(fs.existsSync(filePath), `Missing required file: ${path.relative(ROOT, filePath)}`);
  }

  console.log("PASS: Required Phase 1-6 files present");
}

async function testPersistenceAdapter() {
  printSection("Phase 3: Persistence Adapter");

  const storage = createStorageMock();
  const fetch = createFetchMock();
  const api = loadPersistenceModule({ storage, fetch });

  const expectedFns = [
    "submitScore",
    "getLocalHighScore",
    "getLocalStats",
    "saveGameState",
    "loadGameState",
    "migrateLocalDataToServer",
  ];

  for (const name of expectedFns) {
    assert(typeof api[name] === "function", `Missing export ${name}`);
  }

  await api.submitScore("dustbowl-dash", 100, null, 12);
  await api.submitScore("dustbowl-dash", 250, null, 20);
  await api.submitScore("dustbowl-dash", 180, null, 8);

  const localHigh = await api.getLocalHighScore("dustbowl-dash");
  assertEqual(localHigh, 250, "Guest high score should be max local score");

  const stats = api.getLocalStats();
  assertEqual(stats.gamesPlayed, 3, "Local gamesPlayed mismatch");
  assertEqual(stats.totalTimePlayed, 40, "Local totalTimePlayed mismatch");
  assertEqual(stats.totalScore, "530", "Local totalScore mismatch");

  const saveResult = await api.saveGameState("dustbowl-dash", { checkpoint: 2 }, null);
  assert(saveResult.success === true, "Guest saveGameState should succeed");

  const loadedGuest = await api.loadGameState("dustbowl-dash", null);
  assert(loadedGuest?.state?.checkpoint === 2, "Guest loadGameState should return saved state");

  const user = { id: "user_123" };
  await api.submitScore("dustbowl-dash", 999, user, 99);
  await api.saveGameState("dustbowl-dash", { checkpoint: 9 }, user);
  const loadedUser = await api.loadGameState("dustbowl-dash", user);
  assert(loadedUser.success === true, "Authenticated loadGameState should use API");

  const migration = await api.migrateLocalDataToServer({ id: "user_migrate" });
  assert(migration.migrated === true, "Migration should succeed with user");

  const postMigrationStats = api.getLocalStats();
  assertEqual(postMigrationStats.gamesPlayed, 0, "Local stats should reset after migration");

  assert(fetch.calls.some((call) => call.url.startsWith("/api/v1/scores/")), "Expected score API call in authenticated path");
  assert(fetch.calls.some((call) => call.url.startsWith("/api/v1/saves/")), "Expected save API call in authenticated path");

  console.log("PASS: Persistence adapter runtime behavior");
}

function testStoresAndBridgeContracts() {
  printSection("Phase 4: Bridge & Stores");

  const eventBusSource = readText(PATHS.eventBus);
  const registrySource = readText(PATHS.registry);
  const gameWrapperSource = readText(PATHS.gameWrapper);
  const overlaySource = readText(PATHS.systemOverlay);

  assert(eventBusSource.includes("class Emitter"), "EventBus should use internal Emitter class");
  assert(!eventBusSource.includes("from \"phaser\""), "EventBus should be SSR-safe and not import Phaser directly");

  const requiredEvents = [
    "GAME_READY",
    "GAME_START",
    "SCORE_UPDATED",
    "PLAYER_DIED",
    "SAVE_REQUESTED",
    "SYSTEM_PAUSE",
    "SYSTEM_RESUME",
    "GAME_RESTART",
  ];

  for (const key of requiredEvents) {
    assert(eventBusSource.includes(`${key}:`), `Missing event key ${key}`);
  }

  assert(registrySource.includes('"dustbowl-dash"'), "Registry should include dustbowl-dash");
  assert(registrySource.includes("const { BootScene } = await import"), "Registry should use named BootScene import");
  assert(registrySource.includes("const { MainScene } = await import"), "Registry should use named MainScene import");

  assert(/import\s+\{[^}]*AUTO[^}]*Game[^}]*Scale[^}]*\}\s+from\s+"phaser";/.test(gameWrapperSource), "GameWrapper should use named Phaser imports");
  assert(gameWrapperSource.includes("Scale.FIT"), "GameWrapper should use Scale.FIT");
  assert(gameWrapperSource.includes("Scale.CENTER_BOTH"), "GameWrapper should use centered scaling");
  assert(gameWrapperSource.includes("gameRef.current.destroy(true)"), "GameWrapper should destroy game on cleanup");

  assert(overlaySource.includes("EventBus.on(EVENTS.SCORE_UPDATED"), "SystemOverlay must subscribe SCORE_UPDATED");
  assert(overlaySource.includes("EventBus.on(EVENTS.PLAYER_DIED"), "SystemOverlay must subscribe PLAYER_DIED");
  assert(overlaySource.includes("await submitScore(gameId, finalScore, user, timePlayed)"), "SystemOverlay should persist score");
  assert(overlaySource.includes("await saveGameState(gameId, state, user)"), "SystemOverlay should persist save states");

  const emulatorStore = loadStoreModule(PATHS.emulatorStore, "useEmulatorStore");
  const storeState = emulatorStore.getState();

  assert(typeof storeState.togglePause === "function", "emulatorStore missing togglePause");
  assert(typeof storeState.setPaused === "function", "emulatorStore missing setPaused");
  assert(typeof storeState.setScore === "function", "emulatorStore missing setScore");
  assert(typeof storeState.setAmmo === "function", "emulatorStore missing setAmmo");
  assert(typeof storeState.reset === "function", "emulatorStore missing reset");

  assertEqual(storeState.togglePause(), true, "togglePause should return next state true");
  assertEqual(emulatorStore.getState().isPaused, true, "togglePause should set paused=true");
  assertEqual(emulatorStore.getState().togglePause(), false, "togglePause should return next state false");

  emulatorStore.getState().setScore(40);
  emulatorStore.getState().setScore(10);
  assertEqual(emulatorStore.getState().highScore, 40, "highScore should retain max score");

  emulatorStore.getState().setAmmo(-8);
  assertEqual(emulatorStore.getState().ammoCount, 0, "Ammo should clamp to 0");

  const arcadeStore = loadStoreModule(PATHS.arcadeStore, "useArcadeStore");
  assert(typeof arcadeStore.getState().setActiveTab === "function", "arcadeStore missing setActiveTab");
  assert(typeof arcadeStore.getState().setSelectedGame === "function", "arcadeStore missing setSelectedGame");

  console.log("PASS: Bridge contracts + store runtime behavior");
}

async function testPhase5ApiRoutes() {
  printSection("Phase 5: API Routes");

  const GAME_REGISTRY = {
    "dustbowl-dash": { id: "dustbowl-dash" },
    pong: { id: "pong" },
  };

  {
    const { prisma, calls } = createScoresPrismaMock();
    const route = loadRouteModule(PATHS.scoresRoute, {
      auth: createAuthMock("user_1"),
      GAME_REGISTRY,
      prisma,
    });

    const notFound = await responseJson(
      await route.GET(createRequest({ url: "http://localhost/api/v1/scores/unknown" }), {
        params: Promise.resolve({ gameId: "unknown" }),
      }),
    );
    assertEqual(notFound.status, 404, "scores GET should 404 unknown game");

    const list = await responseJson(
      await route.GET(createRequest({ url: "http://localhost/api/v1/scores/dustbowl-dash?limit=2&country=us" }), {
        params: Promise.resolve({ gameId: "dustbowl-dash" }),
      }),
    );
    assertEqual(list.status, 200, "scores GET should return 200");
    assertEqual(list.body.success, true, "scores GET should return success");
    assert(calls.findMany.length === 1, "scores GET should query leaderboardEntry.findMany");
    assertEqual(calls.findMany[0].take, 2, "scores GET should honor limit query");
    assertEqual(calls.findMany[0].where.countryCode, "US", "scores GET should normalize country filter");

    const cacheControl = list.headers.get("cache-control");
    assertEqual(cacheControl, "public, s-maxage=60, stale-while-revalidate=30", "scores GET cache header mismatch");

    const unauthorized = await responseJson(
      await loadRouteModule(PATHS.scoresRoute, {
        auth: createAuthMock(null),
        GAME_REGISTRY,
        prisma,
      }).POST(createRequest({
        url: "http://localhost/api/v1/scores/dustbowl-dash",
        method: "POST",
        body: { value: 100, timePlayed: 10 },
      }), {
        params: Promise.resolve({ gameId: "dustbowl-dash" }),
      }),
    );
    assertEqual(unauthorized.status, 401, "scores POST should 401 without session");

    const bad = await responseJson(
      await route.POST(createRequest({
        url: "http://localhost/api/v1/scores/dustbowl-dash",
        method: "POST",
        body: { value: 0, timePlayed: 10 },
      }), {
        params: Promise.resolve({ gameId: "dustbowl-dash" }),
      }),
    );
    assertEqual(bad.status, 400, "scores POST should validate positive score");

    const ok = await responseJson(
      await route.POST(createRequest({
        url: "http://localhost/api/v1/scores/dustbowl-dash",
        method: "POST",
        headers: { "x-vercel-ip-country": "br" },
        body: { value: 1200, timePlayed: 55 },
      }), {
        params: Promise.resolve({ gameId: "dustbowl-dash" }),
      }),
    );

    assertEqual(ok.status, 200, "scores POST success should 200");
    assertEqual(ok.body.success, true, "scores POST should return success");
    assert(typeof ok.body.leaderboardUpdated === "boolean", "scores POST should return leaderboardUpdated boolean");
    assert(calls.scoreLogCreate.length === 1, "scores POST should create scoreLog");
    assert(calls.userStatUpsert.length === 1, "scores POST should upsert userStat");
  }

  {
    const { prisma, calls } = createSavesPrismaMock();
    const route = loadRouteModule(PATHS.savesRoute, {
      auth: createAuthMock("user_1"),
      GAME_REGISTRY,
      prisma,
    });

    const missing = await responseJson(
      await route.GET(createRequest({ url: "http://localhost/api/v1/saves/unknown" }), {
        params: Promise.resolve({ gameId: "unknown" }),
      }),
    );
    assertEqual(missing.status, 404, "saves GET should 404 unknown game");

    const unauth = await responseJson(
      await loadRouteModule(PATHS.savesRoute, {
        auth: createAuthMock(null),
        GAME_REGISTRY,
        prisma,
      }).GET(createRequest({ url: "http://localhost/api/v1/saves/dustbowl-dash" }), {
        params: Promise.resolve({ gameId: "dustbowl-dash" }),
      }),
    );
    assertEqual(unauth.status, 401, "saves GET should 401 unauthenticated");

    const getSave = await responseJson(
      await route.GET(createRequest({ url: "http://localhost/api/v1/saves/dustbowl-dash" }), {
        params: Promise.resolve({ gameId: "dustbowl-dash" }),
      }),
    );
    assertEqual(getSave.status, 200, "saves GET should return 200");
    assertEqual(getSave.body.success, true, "saves GET should return success");

    const badState = await responseJson(
      await route.POST(createRequest({
        url: "http://localhost/api/v1/saves/dustbowl-dash",
        method: "POST",
        body: { state: [] },
      }), {
        params: Promise.resolve({ gameId: "dustbowl-dash" }),
      }),
    );
    assertEqual(badState.status, 400, "saves POST should reject array state payload");

    const saveOk = await responseJson(
      await route.POST(createRequest({
        url: "http://localhost/api/v1/saves/dustbowl-dash",
        method: "POST",
        body: { state: { level: 2 } },
      }), {
        params: Promise.resolve({ gameId: "dustbowl-dash" }),
      }),
    );
    assertEqual(saveOk.status, 200, "saves POST should return 200");
    assertEqual(saveOk.body.success, true, "saves POST should return success");
    assert(typeof saveOk.body.updatedAt === "string", "saves POST should return updatedAt");
    assert(calls.upsert.length === 1, "saves POST should call gameSave.upsert");
  }

  console.log("PASS: API route runtime tests");
}

function testPhase6ShellContracts() {
  printSection("Phase 6: Frontend Shell Contracts");

  const layout = readText(PATHS.layout);
  const page = readText(PATHS.homePage);
  const screenClient = readText(PATHS.screenClient);
  const cabinetShell = readText(PATHS.cabinetShell);
  const screenFrame = readText(PATHS.screenFrame);
  const navbar = readText(PATHS.navbar);
  const carousel = readText(PATHS.gameCarousel);
  const carouselIcon = readText(PATHS.gameCarouselIcon);
  const allGames = readText(PATHS.allGames);
  const leaderboards = readText(PATHS.leaderboards);
  const community = readText(PATHS.community);
  const profile = readText(PATHS.profile);
  const authModal = readText(PATHS.authModal);
  const login = readText(PATHS.loginForm);
  const register = readText(PATHS.registerForm);
  const debounce = readText(PATHS.useDebounce);
  const hookLeaderboard = readText(PATHS.useLeaderboard);
  const peephole = readText(PATHS.peephole);
  const playClient = readText(PATHS.playClient);

  assert(layout.includes("Press_Start_2P") && layout.includes("Rye"), "layout should load Press_Start_2P and Rye fonts");
  assert(layout.includes('title: "Nexus Arcade"'), "layout metadata title mismatch");

  assert(page.includes("prisma.userStat.findUnique"), "home page should fetch userStat SSR");
  assert(page.includes("totalScore: rawUserStat.totalScore.toString()"), "home page should convert BigInt totalScore to string");
  assert(page.includes("<ArcadeScreenClient user={user} userStat={userStat} />"), "home page should pass userStat to client shell");

  assert(screenClient.includes("<AuthModal />"), "ArcadeScreenClient should render auth modal");
  assert(screenClient.includes("<ActiveView user={user} userStat={userStat} />"), "ArcadeScreenClient should pass user and userStat");

  assert(cabinetShell.includes("cabinet-lines"), "CabinetShell should include etched cabinet lines class");
  assert(cabinetShell.includes("shadow-[0_0_10px_2px"), "CabinetShell should include sparkle effect");

  assert(screenFrame.includes("<Navbar user={user} />"), "ScreenFrame should render Navbar with user prop");
  assert(screenFrame.includes("<GameCarousel />"), "ScreenFrame should render GameCarousel");

  assert(navbar.includes("const Navbar = memo"), "Navbar should be memoized");
  assert(navbar.includes("openAuthModal(\"login\")"), "Navbar login should open auth modal");
  assert(navbar.includes("authClient.signOut"), "Navbar should handle sign out");

  assert(carousel.includes("GameCarouselIcon"), "GameCarousel should render GameCarouselIcon");
  assert(carouselIcon.includes("const GameCarouselIcon = memo"), "GameCarouselIcon should be memoized");

  assert(!allGames.includes("PeepholeTransition"), "AllGamesView should not use PeepholeTransition CTA directly");
  assert(allGames.includes("router.push(`/play/${selectedGameId}`)"), "AllGamesView should navigate directly to play route");
  assert(allGames.includes("GAME_REGISTRY"), "AllGamesView should read game data from GAME_REGISTRY");
  assert(allGames.includes("PREPARING CARTRIDGE...") && allGames.includes("LOADING ASSETS...") && allGames.includes("BOOTING..."), "AllGamesView should include launch milestones");

  assert(leaderboards.includes("useLeaderboard"), "LeaderboardsView should use leaderboard hook");
  assert(leaderboards.includes("getLocalHighScore"), "LeaderboardsView should include guest local high score");
  assert(leaderboards.includes("FILTER:") && leaderboards.includes("SORT:"), "LeaderboardsView should render filter/sort controls");

  assert(community.includes("FORUM DISCUSSIONS") && community.includes("TOP COMMUNITY CREATIONS") && community.includes("PLATFORM EVENTS"), "CommunityView should render three static columns");

  assert(profile.includes("getLocalStats"), "ProfileView should use local stats for guest");
  assert(profile.includes("userStat"), "ProfileView should consume SSR userStat for logged-in users");
  assert(profile.includes("LOG IN TO SAVE YOUR PROGRESS"), "ProfileView should show guest progress banner");

  assert(authModal.includes("LoginForm") && authModal.includes("RegisterForm"), "AuthModal should switch between login/register forms");

  assert(login.includes("useDebounce"), "LoginForm should use debounced validation");
  assert(login.includes("migrateLocalDataToServer"), "LoginForm should migrate guest data after auth");
  assert(register.includes("useDebounce"), "RegisterForm should use debounced validation");
  assert(register.includes("migrateLocalDataToServer"), "RegisterForm should migrate guest data after registration");

  assert(debounce.includes("window.setTimeout"), "useDebounce should debounce with setTimeout");
  assert(hookLeaderboard.includes("/api/v1/scores/"), "useLeaderboard should load leaderboard from scores API");

  assert(peephole.includes("clipPath") && peephole.includes("router.push(`/play/${gameId}`)"), "PeepholeTransition should animate and navigate");

  assert(playClient.includes("EventBus.on(EVENTS.GAME_READY"), "PlayClient should wait for GAME_READY");
  assert(playClient.includes("READY TO BOOT THIS CARTRIDGE?"), "PlayClient should render start menu prompt");
  assert(playClient.includes("GO BACK HOME"), "PlayClient start menu should include home action");
  assert(playClient.includes("hasStartedFromMenu"), "PlayClient should gate game mounting behind start menu");
  assert(playClient.includes("isRevealVisible"), "PlayClient should show peephole reveal only after load");

  console.log("PASS: Frontend shell contract checks");
}

async function main() {
  const failures = [];

  const tests = [
    testFilePresence,
    testPersistenceAdapter,
    testStoresAndBridgeContracts,
    testPhase5ApiRoutes,
    testPhase6ShellContracts,
  ];

  for (const testFn of tests) {
    try {
      await testFn();
    } catch (error) {
      failures.push({ name: testFn.name, error });
      console.error(`FAIL [${testFn.name}]: ${error.message}`);
    }
  }

  printSection("Summary");
  if (failures.length === 0) {
    console.log("ALL PHASE 1-6 TESTS PASSED");
    return;
  }

  console.log(`FAILED GROUPS: ${failures.length}`);
  failures.forEach((item, index) => {
    console.log(`${index + 1}. ${item.name} -> ${item.error.message}`);
  });
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("Fatal runner error:", error);
  process.exitCode = 1;
});
