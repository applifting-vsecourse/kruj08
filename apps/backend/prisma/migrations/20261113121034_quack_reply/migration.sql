-- CreateTable
CREATE TABLE "quack_reply" (
    "quackId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,

    CONSTRAINT "quack_reply_pkey" PRIMARY KEY ("quackId")
);

-- CreateIndex
CREATE INDEX "quack_reply_parentId_idx" ON "quack_reply"("parentId");

-- AddForeignKey
ALTER TABLE "quack_reply" ADD CONSTRAINT "quack_reply_quackId_fkey" FOREIGN KEY ("quackId") REFERENCES "quack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quack_reply" ADD CONSTRAINT "quack_reply_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "quack"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
