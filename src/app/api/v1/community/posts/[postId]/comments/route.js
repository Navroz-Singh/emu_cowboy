import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function sanitizeComment(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw.slice(0, 1200);
}

export async function POST(request, { params }) {
  const { postId } = await params;

  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const content = sanitizeComment(body?.content);

  if (!postId || content.length < 1) {
    return Response.json({ error: "Invalid comment payload" }, { status: 400 });
  }

  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: { id: true },
  });

  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  const comment = await prisma.communityComment.create({
    data: {
      postId,
      userId,
      content,
    },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  await prisma.communityPost.update({
    where: { id: postId },
    data: {
      commentsCount: { increment: 1 },
    },
  });

  return Response.json({
    success: true,
    comment: {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: {
        id: comment.user.id,
        name: comment.user.name,
        image: comment.user.image,
      },
    },
  });
}
