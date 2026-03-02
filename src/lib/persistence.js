const GUEST_USER_ID = "guest";
const GUEST_COUNTRY_CODE = "ZZ";
const MAX_LOCAL_SCORES_PER_GAME = 50;

export const LOCAL_STORAGE_KEYS = {
  scoreLog: "nexus_arcade_score_log.v1",
  leaderboardEntry: "nexus_arcade_leaderboard_entry.v1",
  gameSave: "nexus_arcade_game_save.v1",
  userStat: "nexus_arcade_user_stat.v1",
};

const LEGACY_STORAGE_KEYS = {
  scores: "nexus_arcade_scores",
  saves: "nexus_arcade_saves",
};

const FALLBACK_USER_STAT = {
  userId: GUEST_USER_ID,
  totalScore: "0",
  gamesPlayed: 0,
  totalTimePlayed: 0,
  lastPlayedGame: null,
  updatedAt: null,
};

function getClientStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function safeParseJSON(value, fallback) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safeStringifyJSON(value, fallback = "{}") {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function readStoreObject(storage, key, fallback = {}) {
  return safeParseJSON(storage.getItem(key), fallback);
}

function writeStoreObject(storage, key, value) {
  storage.setItem(key, safeStringifyJSON(value));
}

function normalizeCountryCode(countryCode) {
  if (typeof countryCode !== "string") return GUEST_COUNTRY_CODE;

  const normalized = countryCode.trim().toUpperCase();
  if (normalized.length !== 2) return GUEST_COUNTRY_CODE;

  return normalized;
}

function toInteger(value, fallback = 0) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.trunc(numberValue));
}

function toBigIntString(value) {
  try {
    return BigInt(value ?? 0).toString();
  } catch {
    return "0";
  }
}

function addBigIntStrings(left, right) {
  return (BigInt(left ?? 0) + BigInt(right ?? 0)).toString();
}

