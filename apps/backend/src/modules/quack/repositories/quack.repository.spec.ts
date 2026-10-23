// A deleted quack must not come back from any read, including reads added
// later. Prisma is faked, so the test checks the query the repository asks
// for — that is where the rule lives (see `notDeleted`).
import { PrismaService } from '@/core/prisma/prisma.service';
import { notDeleted, QuackRepository } from './quack.repository';

// Every way Prisma can read quacks. A read method is checked against all of
// them, so switching from findUnique to findFirst does not dodge the test.
const QUACK_READS = [
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
] as const;

type FakePrisma = {
  quack: Record<string, jest.Mock>;
  pollVote: { upsert: jest.Mock };
};

const fakePrisma = (): { prisma: FakePrisma; repository: QuackRepository } => {
  const quack: Record<string, jest.Mock> = Object.fromEntries(
    QUACK_READS.map((operation) => [
      operation,
      jest.fn().mockResolvedValue(operation === 'findMany' ? [] : null),
    ]),
  );
  quack.create = jest.fn();
  quack.updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma: FakePrisma = { quack, pollVote: { upsert: jest.fn() } };
  return {
    prisma,
    repository: new QuackRepository(prisma as unknown as PrismaService),
  };
};

// The `where` of every quack read the repository made.
const quackReadsMadeBy = (prisma: FakePrisma): (object | undefined)[] =>
  QUACK_READS.flatMap((operation) =>
    prisma.quack[operation].mock.calls.map(
      ([args]) => (args as { where?: object }).where,
    ),
  );

// The repository's public methods that read quacks, each with a way to call
// it. When you add a read, add it here; the test below tells you if you forgot.
const READS: {
  method: keyof QuackRepository;
  label: string;
  call: (repository: QuackRepository) => Promise<unknown>;
}[] = [
  {
    method: 'getQuacks',
    label: 'the feed',
    call: (repository) => repository.getQuacks({}, 'viewer'),
  },
  {
    method: 'getQuacks',
    label: 'a search',
    call: (repository) => repository.getQuacks({ search: 'duck' }, 'viewer'),
  },
  {
    method: 'findQuackById',
    label: 'one quack, e.g. before a vote',
    call: (repository) => repository.findQuackById('q1', 'viewer'),
  },
  {
    method: 'findQuackAuthorId',
    label: 'the author of a quack',
    call: (repository) => repository.findQuackAuthorId('q1'),
  },
];

// Methods that only write. They are exempt from the check above.
const WRITES: (keyof QuackRepository)[] = [
  'createQuack',
  'upsertVote',
  'softDeleteOwnQuack',
];

describe('QuackRepository', () => {
  it('has every public method listed as a read or a write', () => {
    const methods = Object.getOwnPropertyNames(
      QuackRepository.prototype,
    ).filter((name) => name !== 'constructor');
    const listed = new Set([...READS.map(({ method }) => method), ...WRITES]);

    // A new method fails here until it is listed. If it reads quacks, it goes
    // into READS and must then pass "skips deleted quacks" as well.
    expect(methods.filter((name) => !listed.has(name as never))).toEqual([]);
  });

  describe.each(READS)('$method ($label)', ({ call }) => {
    it('skips deleted quacks', async () => {
      const { prisma, repository } = fakePrisma();

      await call(repository);

      const wheres = quackReadsMadeBy(prisma);
      // A read that never asks Prisma for quacks would pass vacuously.
      expect(wheres.length).toBeGreaterThan(0);
      for (const where of wheres) {
        expect(where).toMatchObject({ deletedAt: null });
      }
    });
  });

  it('keeps the search when it adds the deleted filter', async () => {
    const { prisma, repository } = fakePrisma();

    await repository.getQuacks({ search: 'duck' }, 'viewer');

    expect(prisma.quack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: expect.any(Array) as unknown, deletedAt: null },
      }),
    );
  });

  describe('notDeleted', () => {
    it("can't be talked into returning deleted quacks", () => {
      // No method passes `deletedAt` today. This pins the spread order, so a
      // future caller (or a tidy-up of the helper) can't turn the filter off.
      expect(notDeleted({ id: 'q1', deletedAt: { not: null } })).toEqual({
        id: 'q1',
        deletedAt: null,
      });
    });
  });

  describe('softDeleteOwnQuack', () => {
    it('checks the author and that the quack is still there in the same write', async () => {
      const { prisma, repository } = fakePrisma();

      await expect(repository.softDeleteOwnQuack('q1', 'u1')).resolves.toBe(
        true,
      );

      expect(prisma.quack.updateMany).toHaveBeenCalledWith({
        where: { id: 'q1', userId: 'u1', deletedAt: null },
        data: { deletedAt: expect.any(Date) as unknown },
      });
    });

    it('reports when nothing matched', async () => {
      const { prisma, repository } = fakePrisma();
      prisma.quack.updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.softDeleteOwnQuack('q1', 'u1')).resolves.toBe(
        false,
      );
    });
  });
});
