import {
  canModerateQuacks,
  DeletionReasonRequiredError,
  InvalidPollError,
  NotAModeratorError,
  POLL_OPTION_MAX_LENGTH,
  POLL_OPTIONS_MAX,
  POLL_OPTIONS_MIN,
  Quack,
  QuackAuthorFilter,
  QuackHasNoPollError,
  QuackMood,
  QuackNotFoundError,
  QuackNotOwnedError,
} from '@/modules/quack/domain/quack';
import {
  QuackListFilter,
  QuackRepository,
} from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable } from '@nestjs/common';

// The DTO already checks the shape (count, length). This repeats the rules on
// the trimmed values and adds the one the DTO cannot express: no two options
// may read the same once surrounding whitespace is gone.
const normalizePollOptions = (options: string[]): string[] => {
  const trimmed = options.map((option) => option.trim());

  if (trimmed.length < POLL_OPTIONS_MIN || trimmed.length > POLL_OPTIONS_MAX) {
    throw new InvalidPollError(
      `A poll needs between ${POLL_OPTIONS_MIN} and ${POLL_OPTIONS_MAX} options`,
    );
  }
  if (
    trimmed.some(
      (option) => option.length === 0 || option.length > POLL_OPTION_MAX_LENGTH,
    )
  ) {
    throw new InvalidPollError(
      `Each poll option must be between 1 and ${POLL_OPTION_MAX_LENGTH} characters`,
    );
  }
  if (new Set(trimmed).size !== trimmed.length) {
    throw new InvalidPollError(
      'Poll options must be different from each other',
    );
  }

  return trimmed;
};

@Injectable()
export class QuacksService {
  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(
    viewer: Identity,
    filter: { search?: string; author?: QuackAuthorFilter } = {},
  ): Promise<Quack[]> {
    // An empty or whitespace-only search is "no search", so the repository
    // sees one representation of the unfiltered feed.
    const search = filter.search?.trim();
    const listFilter: QuackListFilter = {
      ...(search ? { search } : {}),
      // "me" is resolved from the session here; the client never sends an id.
      ...(filter.author === 'me' ? { authorId: viewer.id } : {}),
    };
    return this.quackRepository.getQuacks(listFilter, viewer.id);
  }

  async createQuack(
    user: Identity,
    quackData: {
      text: string;
      mood?: QuackMood | null;
      pollOptions?: string[];
    },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      // "no mood" is stored as null so the database has one representation of it
      mood: quackData.mood ?? null,
      // the author is taken from the session, never from the request body
      userId: user.id,
      pollOptions: quackData.pollOptions
        ? normalizePollOptions(quackData.pollOptions)
        : undefined,
    });
  }

  // Soft delete. An admin may delete any quack and must say why; anyone else
  // only their own, and no reason is asked or kept. Either way the repository
  // checks the right to delete inside the write and records who did it; the
  // role in the session only picks the path and whether a reason is needed.
  async deleteQuack(
    user: Identity,
    quackId: string,
    reason?: string,
  ): Promise<void> {
    if (canModerateQuacks(user.role)) {
      // The DTO trims already; this keeps "   " from counting as a reason
      // for any other caller too.
      const trimmed = reason?.trim();
      if (!trimmed) {
        throw new DeletionReasonRequiredError(quackId);
      }
      if (
        await this.quackRepository.softDeleteQuackAsModerator(
          quackId,
          user.id,
          trimmed,
        )
      ) {
        return;
      }
      // Nothing was deleted: either the quack is gone, or the database no
      // longer counts this user as a moderator. The read only picks which.
      if ((await this.quackRepository.findQuackAuthorId(quackId)) === null) {
        throw new QuackNotFoundError(quackId);
      }
      throw new NotAModeratorError(user.id);
    }

    if (await this.quackRepository.softDeleteOwnQuack(quackId, user.id)) {
      return;
    }
    // Nothing was deleted. The write already decided that; this read only
    // picks which error to report.
    const authorId = await this.quackRepository.findQuackAuthorId(quackId);
    if (authorId === null) {
      throw new QuackNotFoundError(quackId);
    }
    throw new QuackNotOwnedError(quackId);
  }

  // Casting a first vote and changing it are the same operation: the viewer
  // ends up with exactly one vote in the poll, on `optionId`.
  async vote(
    user: Identity,
    quackId: string,
    optionId: string,
  ): Promise<Quack> {
    const quack = await this.quackRepository.findQuackById(quackId, user.id);
    if (!quack) {
      throw new QuackNotFoundError(quackId);
    }
    if (!quack.poll) {
      throw new QuackHasNoPollError(quackId);
    }

    await this.quackRepository.upsertVote({
      pollId: quack.poll.id,
      userId: user.id,
      optionId,
    });

    // Re-read rather than patch the counts locally, so the response is what
    // the database says — the same numbers every other viewer will get.
    const updated = await this.quackRepository.findQuackById(quackId, user.id);
    if (!updated) {
      // Deleted between the upsert and the re-read; treat it as gone.
      throw new QuackNotFoundError(quackId);
    }
    return updated;
  }
}
