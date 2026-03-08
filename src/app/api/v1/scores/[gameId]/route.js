import { auth } from "@/lib/auth";
import { GAME_REGISTRY } from "@/games/registry";
import prisma from "@/lib/prisma";

const ipCountryCache = new Map();

const REGION_COUNTRY_CODES = {
  NORTH_AMERICA: ["US", "CA", "MX", "GT", "BZ", "SV", "HN", "NI", "CR", "PA", "CU", "DO", "HT", "JM", "BS", "BB", "TT", "AG", "DM", "GD", "KN", "LC", "VC"],
  SOUTH_AMERICA: ["AR", "BO", "BR", "CL", "CO", "EC", "GY", "PY", "PE", "SR", "UY", "VE", "GF"],
  EUROPE: ["AL", "AD", "AM", "AT", "AZ", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GE", "GR", "HR", "HU", "IE", "IS", "IT", "KZ", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE", "SI", "SK", "SM", "TR", "UA", "VA"],
  AFRICA: ["DZ", "AO", "BJ", "BW", "BF", "BI", "CM", "CV", "CF", "TD", "KM", "CG", "CD", "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "CI", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW"],
  ASIA: ["AF", "BD", "BT", "BN", "KH", "CN", "HK", "MO", "IN", "ID", "JP", "KP", "KR", "LA", "MY", "MV", "MN", "MM", "NP", "PH", "SG", "LK", "TH", "TL", "TW", "VN"],
  MIDDLE_EAST: ["AE", "BH", "EG", "IQ", "IR", "IL", "JO", "KW", "LB", "OM", "PS", "QA", "SA", "SY", "TR", "YE"],
  OCEANIA: ["AU", "NZ", "FJ", "PG", "SB", "VU", "WS", "TO", "TV", "KI", "MH", "FM", "NR", "PW"],
};

function toInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function normalizeCountryCode(countryCode) {
  if (typeof countryCode !== "string") return "XX";
  const normalized = countryCode.trim().toUpperCase();
  if (normalized.length !== 2) return "XX";
  if (["XX", "ZZ", "T1"].includes(normalized)) return "XX";
  return normalized;
}

function normalizeRegion(region) {
  if (typeof region !== "string") return "";
  const normalized = region.trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(REGION_COUNTRY_CODES, normalized) ? normalized : "";
}

function normalizeIpCandidate(value) {
  if (typeof value !== "string") return "";

  let candidate = value.trim();
  if (!candidate) return "";

  if (candidate.startsWith("for=")) {
    candidate = candidate.slice(4).trim();
  }

  candidate = candidate.replace(/^"|"$/g, "").trim();
  if (!candidate) return "";

  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  }

  if (candidate.includes("%")) {
    candidate = candidate.split("%")[0];
  }

  if (candidate.toLowerCase().startsWith("::ffff:")) {
    candidate = candidate.slice(7);
  }

  if (candidate.includes(".") && /:\d+$/.test(candidate)) {
    candidate = candidate.replace(/:\d+$/, "");
  }

  const lowered = candidate.toLowerCase();
  if (lowered === "unknown" || lowered === "_hidden" || lowered === "obfuscated") {
    return "";
  }

  return candidate;
}

function extractForwardedForIp(request) {
  const forwardedHeader = request.headers.get("forwarded") || "";
  if (!forwardedHeader) return "";

  const parts = forwardedHeader.split(",");
  for (let index = 0; index < parts.length; index += 1) {
    const segment = parts[index];
    const directives = segment.split(";");
    for (let directiveIndex = 0; directiveIndex < directives.length; directiveIndex += 1) {
      const directive = directives[directiveIndex].trim();
      if (!directive.toLowerCase().startsWith("for=")) continue;
      const candidate = normalizeIpCandidate(directive);
      if (candidate) return candidate;
    }
  }

  return "";
}

