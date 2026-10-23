// The repository against a real Postgres (`pnpm backend test:db`), for what
// the mocked Prisma in quack.repository.spec.ts cannot show: that the raw
// moderator UPDATE runs at all (the enum cast, MODERATOR_ROLES bound as an
// array through the driver adapter) and that the database itself keeps the
// guarantees the deletion code relies on.
import { PrismaService } from '@/core/prisma/prisma.service';
import { UserRole } from '@/generated/prisma/client';
import { QuackRepository } from './quack.repository';

describe('QuackRepository against Postgres', () => {
  const prisma = new PrismaService();
  const repository = new QuackRepository(prisma);

  afterAll(() => prisma.$disconnect());

  beforeEach(() =>
    prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "quack_deletion", "poll_vote", "poll_option", "poll", "quack", "user" CASCADE',
    ),
  );

  const aUser = (id: string, role: UserRole = 'user') =>
    prisma.user.create({
      data: {
        id,
        name: id,
        email: `${id}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        role,
      },
    });

  // Rows as stored, deleted or not: the point is to see what the writes did.
  const aQuack = (id: string, userId: string) =>
    prisma.quack.create({ data: { id, text: `Quack ${id}`, userId } });
  const storedQuack = (id: string) =>
    prisma.quack.findUniqueOrThrow({ where: { id } });
  const deletionOf = (quackId: string) =>
    prisma.quackDeletion.findUnique({ where: { quackId } });

  describe('softDeleteQuackAsModerator', () => {
    beforeEach(async () => {
      await aUser('author');
      await aUser('admin', 'admin');
      await aQuack('q1', 'author');
    });

    it("deletes someone else's quack for an admin and records who and why", async () => {
      await expect(
        repository.softDeleteQuackAsModerator('q1', 'admin', 'Quackery'),
      ).resolves.toBe(true);

      const quack = await storedQuack('q1');
      expect(quack.deletedAt).toBeInstanceOf(Date);
      // the statement sets @updatedAt itself, to the same instant
      expect(quack.updatedAt).toEqual(quack.deletedAt);
      expect(await deletionOf('q1')).toEqual({
        quackId: 'q1',
        deletedById: 'admin',
        reason: 'Quackery',
        createdAt: quack.deletedAt,
      });
    });

    it('deletes nothing for a user the database does not count as a moderator', async () => {
      // whatever their session claimed: only the role stored now counts
      await aUser('regular');

      await expect(
        repository.softDeleteQuackAsModerator('q1', 'regular', 'Quackery'),
      ).resolves.toBe(false);

      expect((await storedQuack('q1')).deletedAt).toBeNull();
      expect(await deletionOf('q1')).toBeNull();
    });

    it('leaves the first deletion on record when the quack is gone already', async () => {
      await repository.softDeleteOwnQuack('q1', 'author');

      await expect(
        repository.softDeleteQuackAsModerator('q1', 'admin', 'Quackery'),
      ).resolves.toBe(false);

      expect(await deletionOf('q1')).toMatchObject({
        deletedById: 'author',
        reason: null,
      });
    });

    it('keeps exactly one record when two admins delete at once', async () => {
      await aUser('admin2', 'admin');

      const results = await Promise.all([
        repository.softDeleteQuackAsModerator('q1', 'admin', 'First'),
        repository.softDeleteQuackAsModerator('q1', 'admin2', 'Second'),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await prisma.quackDeletion.count()).toBe(1);
    });

    // "❤️" is two characters to Postgres (the heart and U+FE0F), which is how
    // DeleteQuackDto counts them too: 250 of them is the longest reason it
    // lets through, and the column must take it.
    it('stores the longest reason the DTO accepts', async () => {
      const reason = '❤️'.repeat(250);

      await expect(
        repository.softDeleteQuackAsModerator('q1', 'admin', reason),
      ).resolves.toBe(true);
      expect((await deletionOf('q1'))?.reason).toBe(reason);
    });

    it('deletes nothing when the record cannot be written', async () => {
      // one character over the column: the insert fails after the UPDATE,
      // and the transaction takes the UPDATE back with it
      await expect(
        repository.softDeleteQuackAsModerator('q1', 'admin', '❤️'.repeat(251)),
      ).rejects.toThrow();

      expect((await storedQuack('q1')).deletedAt).toBeNull();
    });
  });

  describe('deleting a user', () => {
    it('keeps the record of quacks they removed from others, without naming them', async () => {
      await aUser('author');
      await aUser('admin', 'admin');
      await aQuack('q1', 'author');
      await repository.softDeleteQuackAsModerator('q1', 'admin', 'Quackery');

      await prisma.user.delete({ where: { id: 'admin' } });

      expect(await deletionOf('q1')).toMatchObject({
        deletedById: null,
        reason: 'Quackery',
      });
    });

    it('takes the record of their own deleted quack along with the quack', async () => {
      await aUser('author');
      await aQuack('q1', 'author');
      await repository.softDeleteOwnQuack('q1', 'author');

      await prisma.user.delete({ where: { id: 'author' } });

      expect(await prisma.quackDeletion.count()).toBe(0);
    });
  });
});
