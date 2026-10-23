import { PrismaService } from '@/core/prisma/prisma.service';
import { QuackMood } from '@/modules/quack/domain/quack';

type CreateQuackParams = {
  text: string;
  userId: string;
  // Optional so the seed shows both plain posts and posts with a mood.
  mood?: QuackMood;
  // Optional so the seed can spread posts over time. Without it every seeded
  // quack shares one timestamp and the feed reads like a single burst.
  createdAt?: Date;
  // Optional so the seed shows both plain posts and posts with a poll. The
  // quack's text is the question.
  pollOptions?: string[];
  // Optional so the seed has a quack its author deleted: the row is there,
  // the feed and search must not show it.
  deletedAt?: Date;
};

export type SeededQuack = {
  id: string;
  // Present when `pollOptions` was given, with the option ids the seed needs
  // to cast votes. Options come back in author order.
  poll: { id: string; options: { id: string; text: string }[] } | null;
};

export async function createQuack(
  prisma: PrismaService,
  params: CreateQuackParams,
): Promise<SeededQuack> {
  const { text, userId, mood, createdAt, pollOptions, deletedAt } = params;

  const quack = await prisma.quack.create({
    data: {
      text,
      mood,
      createdAt,
      deletedAt,
      user: {
        connect: {
          id: userId,
        },
      },
      poll: pollOptions
        ? {
            create: {
              options: {
                create: pollOptions.map((optionText, position) => ({
                  text: optionText,
                  position,
                })),
              },
            },
          }
        : undefined,
    },
    include: {
      poll: {
        include: { options: { orderBy: { position: 'asc' } } },
      },
    },
  });

  return {
    id: quack.id,
    poll: quack.poll
      ? {
          id: quack.poll.id,
          options: quack.poll.options.map(({ id, text: optionText }) => ({
            id,
            text: optionText,
          })),
        }
      : null,
  };
}
