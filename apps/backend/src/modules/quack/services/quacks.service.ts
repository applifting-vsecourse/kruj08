import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import {
  QuackListFilter,
  QuackRepository,
} from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class QuacksService {
  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(filter: { search?: string } = {}): Promise<Quack[]> {
    // An empty or whitespace-only search is "no search", so the repository
    // sees one representation of the unfiltered feed.
    const search = filter.search?.trim();
    const listFilter: QuackListFilter = search ? { search } : {};
    return this.quackRepository.getQuacks(listFilter);
  }

  async createQuack(
    user: Identity,
    quackData: { text: string; mood?: QuackMood | null },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      // "no mood" is stored as null so the database has one representation of it
      mood: quackData.mood ?? null,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }
}
