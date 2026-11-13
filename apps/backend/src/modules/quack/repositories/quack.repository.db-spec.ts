// The repository against a real Postgres (`pnpm backend test:db`), for what
// the mocked Prisma in quack.repository.spec.ts cannot show: that the raw
// moderator UPDATE runs at all (the enum cast, MODERATOR_ROLES bound as an
// array through the driver adapter) and that the database itself keeps the
// guarantees the deletion code relies on. Likewise for replies: the reply
// INSERT … SELECT, what a list returns for a deleted quack with live replies,
// and what the parent foreign key does when an account is deleted.
import { PrismaService } from '@/core/prisma/prisma.service';
import { UserRole } from '@/generated/prisma/client';
import { Quack } from '@/modules/quack/domain/quack';
import { QuackRepository } from './quack.repository';

describe('QuackRepository against Postgres', () => {
  const prisma = new PrismaService();
  const repository = new QuackRepository(prisma);

  afterAll(() => prisma.$disconnect());

  beforeEach(() =>
    prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "quack_reply", "quack_deletion", "poll_vote", "poll_option", "poll", "quack", "user" CASCADE',
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
  const aQuack = (id: string, userId: string, text = `Quack ${id}`) =>
    prisma.quack.create({ data: { id, text, userId } });
  // Through the repository, so the reply is written the way the app writes it.
  const aReply = async (
    parentId: string,
    userId: string,
    text: string,
  ): Promise<Quack> => {
    const reply = await repository.createReply({
      parentId,
      userId,
      text,
      mood: null,
    });
    if (!reply) throw new Error(`reply to ${parentId} was refused`);
    return reply;
  };
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

  describe('replies', () => {
    beforeEach(async () => {
      await aUser('jana');
      await aUser('petr');
      await aQuack('q1', 'jana', 'Duckweed tea cures molting');
    });

    describe('createReply', () => {
      it('writes a reply under a live quack', async () => {
        const reply = await aReply('q1', 'petr', 'Source?');

        expect(
          await prisma.quackReply.findUnique({ where: { quackId: reply.id } }),
        ).toEqual({ quackId: reply.id, parentId: 'q1' });
      });

      it('refuses a deleted quack and leaves no reply behind', async () => {
        await repository.softDeleteOwnQuack('q1', 'jana');

        await expect(
          repository.createReply({
            parentId: 'q1',
            userId: 'petr',
            text: 'Too late',
            mood: null,
          }),
        ).resolves.toBeNull();
        // the quack row written first went with the rolled-back transaction
        expect(await prisma.quack.count()).toBe(1);
      });

      it('refuses a reply to a reply', async () => {
        const reply = await aReply('q1', 'petr', 'Source?');

        await expect(
          repository.createReply({
            parentId: reply.id,
            userId: 'jana',
            text: 'Trust me',
            mood: null,
          }),
        ).resolves.toBeNull();
        expect(await repository.findReplyTarget(reply.id)).toEqual({
          isReply: true,
        });
      });

      it('refuses a quack that does not exist', async () => {
        await expect(
          repository.createReply({
            parentId: 'nope',
            userId: 'petr',
            text: 'Hello?',
            mood: null,
          }),
        ).resolves.toBeNull();
        expect(await repository.findReplyTarget('nope')).toBeNull();
      });
    });

    describe('lists', () => {
      it('shows only top-level quacks, with the count of live replies', async () => {
        await aReply('q1', 'petr', 'Source?');
        const gone = await aReply('q1', 'petr', 'Never mind');
        await repository.softDeleteOwnQuack(gone.id, 'petr');

        const listed = await repository.getQuacks({}, 'petr');

        expect(listed).toEqual([
          expect.objectContaining({ id: 'q1', replyCount: 1 }),
        ]);
      });

      it('keeps a deleted quack with live replies as a placeholder, without its text', async () => {
        await aReply('q1', 'petr', 'Source?');
        await repository.softDeleteOwnQuack('q1', 'jana');

        const [listed] = await repository.getQuacks({}, 'petr');

        expect(listed).toMatchObject({
          id: 'q1',
          deleted: true,
          replyCount: 1,
        });
        expect(JSON.stringify(listed)).not.toContain('Duckweed');
      });

      it('drops the placeholder once its last reply is deleted', async () => {
        const reply = await aReply('q1', 'petr', 'Source?');
        await repository.softDeleteOwnQuack('q1', 'jana');
        await repository.softDeleteOwnQuack(reply.id, 'petr');

        expect(await repository.getQuacks({}, 'petr')).toEqual([]);
        expect(await repository.getReplies('q1', 'petr')).toBeNull();
      });

      it('finds a quack by a word in one of its replies, and says so', async () => {
        await aQuack('q2', 'jana', 'Nice weather');
        await aReply('q1', 'petr', 'Is that from the pond by the mill?');

        const listed = await repository.getQuacks({ search: 'mill' }, 'jana');

        expect(listed).toEqual([
          expect.objectContaining({ id: 'q1', matchedInReplies: true }),
        ]);
      });

      it('never finds a deleted quack by its own text, only through a reply', async () => {
        await aReply('q1', 'petr', 'Source?');
        await repository.softDeleteOwnQuack('q1', 'jana');

        expect(
          await repository.getQuacks({ search: 'duckweed' }, 'petr'),
        ).toEqual([]);
        expect(
          await repository.getQuacks({ search: 'source' }, 'petr'),
        ).toEqual([expect.objectContaining({ id: 'q1', deleted: true })]);
      });

      it("lists under 'mine' the quacks someone replied under, until the reply goes", async () => {
        await aQuack('q2', 'jana', 'Nice weather');
        const reply = await aReply('q1', 'petr', 'Source?');

        const mine = await repository.getQuacks({ authorId: 'petr' }, 'petr');
        expect(mine).toEqual([
          expect.objectContaining({ id: 'q1', matchedInReplies: true }),
        ]);

        await repository.softDeleteOwnQuack(reply.id, 'petr');
        expect(
          await repository.getQuacks({ authorId: 'petr' }, 'petr'),
        ).toEqual([]);
      });

      it('returns the thread oldest first, without deleted replies', async () => {
        const first = await aReply('q1', 'petr', 'First');
        const gone = await aReply('q1', 'jana', 'Oops');
        const third = await aReply('q1', 'jana', 'Third');
        await repository.softDeleteOwnQuack(gone.id, 'jana');

        const thread = await repository.getReplies('q1', 'petr');

        expect(thread?.map(({ id }) => id)).toEqual([first.id, third.id]);
      });

      it('has no thread for a reply', async () => {
        const reply = await aReply('q1', 'petr', 'Source?');

        expect(await repository.getReplies(reply.id, 'petr')).toBeNull();
      });
    });

    describe('deleting an account', () => {
      it("is refused while someone else's reply is under one of its quacks", async () => {
        await aReply('q1', 'petr', 'Source?');

        await expect(
          prisma.user.delete({ where: { id: 'jana' } }),
        ).rejects.toThrow();
        expect(await prisma.quack.count()).toBe(2);
      });

      it('goes through when the only replies are its own, under its own quacks', async () => {
        // NoAction checks after the cascade has removed the reply too;
        // Restrict would have refused here
        await aReply('q1', 'jana', 'Edit: it does not');

        await prisma.user.delete({ where: { id: 'jana' } });

        expect(await prisma.quack.count()).toBe(0);
        expect(await prisma.quackReply.count()).toBe(0);
      });

      it("takes the account's replies under other people's quacks with it", async () => {
        await aReply('q1', 'petr', 'Source?');

        await prisma.user.delete({ where: { id: 'petr' } });

        expect(await prisma.quackReply.count()).toBe(0);
        expect(await repository.getQuacks({}, 'jana')).toEqual([
          expect.objectContaining({ id: 'q1', replyCount: 0 }),
        ]);
      });
    });
  });
});
