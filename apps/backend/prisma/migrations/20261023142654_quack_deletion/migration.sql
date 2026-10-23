-- CreateTable
CREATE TABLE "quack_deletion" (
    "quackId" TEXT NOT NULL,
    "deletedById" TEXT NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quack_deletion_pkey" PRIMARY KEY ("quackId")
);

-- CreateIndex
CREATE INDEX "quack_deletion_deletedById_idx" ON "quack_deletion"("deletedById");

-- AddForeignKey
ALTER TABLE "quack_deletion" ADD CONSTRAINT "quack_deletion_quackId_fkey" FOREIGN KEY ("quackId") REFERENCES "quack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quack_deletion" ADD CONSTRAINT "quack_deletion_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: until now only authors could delete, so every quack deleted so
-- far was deleted by its author, with no reason, at its deletedAt.
INSERT INTO "quack_deletion" ("quackId", "deletedById", "createdAt")
SELECT "id", "userId", "deletedAt" FROM "quack" WHERE "deletedAt" IS NOT NULL;
