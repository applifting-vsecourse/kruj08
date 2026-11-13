import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Prisma,
  Poll as PrismaPoll,
  PollOption as PrismaPollOption,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import {
  DeletedQuack,
  ListedQuack,
  MODERATOR_ROLES,
  Poll,
  PollOptionNotFoundError,
  Quack,
  QuackAuthor,
  QuackMood,
} from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

// Everything the feed and the vote response need in one shape: the author,
// the poll with per-option vote counts, and the viewer's own vote (at most one
// row thanks to the (pollId, userId) primary key). Spelled out as a type so
// Prisma infers the exact result shape rather than a widened `QuackInclude`.
type QuackIncludeWithPoll = {
  user: true;
  poll: {
    include: {
      options: {
        orderBy: { position: 'asc' };
        include: { _count: { select: { votes: true } } };
      };
      votes: { where: { userId: string }; select: { optionId: true } };
    };
  };
};

const withPoll = (viewerId: string): QuackIncludeWithPoll => ({
  user: true,
  poll: {
    include: {
      options: {
        orderBy: { position: 'asc' },
        include: { _count: { select: { votes: true } } },
      },
      votes: { where: { userId: viewerId }, select: { optionId: true } },
    },
  },
});

type PrismaQuackWithPoll = PrismaQuack & {
  user?: PrismaUser;
  // Live replies, when the read asked for the count (lists only).
  _count?: { replies: number };
  poll?:
    | (PrismaPoll & {
        options: (PrismaPollOption & { _count: { votes: number } })[];
        votes: { optionId: string }[];
      })
    | null;
};

const mapPrismaPollToDomain = (
  poll: NonNullable<PrismaQuackWithPoll['poll']>,
): Poll => {
  const options = poll.options.map((option) => ({
    id: option.id,
    text: option.text,
    position: option.position,
    votes: option._count.votes,
  }));
  return {
    id: poll.id,
    options,
    totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    myOptionId: poll.votes[0]?.optionId ?? null,
  };
};

const mapPrismaUserToAuthor = (user: PrismaUser): QuackAuthor => ({
  id: user.id,
  name: user.name,
  // The handle as typed; BetterAuth keeps the lowercased copy in `username`.
  username: user.displayUsername ?? user.username ?? '',
});

const mapPrismaQuackToDomain = (quack: PrismaQuackWithPoll): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  user: quack.user ? mapPrismaUserToAuthor(quack.user) : undefined,
  poll: quack.poll ? mapPrismaPollToDomain(quack.poll) : null,
  replyCount: quack._count?.replies ?? 0,
});

// A row a list read may return deleted (see `listedInThreads`) becomes a
// placeholder here, built field by field so the text, mood and poll the row
// still holds never leave this file.
const mapPrismaListedQuackToDomain = (
  quack: PrismaQuackWithPoll,
): Quack | DeletedQuack =>
  quack.deletedAt
    ? {
        id: quack.id,
        deleted: true,
        userId: quack.userId,
        createdAt: quack.createdAt,
        user: quack.user ? mapPrismaUserToAuthor(quack.user) : undefined,
        replyCount: quack._count?.replies ?? 0,
      }
    : mapPrismaQuackToDomain(quack);

export type QuackListFilter = {
  // Already trimmed and non-empty when present — the service normalises it.
  search?: string;
  // Only this user's quacks. The service resolves it from the session.
  authorId?: string;
};

// The one place that decides a deleted quack does not exist. Every read in
// this repository wraps its `where` in it, and quack.repository.spec.ts fails
// for a new method until it is checked against a deleted quack too. ESLint
// (no-restricted-syntax) keeps quack queries out of every other file.
//
// `deletedAt` comes after the spread on purpose: it overwrites any `deletedAt`
// in `where`, so no caller can ask for deleted quacks through this helper.
// Swapped round, the caller's value would win. Exported only for its spec.
export const notDeleted = <Where extends Prisma.QuackWhereInput>(
  where: Where,
): Where & { deletedAt: null } => ({ ...where, deletedAt: null });

// A reply that is not deleted and `matches`. A deleted reply neither counts,
// nor is found by a search, nor keeps a placeholder alive.
const liveReply = (
  matches: Prisma.QuackWhereInput = {},
): Prisma.QuackReplyWhereInput => ({ quack: notDeleted(matches) });

// The one exception to `notDeleted`, and the only place that makes it. A
// list shows top-level quacks only, each either alive and matching itself, or
// — alive or deleted — with a live reply that matches. That one condition
// gives the feed its placeholders (a deleted quack with live replies), a
// search its hits in replies, and "mine" the threads the viewer replied in.
// A deleted quack only ever comes back through a reply, never through its own
// text, and mapPrismaListedQuackToDomain empties it. Exported for its spec.
export const listedInThreads = (
  matches: Prisma.QuackWhereInput,
): Prisma.QuackWhereInput => ({
  reply: { is: null },
  OR: [notDeleted(matches), { replies: { some: liveReply(matches) } }],
});

