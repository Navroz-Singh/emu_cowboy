import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const VALID_VALUES = new Set(["like", "dislike"]);

function normalizeReactionValue(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return VALID_VALUES.has(normalized) ? normalized : "";
}

export async function POST(request, { params }) {
  const { postId } = await params;

  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const value = normalizeReactionValue(body?.value);

  if (!postId || !value) {
    return Response.json({ error: "Invalid reaction payload" }, { status: 400 });
  }

  const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  await prisma.communityReaction.upsert({
    where: {
      postId_userId: {
        postId,
        userId,
      },
    },
    update: { value },
    create: {
      postId,
      userId,
      value,
    },
  });

  const [likesCount, dislikesCount] = await Promise.all([
    prisma.communityReaction.count({ where: { postId, value: "like" } }),
    prisma.communityReaction.count({ where: { postId, value: "dislike" } }),
  ]);

  await prisma.communityPost.update({
    where: { id: postId },
    data: {
      likesCount,
      dislikesCount,
    },
  });

  return Response.json({
    success: true,
    likesCount,
    dislikesCount,
  });
}
