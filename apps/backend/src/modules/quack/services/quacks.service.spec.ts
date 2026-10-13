// Example unit test — the pattern to copy for your own services.
// The repository is mocked, so the test exercises the service in isolation.
import {
  InvalidPollError,
  Poll,
  Quack,
  QuackHasNoPollError,
  QuackNotFoundError,
} from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { mock } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'quack quack',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  poll: null,
  ...overrides,
});

const aPoll = (overrides: Partial<Poll> = {}): Poll => ({
  id: 'p1',
  options: [
    { id: 'o1', text: 'Pizza', position: 0, votes: 2 },
    { id: 'o2', text: 'Sushi', position: 1, votes: 1 },
  ],
  totalVotes: 3,
  myOptionId: null,
  ...overrides,
});

const viewer = { id: 'u1' } as Identity;

describe('QuacksService', () => {
  describe('getQuacks', () => {
    it('returns quacks from the repository for the viewer', async () => {
      const quacks = [aQuack()];
      const repository = mock<QuackRepository>();
      repository.getQuacks.mockResolvedValue(quacks);

      const service = new QuacksService(repository);

      await expect(service.getQuacks(viewer)).resolves.toEqual(quacks);
      expect(repository.getQuacks).toHaveBeenCalledTimes(1);
      // no search means the unfiltered feed; the viewer decides `myOptionId`
      expect(repository.getQuacks).toHaveBeenCalledWith({}, 'u1');
    });

    it('passes a trimmed search through to the repository', async () => {
      const repository = mock<QuackRepository>();
      repository.getQuacks.mockResolvedValue([]);

      const service = new QuacksService(repository);

      await service.getQuacks(viewer, { search: '  duck ' });
      expect(repository.getQuacks).toHaveBeenCalledWith(
        { search: 'duck' },
        'u1',
      );
    });

    it('treats a blank search as no search', async () => {
      const repository = mock<QuackRepository>();
      repository.getQuacks.mockResolvedValue([]);

      const service = new QuacksService(repository);

      await service.getQuacks(viewer, { search: '   ' });
      expect(repository.getQuacks).toHaveBeenCalledWith({}, 'u1');
    });
  });

  describe('createQuack', () => {
    it('creates a quack owned by the signed-in user', async () => {
      const created = aQuack({ id: 'q2', text: 'hello' });
      const repository = mock<QuackRepository>();
      repository.createQuack.mockResolvedValue(created);

      const service = new QuacksService(repository);

      await expect(
        service.createQuack(viewer, { text: 'hello' }),
      ).resolves.toEqual(created);
      // the author comes from the session, not from the caller's payload;
      // a missing mood is stored as null; no poll means no poll options
      expect(repository.createQuack).toHaveBeenCalledWith({
        text: 'hello',
        mood: null,
        userId: 'u1',
        pollOptions: undefined,
      });
    });

    it('stores the chosen mood with the quack', async () => {
      const created = aQuack({ id: 'q3', text: 'ha!', mood: 'silly' });
      const repository = mock<QuackRepository>();
      repository.createQuack.mockResolvedValue(created);

      const service = new QuacksService(repository);

      await expect(
        service.createQuack(viewer, { text: 'ha!', mood: 'silly' }),
      ).resolves.toEqual(created);
      expect(repository.createQuack).toHaveBeenCalledWith({
        text: 'ha!',
        mood: 'silly',
        userId: 'u1',
        pollOptions: undefined,
      });
    });

    it('stores trimmed poll options in the given order', async () => {
      const created = aQuack({ id: 'q4', poll: aPoll() });
      const repository = mock<QuackRepository>();
      repository.createQuack.mockResolvedValue(created);

      const service = new QuacksService(repository);

      await expect(
        service.createQuack(viewer, {
          text: 'Lunch?',
          pollOptions: ['  Pizza', 'Sushi  '],
        }),
      ).resolves.toEqual(created);
      expect(repository.createQuack).toHaveBeenCalledWith({
        text: 'Lunch?',
        mood: null,
        userId: 'u1',
        pollOptions: ['Pizza', 'Sushi'],
      });
    });

    it.each([
      ['one option', ['Pizza']],
      ['five options', ['A', 'B', 'C', 'D', 'E']],
      ['a blank option', ['Pizza', '   ']],
      ['an option over 50 characters', ['Pizza', 'x'.repeat(51)]],
      // same text once the surrounding whitespace is gone
      ['two options that read the same', ['Pizza', ' Pizza ']],
    ])('rejects a poll with %s', async (_label, pollOptions) => {
      const repository = mock<QuackRepository>();
      const service = new QuacksService(repository);

      await expect(
        service.createQuack(viewer, { text: 'Lunch?', pollOptions }),
      ).rejects.toBeInstanceOf(InvalidPollError);
      expect(repository.createQuack).not.toHaveBeenCalled();
    });

    it('keeps options that differ only by case', async () => {
      const repository = mock<QuackRepository>();
      repository.createQuack.mockResolvedValue(aQuack({ poll: aPoll() }));

      const service = new QuacksService(repository);

      await service.createQuack(viewer, {
        text: 'Lunch?',
        pollOptions: ['Pizza', 'pizza'],
      });
      expect(repository.createQuack).toHaveBeenCalledWith(
        expect.objectContaining({ pollOptions: ['Pizza', 'pizza'] }),
      );
    });
  });

  describe('vote', () => {
    it('upserts the vote on the poll of the quack and returns the fresh quack', async () => {
      const before = aQuack({ poll: aPoll() });
      const after = aQuack({
        poll: aPoll({
          options: [
            { id: 'o1', text: 'Pizza', position: 0, votes: 3 },
            { id: 'o2', text: 'Sushi', position: 1, votes: 1 },
          ],
          totalVotes: 4,
          myOptionId: 'o1',
        }),
      });
      const repository = mock<QuackRepository>();
      repository.findQuackById
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      repository.upsertVote.mockResolvedValue();

      const service = new QuacksService(repository);

      await expect(service.vote(viewer, 'q1', 'o1')).resolves.toEqual(after);
      // keyed on the poll, not the quack: that is what the unique vote row is on
      expect(repository.upsertVote).toHaveBeenCalledWith({
        pollId: 'p1',
        userId: 'u1',
        optionId: 'o1',
      });
      // the counts come from a re-read, never from local arithmetic
      expect(repository.findQuackById).toHaveBeenCalledTimes(2);
      expect(repository.findQuackById).toHaveBeenLastCalledWith('q1', 'u1');
    });

    it('rejects a vote on a quack that does not exist', async () => {
      const repository = mock<QuackRepository>();
      repository.findQuackById.mockResolvedValue(null);

      const service = new QuacksService(repository);

      await expect(
        service.vote(viewer, 'missing', 'o1'),
      ).rejects.toBeInstanceOf(QuackNotFoundError);
      expect(repository.upsertVote).not.toHaveBeenCalled();
    });

    it('rejects a vote on a quack without a poll', async () => {
      const repository = mock<QuackRepository>();
      repository.findQuackById.mockResolvedValue(aQuack({ poll: null }));

      const service = new QuacksService(repository);

      await expect(service.vote(viewer, 'q1', 'o1')).rejects.toBeInstanceOf(
        QuackHasNoPollError,
      );
      expect(repository.upsertVote).not.toHaveBeenCalled();
    });
  });
});