function createLocalId(prefix) {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${timestamp}_${randomPart}`;
}

function migrateLegacyLocalStorageShape(storage) {
  const hasNewData =
    storage.getItem(LOCAL_STORAGE_KEYS.scoreLog) ||
    storage.getItem(LOCAL_STORAGE_KEYS.leaderboardEntry) ||
    storage.getItem(LOCAL_STORAGE_KEYS.gameSave) ||
    storage.getItem(LOCAL_STORAGE_KEYS.userStat);

  if (hasNewData) return;

  const legacyScores = safeParseJSON(storage.getItem(LEGACY_STORAGE_KEYS.scores), {});
  const legacySaves = safeParseJSON(storage.getItem(LEGACY_STORAGE_KEYS.saves), {});

  if (
    Object.keys(legacyScores).length === 0 &&
    Object.keys(legacySaves).length === 0
  ) {
    return;
  }

  const scoreLog = {};
  const leaderboardEntry = {};
  const userStat = { ...FALLBACK_USER_STAT };

  for (const [gameId, entries] of Object.entries(legacyScores)) {
    if (!Array.isArray(entries)) continue;

    scoreLog[gameId] = entries
      .map((entry) => {
        const value = toInteger(entry?.value, 0);
        const timePlayed = toInteger(entry?.timePlayed, 0);
        const createdAt = typeof entry?.date === "string" ? entry.date : new Date().toISOString();

        userStat.totalScore = addBigIntStrings(userStat.totalScore, value);
        userStat.gamesPlayed += 1;
        userStat.totalTimePlayed += timePlayed;

        const currentLast = userStat.updatedAt ? new Date(userStat.updatedAt).getTime() : 0;
        const entryTime = new Date(createdAt).getTime();

        if (!currentLast || entryTime > currentLast) {
          userStat.updatedAt = createdAt;
          userStat.lastPlayedGame = gameId;
        }

        return {
          id: createLocalId("score"),
          userId: GUEST_USER_ID,
          gameId,
          value,
          countryCode: GUEST_COUNTRY_CODE,
          createdAt,
          timePlayed,
        };
      })
      .sort((left, right) => right.value - left.value)
      .slice(0, MAX_LOCAL_SCORES_PER_GAME);

    if (scoreLog[gameId].length > 0) {
      const best = scoreLog[gameId][0];
      leaderboardEntry[gameId] = {
        id: createLocalId("leaderboard"),
        userId: GUEST_USER_ID,
        gameId,
        value: best.value,
        countryCode: best.countryCode,
        achievedAt: best.createdAt,
      };
    }
  }

  if (!userStat.updatedAt) {
    userStat.updatedAt = new Date().toISOString();
  }

  const gameSave = {};
  for (const [gameId, save] of Object.entries(legacySaves)) {
    gameSave[gameId] = {
      id: createLocalId("save"),
      userId: GUEST_USER_ID,
      gameId,
      state: save?.state ?? null,
      updatedAt: typeof save?.updatedAt === "string" ? save.updatedAt : new Date().toISOString(),
    };
  }

  writeStoreObject(storage, LOCAL_STORAGE_KEYS.scoreLog, scoreLog);
  writeStoreObject(storage, LOCAL_STORAGE_KEYS.leaderboardEntry, leaderboardEntry);
  writeStoreObject(storage, LOCAL_STORAGE_KEYS.gameSave, gameSave);
  writeStoreObject(storage, LOCAL_STORAGE_KEYS.userStat, userStat);
}

function ensureStorageReady() {
  const storage = getClientStorage();
  if (!storage) return null;

  migrateLegacyLocalStorageShape(storage);

  return storage;
}

function readGuestStores(storage) {
  return {
    scoreLog: readStoreObject(storage, LOCAL_STORAGE_KEYS.scoreLog, {}),
    leaderboardEntry: readStoreObject(storage, LOCAL_STORAGE_KEYS.leaderboardEntry, {}),
    gameSave: readStoreObject(storage, LOCAL_STORAGE_KEYS.gameSave, {}),
    userStat: {
      ...FALLBACK_USER_STAT,
      ...readStoreObject(storage, LOCAL_STORAGE_KEYS.userStat, {}),
    },
  };
}

function writeGuestStores(storage, stores) {
  writeStoreObject(storage, LOCAL_STORAGE_KEYS.scoreLog, stores.scoreLog);
  writeStoreObject(storage, LOCAL_STORAGE_KEYS.leaderboardEntry, stores.leaderboardEntry);
  writeStoreObject(storage, LOCAL_STORAGE_KEYS.gameSave, stores.gameSave);
  writeStoreObject(storage, LOCAL_STORAGE_KEYS.userStat, stores.userStat);
}

function refreshGuestStats(stores, gameId, scoreValue, timePlayed, timestamp) {
  const totalScore = addBigIntStrings(stores.userStat.totalScore, scoreValue);
  const currentUpdatedAt = stores.userStat.updatedAt ? new Date(stores.userStat.updatedAt).getTime() : 0;
  const incomingUpdatedAt = new Date(timestamp).getTime();

  stores.userStat = {
    ...stores.userStat,
    totalScore,
    gamesPlayed: toInteger(stores.userStat.gamesPlayed) + 1,
    totalTimePlayed: toInteger(stores.userStat.totalTimePlayed) + toInteger(timePlayed),
    lastPlayedGame:
      !currentUpdatedAt || incomingUpdatedAt >= currentUpdatedAt
        ? gameId
        : stores.userStat.lastPlayedGame,
    updatedAt:
      !currentUpdatedAt || incomingUpdatedAt >= currentUpdatedAt
        ? timestamp
        : stores.userStat.updatedAt,
  };
}

export async function submitScore(gameId, value, user, timePlayed = 0, countryCode = GUEST_COUNTRY_CODE) {
  const normalizedValue = toInteger(value);
  const normalizedTimePlayed = toInteger(timePlayed);
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  if (user) {
    const response = await fetch(`/api/v1/scores/${gameId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: normalizedValue, timePlayed: normalizedTimePlayed }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || `Failed to submit score (${response.status})`);
    }

    return payload;
  }

  const storage = ensureStorageReady();
  if (!storage) {
    return { success: false, local: true, error: "localStorage unavailable" };
  }

  const stores = readGuestStores(storage);
  const createdAt = new Date().toISOString();
  const scoreEntry = {
    id: createLocalId("score"),
    userId: GUEST_USER_ID,
    gameId,
    value: normalizedValue,
    countryCode: normalizedCountryCode,
    createdAt,
    timePlayed: normalizedTimePlayed,
  };

  const gameScoreLog = Array.isArray(stores.scoreLog[gameId]) ? stores.scoreLog[gameId] : [];
  stores.scoreLog[gameId] = [scoreEntry, ...gameScoreLog]
    .sort((left, right) => right.value - left.value)
    .slice(0, MAX_LOCAL_SCORES_PER_GAME);

  const currentBest = stores.leaderboardEntry[gameId];
  if (!currentBest || normalizedValue >= toInteger(currentBest.value)) {
    stores.leaderboardEntry[gameId] = {
      id: currentBest?.id || createLocalId("leaderboard"),
      userId: GUEST_USER_ID,
      gameId,
      value: normalizedValue,
      countryCode: normalizedCountryCode,
      achievedAt: createdAt,
    };
  }

  refreshGuestStats(stores, gameId, normalizedValue, normalizedTimePlayed, createdAt);
  writeGuestStores(storage, stores);

  return {
    success: true,
    local: true,
    scoreLog: scoreEntry,
    leaderboardEntry: stores.leaderboardEntry[gameId],
    userStat: stores.userStat,
  };
}

