const LOCAL_SCORES_KEY = "nexus_arcade_scores";
const LOCAL_SAVES_KEY = "nexus_arcade_saves";

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function parseJSON(value, fallback) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.trunc(numeric));
}

function readScores(storage) {
  return parseJSON(storage.getItem(LOCAL_SCORES_KEY), {});
}

function writeScores(storage, scores) {
  storage.setItem(LOCAL_SCORES_KEY, JSON.stringify(scores));
}

function readSaves(storage) {
  return parseJSON(storage.getItem(LOCAL_SAVES_KEY), {});
}

function writeSaves(storage, saves) {
  storage.setItem(LOCAL_SAVES_KEY, JSON.stringify(saves));
}

export async function submitScore(gameId, value, user, timePlayed = 0) {
  const normalizedValue = normalizeInt(value);
  const normalizedTimePlayed = normalizeInt(timePlayed);

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

  const storage = getStorage();
  if (!storage) return { success: false, local: true, error: "localStorage unavailable" };

  const scores = readScores(storage);
  if (!scores[gameId]) scores[gameId] = [];

  scores[gameId].push({
    value: normalizedValue,
    timePlayed: normalizedTimePlayed,
    date: new Date().toISOString(),
  });

  scores[gameId].sort((left, right) => right.value - left.value);
  scores[gameId] = scores[gameId].slice(0, 50);

  writeScores(storage, scores);

  return { success: true, local: true };
}

export async function getLocalHighScore(gameId) {
  const storage = getStorage();
  if (!storage) return 0;

  const scores = readScores(storage);
  if (!scores[gameId] || scores[gameId].length === 0) return 0;

  return normalizeInt(scores[gameId][0].value);
}

export function getLocalStats() {
  const storage = getStorage();
  if (!storage) {
    return {
      totalScore: "0",
      gamesPlayed: 0,
      totalTimePlayed: 0,
      lastPlayedGame: null,
    };
  }

  const scores = readScores(storage);
  let totalScore = 0n;
  let gamesPlayed = 0;
  let totalTimePlayed = 0;
  let lastPlayedGame = null;
  let lastDate = null;

  for (const [gameKey, entries] of Object.entries(scores)) {
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      totalScore += BigInt(normalizeInt(entry?.value));
      gamesPlayed += 1;
      totalTimePlayed += normalizeInt(entry?.timePlayed);

      const entryDate = new Date(entry?.date || 0);
      if (!Number.isNaN(entryDate.getTime()) && (!lastDate || entryDate > lastDate)) {
        lastDate = entryDate;
        lastPlayedGame = gameKey;
      }
    }
  }

  return {
    totalScore: totalScore.toString(),
    gamesPlayed,
    totalTimePlayed,
    lastPlayedGame,
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

  const storage = getStorage();
  if (!storage) return { success: false, local: true, error: "localStorage unavailable" };

  const saves = readSaves(storage);
  saves[gameId] = { state: state ?? null, updatedAt: new Date().toISOString() };
  writeSaves(storage, saves);

  return { success: true, local: true };
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

  const storage = getStorage();
  if (!storage) return { state: null };

  const saves = readSaves(storage);
  return saves[gameId] || { state: null };
}

export async function migrateLocalDataToServer(user) {
  if (!user) return { migrated: false, reason: "missing-user" };

  const storage = getStorage();
  if (!storage) return { migrated: false, reason: "local-storage-unavailable" };

  const scores = readScores(storage);
  for (const [gameId, entries] of Object.entries(scores)) {
    if (!Array.isArray(entries) || entries.length === 0) continue;

    const best = [...entries].sort((left, right) => normalizeInt(right?.value) - normalizeInt(left?.value))[0];
    await submitScore(gameId, normalizeInt(best?.value), user, normalizeInt(best?.timePlayed));
  }

  const saves = readSaves(storage);
  for (const [gameId, save] of Object.entries(saves)) {
    if (!save || save.state === undefined) continue;
    await saveGameState(gameId, save.state, user);
  }

  storage.removeItem(LOCAL_SCORES_KEY);
  storage.removeItem(LOCAL_SAVES_KEY);

  return { migrated: true };
}
