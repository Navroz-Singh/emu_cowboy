import { auth } from "@/lib/auth";
import { GAME_REGISTRY } from "@/games/registry";
import prisma from "@/lib/prisma";

function toInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function normalizeCountryCode(countryCode) {
  if (typeof countryCode !== "string") return "XX";
  const normalized = countryCode.trim().toUpperCase();
  return normalized.length === 2 ? normalized : "XX";
}

function normalizeRunMeta(meta) {
  const safeMeta = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  return {
    rabbitsCollected: toInteger(safeMeta.rabbitsCollected, 0),
    coinsCollected: toInteger(safeMeta.coinsCollected, 0),
  };
}

async function upsertLeaderboardBestScore({ userId, gameId, value, countryCode, achievedAt }) {
  const existing = await prisma.leaderboardEntry.findUnique({
    where: {
      userId_gameId: {
        userId,
        gameId,
      },
    },
  });

  if (!existing) {
    await prisma.leaderboardEntry.create({
      data: {
        userId,
        gameId,
        value,
        countryCode,
        achievedAt,
      },
    });
    return true;
  }

  if (value > existing.value) {
    await prisma.leaderboardEntry.update({
      where: {
        userId_gameId: {
          userId,
          gameId,
        },
      },
      data: {
        value,
        countryCode,
        achievedAt,
      },
    });
    return true;
  }

  return false;
}

export async function GET(request, { params }) {
  const { gameId } = await params;

  if (!GAME_REGISTRY[gameId]) {
    return Response.json({ error: "Unknown gameId" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 15)));
  const country = searchParams.get("country")?.trim().toUpperCase() || null;

  const where = {
    gameId,
    ...(country && country.length === 2 ? { countryCode: country } : {}),
  };

  const rows = await prisma.leaderboardEntry.findMany({
    where,
    orderBy: [{ value: "desc" }, { achievedAt: "asc" }],
    take: limit,
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  return Response.json({
    success: true,
    gameId,
    rows: rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      playerName: row.user?.name || "Unknown",
      playerImage: row.user?.image || null,
      value: row.value,
      countryCode: row.countryCode,
      achievedAt: row.achievedAt,
    })),
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
    },
  });
}

export async function POST(request, { params }) {
  const { gameId } = await params;

  if (!GAME_REGISTRY[gameId]) {
    return Response.json({ error: "Unknown gameId" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const value = toInteger(body?.value, -1);
  const timePlayed = toInteger(body?.timePlayed, 0);
  const runMeta = normalizeRunMeta(body?.meta);
  const countryCode = normalizeCountryCode(request.headers.get("x-vercel-ip-country"));

  if (!Number.isInteger(value) || value <= 0) {
    return Response.json({ error: "Invalid score value" }, { status: 400 });
  }

  if (!Number.isInteger(timePlayed) || timePlayed < 0) {
    return Response.json({ error: "Invalid timePlayed value" }, { status: 400 });
  }

  const createdAt = new Date();

  const [scoreLog, leaderboardUpdated] = await Promise.all([
    prisma.scoreLog.create({
      data: {
        userId,
        gameId,
        value,
        countryCode,
        meta: runMeta,
        createdAt,
      },
    }),
    upsertLeaderboardBestScore({
      userId,
      gameId,
      value,
      countryCode,
      achievedAt: createdAt,
    }),
    prisma.userStat.upsert({
      where: { userId },
      update: {
        totalScore: { increment: BigInt(value) },
        gamesPlayed: { increment: 1 },
        totalTimePlayed: { increment: timePlayed },
        totalRabbitsCollected: { increment: runMeta.rabbitsCollected },
        totalCoinsCollected: { increment: runMeta.coinsCollected },
        lastPlayedGame: gameId,
      },
      create: {
        userId,
        totalScore: BigInt(value),
        gamesPlayed: 1,
        totalTimePlayed: timePlayed,
        totalRabbitsCollected: runMeta.rabbitsCollected,
        totalCoinsCollected: runMeta.coinsCollected,
        lastPlayedGame: gameId,
      },
    }),
  ]);

  return Response.json({
    success: true,
    scoreLog: {
      id: scoreLog.id,
      gameId: scoreLog.gameId,
      value: scoreLog.value,
      countryCode: scoreLog.countryCode,
      meta: scoreLog.meta,
      createdAt: scoreLog.createdAt,
    },
    leaderboardUpdated,
  });
}
