import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { AVATARS } from "@/utils/constants";

export async function POST(request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const image = body?.image;

  if (!AVATARS.includes(image)) {
    return Response.json({ error: "Invalid avatar" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { image },
  });

  return Response.json({ success: true, image });
}
