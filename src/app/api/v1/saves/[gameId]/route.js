import { auth } from "@/lib/auth";
import { GAME_REGISTRY } from "@/games/registry";
import prisma from "@/lib/prisma";

export async function GET(request, { params }) {
  const { gameId } = await params;

  if (!GAME_REGISTRY[gameId]) {
    return Response.json({ error: "Unknown gameId" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const save = await prisma.gameSave.findUnique({
    where: {
      userId_gameId: {
        userId,
        gameId,
      },
    },
  });

  return Response.json({
    success: true,
    state: save?.state ?? null,
    updatedAt: save?.updatedAt ?? null,
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
  const state = body?.state;

  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return Response.json({ error: "Invalid state payload" }, { status: 400 });
  }

  const save = await prisma.gameSave.upsert({
    where: {
      userId_gameId: {
        userId,
        gameId,
      },
    },
    update: {
      state,
    },
    create: {
      userId,
      gameId,
      state,
    },
  });

  return Response.json({
    success: true,
    updatedAt: save.updatedAt,
  });
}
