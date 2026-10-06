import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Prisma,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

const mapPrismaQuackToDomain = (
  quack: PrismaQuack & { user?: PrismaUser },
): Quack => ({
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
        username: quack.user.username ?? '',
      }
    : undefined,
});

export type QuackListFilter = {
  // Already trimmed and non-empty when present — the service normalises it.
  search?: string;
};

// Plain substring match on the text and on the author's name and username,
// case-insensitive (ILIKE). This is deliberately not full-text search: no
// stemming, no ranking. It composes with `take`/`cursor` once the feed pages.
const buildWhere = (
  filter: QuackListFilter,
): Prisma.QuackWhereInput | undefined => {
  if (!filter.search) return undefined;
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

  async getQuacks(filter: QuackListFilter = {}): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
      where: buildWhere(filter),
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return quacks.map(mapPrismaQuackToDomain);
  }

  async createQuack(createQuackData: {
    text: string;
    mood: QuackMood | null;
    userId: string;
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
      },
      include: { user: true },
    });
    return mapPrismaQuackToDomain(quack);
  }
}
