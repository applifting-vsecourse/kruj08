-- Deleting a user no longer deletes the records of the quacks they removed
-- from other people: the record keeps its reason and time, and deletedById
-- becomes null. A record of an author deleting their own quack still goes,
-- with the quack, through quack_deletion_quackId_fkey.

-- DropForeignKey
ALTER TABLE "quack_deletion" DROP CONSTRAINT "quack_deletion_deletedById_fkey";

-- AlterTable
ALTER TABLE "quack_deletion" ALTER COLUMN "deletedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "quack_deletion" ADD CONSTRAINT "quack_deletion_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
