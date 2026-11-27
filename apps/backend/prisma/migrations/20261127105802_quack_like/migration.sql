-- CreateTable
CREATE TABLE "quack_like" (
    "quackId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quack_like_pkey" PRIMARY KEY ("quackId","userId")
);

-- CreateIndex
CREATE INDEX "quack_like_userId_idx" ON "quack_like"("userId");

-- AddForeignKey
ALTER TABLE "quack_like" ADD CONSTRAINT "quack_like_quackId_fkey" FOREIGN KEY ("quackId") REFERENCES "quack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quack_like" ADD CONSTRAINT "quack_like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