// Thrown inside createReply's transaction to roll it back; never escapes.
class ReplyRefused extends Error {}

// The search is a plain substring match on the text and on the author's name
// and username, case-insensitive (ILIKE). This is deliberately not full-text
// search: no stemming, no ranking. It composes with `take`/`cursor` once the
// feed pages.
const searchWhere = (search: string): Prisma.QuackWhereInput => {
  const contains = { contains: search, mode: 'insensitive' as const };
  return {
    OR: [
      { text: contains },
      { user: { name: contains } },
      { user: { username: contains } },
    ],
  };
};

// The author and the search are sibling keys, which Prisma ANDs: a search on
// "my quacks" only ever matches my quacks.
const buildWhere = (filter: QuackListFilter): Prisma.QuackWhereInput => ({
  ...(filter.authorId ? { userId: filter.authorId } : {}),
  ...(filter.search ? searchWhere(filter.search) : {}),
});

// Marks the quack deleted and writes the record of who did it, in one
// transaction. `markDeleted` is a single UPDATE whose condition alone decides
// whether there is anything to delete and whether this user may, so no
// request can slip in between a check and the write. It returns the number of
// rows it changed. Of two concurrent deletions the second waits on the row,
// then matches nothing: the record that stays is the first one's.
const softDelete = (
  prisma: PrismaService,
  markDeleted: (
    tx: Prisma.TransactionClient,
    deletedAt: Date,
  ) => Promise<number>,
  deletion: { quackId: string; deletedById: string; reason: string | null },
): Promise<boolean> =>
  prisma.$transaction(async (tx) => {
    const deletedAt = new Date();
    if ((await markDeleted(tx, deletedAt)) === 0) {
      return false;
    }
    await tx.quackDeletion.create({
      data: { ...deletion, createdAt: deletedAt },
    });
    return true;
  });

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  // `viewerId` decides whose vote comes back as `poll.myOptionId`.
  async getQuacks(
    filter: QuackListFilter = {},
    viewerId: string,
  ): Promise<ListedQuack[]> {
    const matches = buildWhere(filter);
    const isNarrowed = Object.keys(matches).length > 0;
    const quacks = await this.prisma.quack.findMany({
      where: listedInThreads(matches),
      include: {
        ...withPoll(viewerId),
        _count: { select: { replies: { where: liveReply() } } },
        // At most one matching live reply: only whether there is one matters.
        replies: {
          where: liveReply(matches),
          select: { quackId: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return quacks.map((quack) => ({
      ...mapPrismaListedQuackToDomain(quack),
      // Unnarrowed, every quack with a live reply would "match" in it.
      matchedInReplies: isNarrowed && quack.replies.length > 0,
    }));
  }

  // The live replies under a quack a list shows, oldest first. Null when no
  // list shows it: it does not exist, is deleted with no live reply left, or
  // is a reply itself.
  async getReplies(
    parentId: string,
    viewerId: string,
  ): Promise<Quack[] | null> {
    const parent = await this.prisma.quack.findFirst({
      where: { ...listedInThreads({}), id: parentId },
      select: { id: true },
    });
    if (!parent) {
      return null;
    }
    const replies = await this.prisma.quack.findMany({
      where: notDeleted({ reply: { is: { parentId } } }),
      include: withPoll(viewerId),
      // The id breaks ties between replies posted in the same millisecond.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return replies.map(mapPrismaQuackToDomain);
  }

  // Whether a live quack is a reply, or null when there is no live quack with
  // this id. Only for telling apart why createReply refused.
  async findReplyTarget(id: string): Promise<{ isReply: boolean } | null> {
    const quack = await this.prisma.quack.findUnique({
      where: notDeleted({ id }),
      select: { reply: { select: { parentId: true } } },
    });
    return quack ? { isReply: quack.reply !== null } : null;
  }

  async findQuackById(id: string, viewerId: string): Promise<Quack | null> {
    const quack = await this.prisma.quack.findUnique({
      where: notDeleted({ id }),
      include: withPoll(viewerId),
    });
    return quack ? mapPrismaQuackToDomain(quack) : null;
  }

  // Who wrote the quack, or null when it does not exist (or is deleted). Only
  // the author's id: the caller needs it to tell "not yours" from "gone".
  async findQuackAuthorId(id: string): Promise<string | null> {
    const quack = await this.prisma.quack.findUnique({
      where: notDeleted({ id }),
      select: { userId: true },
    });
    return quack?.userId ?? null;
  }

  // The ownership check is part of the write: the row is only touched when it
  // is still there and belongs to `userId`. Returns whether anything was
  // deleted.
  async softDeleteOwnQuack(id: string, userId: string): Promise<boolean> {
    return softDelete(
      this.prisma,
      async (tx, deletedAt) => {
        const { count } = await tx.quack.updateMany({
          where: notDeleted({ id, userId }),
          data: { deletedAt },
        });
        return count;
      },
      { quackId: id, deletedById: userId, reason: null },
    );
  }

  // A moderator removing any quack. Whether `moderatorId` moderates is part
  // of the write, just like the author above: the row is only touched when
  // the database, at that moment, gives the user one of MODERATOR_ROLES —
  // whatever the caller or the session believed. Returns whether anything was
  // deleted; the caller tells "gone" from "not a moderator" with a read.
  //
  // Raw SQL because updateMany can only filter on rows related to the quack,
  // and the moderator is not one. The statement therefore spells out what
  // Prisma would do for us: the `notDeleted` condition and @updatedAt.
  async softDeleteQuackAsModerator(
    id: string,
    moderatorId: string,
    reason: string,
  ): Promise<boolean> {
    return softDelete(
      this.prisma,
      (tx, deletedAt) => tx.$executeRaw`
        UPDATE "quack"
        SET "deletedAt" = ${deletedAt}, "updatedAt" = ${deletedAt}
        WHERE "id" = ${id}
          AND "deletedAt" IS NULL
          AND EXISTS (
            SELECT 1 FROM "user"
            WHERE "id" = ${moderatorId}
              AND "role"::text = ANY(${[...MODERATOR_ROLES]})
          )`,
      { quackId: id, deletedById: moderatorId, reason },
    );
  }

  async createQuack(createQuackData: {
    text: string;
    mood: QuackMood | null;
    userId: string;
    // Already trimmed and validated by the service. Absent (not empty) for a
    // plain quack, so no empty poll row is ever written.
    pollOptions?: string[];
  }): Promise<Quack> {
    const { pollOptions } = createQuackData;
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
        poll: pollOptions
          ? {
              create: {
                options: {
                  create: pollOptions.map((text, position) => ({
                    text,
                    position,
                  })),
                },
              },
            }
          : undefined,
      },
      include: withPoll(createQuackData.userId),
    });
    return mapPrismaQuackToDomain(quack);
  }

  // The reply quack and the row that makes it one, in one transaction. The
  // INSERT … SELECT of that row alone decides whether the reply may exist: it
  // writes only while the parent is alive and is not a reply itself, so no
  // request slips in between a check and the write. It also takes a share
  // lock on the parent, so a deletion running at the same time either waits
  // and comes after the reply, or goes first and the reply is refused —
  // never a reply under a parent that was deleted before it was written.
  // Returns null when refused; nothing is left behind.
  async createReply(replyData: {
    parentId: string;
    userId: string;
    text: string;
    mood: QuackMood | null;
  }): Promise<Quack | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const reply = await tx.quack.create({
          data: {
            text: replyData.text,
            mood: replyData.mood,
            user: { connect: { id: replyData.userId } },
          },
          include: withPoll(replyData.userId),
        });
        const written = await tx.$executeRaw`
          INSERT INTO "quack_reply" ("quackId", "parentId")
          SELECT ${reply.id}, "parent"."id"
          FROM "quack" AS "parent"
          WHERE "parent"."id" = ${replyData.parentId}
            AND "parent"."deletedAt" IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM "quack_reply" WHERE "quackId" = "parent"."id"
            )
          FOR SHARE OF "parent"`;
        if (written === 0) {
          throw new ReplyRefused();
        }
        return mapPrismaQuackToDomain(reply);
      });
    } catch (error) {
      if (error instanceof ReplyRefused) {
        return null;
      }
      throw error;
    }
  }

  // One row per (poll, user): a first vote inserts, a changed vote updates.
  // Prisma turns this into a single INSERT … ON CONFLICT DO UPDATE on
  // Postgres, so two concurrent requests never produce two rows.
  async upsertVote(vote: {
    pollId: string;
    userId: string;
    optionId: string;
  }): Promise<void> {
    try {
      await this.prisma.pollVote.upsert({
        where: { pollId_userId: { pollId: vote.pollId, userId: vote.userId } },
        create: vote,
        update: { optionId: vote.optionId },
      });
    } catch (error) {
      // P2003: the composite FK (pollId, optionId) rejected the row, i.e. the
      // option exists but belongs to a different poll — or not at all.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new PollOptionNotFoundError(vote.optionId);
      }
      throw error;
    }
  }
}