export async function getLocalHighScore(gameId) {
  const storage = ensureStorageReady();
  if (!storage) return 0;

  const leaderboardEntry = readStoreObject(storage, LOCAL_STORAGE_KEYS.leaderboardEntry, {});
  const best = leaderboardEntry[gameId];

  return toInteger(best?.value);
}

export function getLocalStats() {
  const storage = ensureStorageReady();
  if (!storage) return { ...FALLBACK_USER_STAT };

  const userStat = {
    ...FALLBACK_USER_STAT,
    ...readStoreObject(storage, LOCAL_STORAGE_KEYS.userStat, {}),
  };

  return {
    userId: userStat.userId || GUEST_USER_ID,
    totalScore: toBigIntString(userStat.totalScore),
    gamesPlayed: toInteger(userStat.gamesPlayed),
    totalTimePlayed: toInteger(userStat.totalTimePlayed),
    lastPlayedGame: userStat.lastPlayedGame || null,
    updatedAt: userStat.updatedAt || null,
  };
}

export async function saveGameState(gameId, state, user) {
  if (user) {
    const response = await fetch(`/api/v1/saves/${gameId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || `Failed to save game state (${response.status})`);
    }

    return payload;
  }

  const storage = ensureStorageReady();
  if (!storage) {
    return { success: false, local: true, error: "localStorage unavailable" };
  }

  const stores = readGuestStores(storage);
  stores.gameSave[gameId] = {
    id: stores.gameSave[gameId]?.id || createLocalId("save"),
    userId: GUEST_USER_ID,
    gameId,
    state: state ?? null,
    updatedAt: new Date().toISOString(),
  };

  writeGuestStores(storage, stores);

  return { success: true, local: true, gameSave: stores.gameSave[gameId] };
}

export async function loadGameState(gameId, user) {
  if (user) {
    const response = await fetch(`/api/v1/saves/${gameId}`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || `Failed to load game state (${response.status})`);
    }

    return payload;
  }

  const storage = ensureStorageReady();
  if (!storage) return { state: null };

  const gameSave = readStoreObject(storage, LOCAL_STORAGE_KEYS.gameSave, {});
  return gameSave[gameId] || { state: null };
}

export async function migrateLocalDataToServer(user) {
  if (!user) return { migrated: false, reason: "missing-user" };

  const storage = ensureStorageReady();
  if (!storage) return { migrated: false, reason: "local-storage-unavailable" };

  const stores = readGuestStores(storage);
  const scoreGames = Object.keys(stores.leaderboardEntry);
  const saveGames = Object.keys(stores.gameSave);

  if (scoreGames.length === 0 && saveGames.length === 0) {
    return { migrated: false, reason: "nothing-to-migrate" };
  }

  const scoreMigrations = scoreGames.map(async (gameId) => {
    const best = stores.leaderboardEntry[gameId];
    if (!best) return;
    await submitScore(gameId, best.value, user, 0, best.countryCode);
  });

  const saveMigrations = saveGames.map(async (gameId) => {
    const save = stores.gameSave[gameId];
    if (!save || save.state == null) return;
    await saveGameState(gameId, save.state, user);
  });

  await Promise.all([...scoreMigrations, ...saveMigrations]);

  storage.removeItem(LOCAL_STORAGE_KEYS.scoreLog);
  storage.removeItem(LOCAL_STORAGE_KEYS.leaderboardEntry);
  storage.removeItem(LOCAL_STORAGE_KEYS.gameSave);
  storage.removeItem(LOCAL_STORAGE_KEYS.userStat);
  storage.removeItem(LEGACY_STORAGE_KEYS.scores);
  storage.removeItem(LEGACY_STORAGE_KEYS.saves);

  return {
    migrated: true,
    scoreGames: scoreGames.length,
    saveGames: saveGames.length,
  };
}

export function getLocalPersistenceSnapshot() {
  const storage = ensureStorageReady();
  if (!storage) return null;

  return {
    scoreLog: readStoreObject(storage, LOCAL_STORAGE_KEYS.scoreLog, {}),
    leaderboardEntry: readStoreObject(storage, LOCAL_STORAGE_KEYS.leaderboardEntry, {}),
    gameSave: readStoreObject(storage, LOCAL_STORAGE_KEYS.gameSave, {}),
    userStat: readStoreObject(storage, LOCAL_STORAGE_KEYS.userStat, { ...FALLBACK_USER_STAT }),
  };
}
