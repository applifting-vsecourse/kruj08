-- AlterTable
ALTER TABLE "quack" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "quack_deletedAt_createdAt_idx" ON "quack"("deletedAt", "createdAt" DESC);
