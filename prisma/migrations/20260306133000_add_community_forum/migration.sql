-- CreateTable
CREATE TABLE "community_post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "dislikesCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_reaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_reaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_post_gameId_createdAt_idx" ON "community_post"("gameId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "community_post_createdAt_idx" ON "community_post"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "community_comment_postId_createdAt_idx" ON "community_comment"("postId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "community_reaction_postId_userId_key" ON "community_reaction"("postId", "userId");

-- CreateIndex
CREATE INDEX "community_reaction_postId_value_idx" ON "community_reaction"("postId", "value");

-- AddForeignKey
ALTER TABLE "community_post" ADD CONSTRAINT "community_post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comment" ADD CONSTRAINT "community_comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comment" ADD CONSTRAINT "community_comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_reaction" ADD CONSTRAINT "community_reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_reaction" ADD CONSTRAINT "community_reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
