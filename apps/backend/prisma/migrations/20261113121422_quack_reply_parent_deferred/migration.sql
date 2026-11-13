-- The parent foreign key of a reply is checked at commit instead of after
-- each statement. Deleting an account cascades to its quacks, and Postgres
-- runs that cascade as a nested statement whose NO ACTION check fires before
-- the cascade that removes the account's own replies' rows from quack_reply.
-- Checked immediately, an account with a reply under its own quack could
-- never be deleted. Checked at commit, every cascade has run, and only a
-- reply by someone else still blocks the deletion — which is the point:
-- replies belong to the people who wrote them.
--
-- Prisma does not model DEFERRABLE, so it neither writes nor reverts this;
-- a later migration that recreates this constraint must keep it.
ALTER TABLE "quack_reply"
  ALTER CONSTRAINT "quack_reply_parentId_fkey" DEFERRABLE INITIALLY DEFERRED;
