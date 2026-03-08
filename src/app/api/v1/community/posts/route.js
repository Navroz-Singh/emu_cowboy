import { auth } from "@/lib/auth";
import { GAME_REGISTRY } from "@/games/registry";
import prisma from "@/lib/prisma";

function sanitizeText(value, maxLength) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw.slice(0, maxLength);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const gameId = sanitizeText(searchParams.get("gameId"), 50);

  const where = gameId && GAME_REGISTRY[gameId] ? { gameId } : {};

  const posts = await prisma.communityPost.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
      comments: {
        orderBy: [{ createdAt: "asc" }],
        include: {
          user: {
            select: { id: true, name: true, image: true },
          },
        },
      },
    },
  });

  return Response.json({
    success: true,
    posts: posts.map((post) => ({
      id: post.id,
      gameId: post.gameId,
      title: post.title,
      content: post.content,
      likesCount: post.likesCount,
      dislikesCount: post.dislikesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
      author: {
        id: post.user.id,
        name: post.user.name,
        image: post.user.image,
      },
      comments: post.comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        author: {
          id: comment.user.id,
          name: comment.user.name,
          image: comment.user.image,
        },
      })),
    })),
  });
}

export async function POST(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const gameId = sanitizeText(body?.gameId, 50);
  const title = sanitizeText(body?.title, 140);
  const content = sanitizeText(body?.content, 4000);

  if (!GAME_REGISTRY[gameId]) {
    return Response.json({ error: "Invalid game" }, { status: 400 });
  }

  if (title.length < 3 || content.length < 3) {
    return Response.json({ error: "Title and content are required" }, { status: 400 });
  }

  const post = await prisma.communityPost.create({
    data: {
      userId,
      gameId,
      title,
      content,
    },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  return Response.json({
    success: true,
    post: {
      id: post.id,
      gameId: post.gameId,
      title: post.title,
      content: post.content,
      likesCount: post.likesCount,
      dislikesCount: post.dislikesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
      author: {
        id: post.user.id,
        name: post.user.name,
        image: post.user.image,
      },
      comments: [],
    },
  });
}
