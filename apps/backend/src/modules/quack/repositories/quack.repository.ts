import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Prisma,
  Poll as PrismaPoll,
  PollOption as PrismaPollOption,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import {
  Poll,
  PollOptionNotFoundError,
  Quack,
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

const mapPrismaQuackToDomain = (quack: PrismaQuackWithPoll): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  user: quack.user
    ? {
        id: quack.user.id,
        name: quack.user.name,
        // The handle as typed; BetterAuth keeps the lowercased copy in `username`.
        username: quack.user.displayUsername ?? quack.user.username ?? '',
      }
    : undefined,
  poll: quack.poll ? mapPrismaPollToDomain(quack.poll) : null,
});

export type QuackListFilter = {
  // Already trimmed and non-empty when present — the service normalises it.
  search?: string;
};

// The one place that decides a deleted quack does not exist. Every read in
// this repository wraps its `where` in it, and quack.repository.spec.ts fails
// for a new method until it is checked against a deleted quack too. ESLint
// (no-restricted-syntax) keeps quack queries out of every other file.
const notDeleted = <Where extends Prisma.QuackWhereInput>(
  where: Where,
): Where & { deletedAt: null } => ({ ...where, deletedAt: null });

// Plain substring match on the text and on the author's name and username,
// case-insensitive (ILIKE). This is deliberately not full-text search: no
// stemming, no ranking. It composes with `take`/`cursor` once the feed pages.
const buildWhere = (filter: QuackListFilter): Prisma.QuackWhereInput => {
  if (!filter.search) return {};
  const contains = { contains: filter.search, mode: 'insensitive' as const };
  return {
    OR: [
      { text: contains },
      { user: { name: contains } },
      { user: { username: contains } },
    ],
  };
};

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
  ): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
      where: notDeleted(buildWhere(filter)),
      include: withPoll(viewerId),
      orderBy: { createdAt: 'desc' },
    });
    return quacks.map(mapPrismaQuackToDomain);
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

  // Ownership check and write in one statement: the row is only touched when
  // it is still there and belongs to `userId`, so no request can slip in
  // between a check and the update. Returns whether anything was deleted.
  async softDeleteOwnQuack(id: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.quack.updateMany({
      where: notDeleted({ id, userId }),
      data: { deletedAt: new Date() },
    });
    return count > 0;
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