function extractClientIp(request) {
  const forwardedForIp = extractForwardedForIp(request);
  if (forwardedForIp) {
    return forwardedForIp;
  }

  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  if (forwardedFor) {
    const ipCandidates = forwardedFor
      .split(",")
      .map((entry) => normalizeIpCandidate(entry))
      .filter(Boolean);
    if (ipCandidates.length > 0) {
      return ipCandidates[0];
    }
  }

  const directCandidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-client-ip"),
    request.headers.get("true-client-ip"),
  ];

  for (let index = 0; index < directCandidates.length; index += 1) {
    const candidate = normalizeIpCandidate(directCandidates[index]);
    if (candidate) return candidate;
  }

  return "";
}

function isRoutableIp(ipAddress) {
  if (!ipAddress) return false;

  if (ipAddress.includes(":")) {
    const normalized = ipAddress.toLowerCase();
    if (normalized === "::1") return false;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return false;
    if (normalized.startsWith("fe80")) return false;
    return true;
  }

  const parts = ipAddress.split(".").map((segment) => Number(segment));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  if (parts[0] === 10) return false;
  if (parts[0] === 127) return false;
  if (parts[0] === 192 && parts[1] === 168) return false;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
  return true;
}

async function resolveCountryCode(request) {
  const headerCandidates = [
    request.headers.get("x-vercel-ip-country"),
    request.headers.get("cf-ipcountry"),
    request.headers.get("cloudfront-viewer-country"),
    request.headers.get("x-country-code"),
    request.headers.get("x-geo-country"),
    request.headers.get("x-appengine-country"),
  ];

  for (let index = 0; index < headerCandidates.length; index += 1) {
    const normalized = normalizeCountryCode(headerCandidates[index]);
    if (normalized !== "XX") return normalized;
  }

  const clientIp = extractClientIp(request);
  if (!isRoutableIp(clientIp)) return "XX";

  const cached = ipCountryCache.get(clientIp);
  if (cached && cached !== "XX") return cached;
  if (cached === "XX") {
    ipCountryCache.delete(clientIp);
  }

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(clientIp)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1200),
    });

    if (!response.ok) return "XX";

    const payload = await response.json().catch(() => ({}));
    const resolved = normalizeCountryCode(payload?.country_code);
    if (resolved !== "XX") {
      ipCountryCache.set(clientIp, resolved);
    }
    return resolved;
  } catch {
    return "XX";
  }
}

async function resolveCountryCodeFromIp(ipAddress) {
  const normalizedIp = normalizeIpCandidate(ipAddress);
  if (!isRoutableIp(normalizedIp)) return "XX";

  const cached = ipCountryCache.get(normalizedIp);
  if (cached && cached !== "XX") return cached;

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(normalizedIp)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1200),
    });

    if (!response.ok) return "XX";

    const payload = await response.json().catch(() => ({}));
    const resolved = normalizeCountryCode(payload?.country_code);
    if (resolved !== "XX") {
      ipCountryCache.set(normalizedIp, resolved);
    }
    return resolved;
  } catch {
    return "XX";
  }
}

async function resolveCountryCodeWithUserFallback(request, userId) {
  const direct = await resolveCountryCode(request);
  if (direct !== "XX") return direct;
  if (!userId) return "XX";

  const latestSession = await prisma.session.findFirst({
    where: {
      userId,
      ipAddress: {
        not: null,
      },
    },
    select: {
      ipAddress: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!latestSession?.ipAddress) return "XX";
  return resolveCountryCodeFromIp(latestSession.ipAddress);
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

  const isCountryUpgrade = existing.countryCode === "XX" && countryCode !== "XX";
  const isHigherScore = value > existing.value;

  if (isHigherScore || isCountryUpgrade) {
    const data = {
      countryCode,
      ...(isHigherScore
        ? {
            value,
            achievedAt,
          }
        : {}),
    };

    await prisma.leaderboardEntry.update({
      where: {
        userId_gameId: {
          userId,
          gameId,
        },
      },
      data,
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
  const region = normalizeRegion(searchParams.get("region") || "");

  const regionCountries = region ? (REGION_COUNTRY_CODES[region] || []) : [];

  const where = {
    gameId,
    ...(country && country.length === 2 ? { countryCode: country } : {}),
    ...(regionCountries.length > 0 ? { countryCode: { in: regionCountries } } : {}),
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
      "Cache-Control": "no-store",
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
  const countryCode = await resolveCountryCodeWithUserFallback(request, userId);

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
