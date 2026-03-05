-- AlterTable
ALTER TABLE "score_log" ADD COLUMN     "meta" JSONB;

-- AlterTable
ALTER TABLE "user_stat" ADD COLUMN     "totalCoinsCollected" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalRabbitsCollected" INTEGER NOT NULL DEFAULT 0;
