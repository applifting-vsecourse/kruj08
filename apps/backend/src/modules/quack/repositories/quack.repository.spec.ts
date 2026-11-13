// A deleted quack must not come back from any read, including reads added
// later. Prisma is faked, so the test checks the query the repository asks
// for — that is where the rule lives (see `notDeleted`).
import { PrismaService } from '@/core/prisma/prisma.service';
import {
  listedInThreads,
  notDeleted,
  QuackRepository,
} from './quack.repository';

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
  quackDeletion: { create: jest.Mock };
  pollVote: { upsert: jest.Mock };
  $transaction: jest.Mock;
  $executeRaw: jest.Mock;
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
  const prisma: FakePrisma = {
    quack,
    quackDeletion: { create: jest.fn() },
    pollVote: { upsert: jest.fn() },
    // Rows changed by a raw statement; one unless a test says otherwise.
    $executeRaw: jest.fn().mockResolvedValue(1),
    // An interactive transaction runs its callback against the same fake.
    $transaction: jest.fn((run: (tx: unknown) => Promise<unknown>) =>
      run(prisma),
    ),
  };
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

type Where = Record<string, unknown> | undefined;

// Whether a read's `where` keeps deleted quacks out. It does when it is
// wrapped in `notDeleted`, or when it is the one exception, `listedInThreads`:
// a top-level quack that is alive itself, or reached through a live reply (a
// deleted one then comes back as an empty placeholder — see the test below).
// Any other shape fails, so a new exception has to be added here on purpose.
const hidesDeletedQuacks = (where: Where): boolean => {
  if (where?.deletedAt === null) {
    return true;
  }
  const branches = where?.OR as Where[] | undefined;
  const throughReply = branches?.[1]?.replies as
    { some?: { quack?: Where } } | undefined;
  return (
    (where?.reply as Where)?.is === null &&
    branches?.length === 2 &&
    branches[0]?.deletedAt === null &&
    throughReply?.some?.quack?.deletedAt === null
  );
};

// The repository's public methods that read quacks, each with a way to call
// it. When you add a read, add it here; the test below tells you if you forgot.
const READS: {
  method: keyof QuackRepository;
  label: string;
  call: (repository: QuackRepository, prisma: FakePrisma) => Promise<unknown>;
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
    method: 'getQuacks',
    label: 'my quacks',
    call: (repository) => repository.getQuacks({ authorId: 'u1' }, 'u1'),
  },
  {
    method: 'getQuacks',
    label: 'a search in my quacks',
    call: (repository) =>
      repository.getQuacks({ search: 'duck', authorId: 'u1' }, 'u1'),
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
  {
    method: 'getReplies',
    label: 'the thread under a quack',
    call: (repository, prisma): Promise<unknown> => {
      // the parent is found, so the replies are read as well
      prisma.quack.findFirst.mockResolvedValue({ id: 'q1' });
      return repository.getReplies('q1', 'viewer');
    },
  },
  {
    method: 'findReplyTarget',
    label: 'what a refused reply was aimed at',
    call: (repository) => repository.findReplyTarget('q1'),
  },
];

// Methods that only write. They are exempt from the check above.
const WRITES: (keyof QuackRepository)[] = [
  'createQuack',
  'createReply',
  'upsertVote',
  'softDeleteOwnQuack',
  'softDeleteQuackAsModerator',
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

      await call(repository, prisma);

      const wheres = quackReadsMadeBy(prisma) as Where[];
      // A read that never asks Prisma for quacks would pass vacuously.
      expect(wheres.length).toBeGreaterThan(0);
      expect(wheres.filter((where) => !hidesDeletedQuacks(where))).toEqual([]);
    });
  });

  // What a list matches, applied the way listedInThreads applies it: to the
  // quack itself, or to one of its live replies.
  const listedWhere = (matches: object): object => ({
    reply: { is: null },
    OR: [
      { ...matches, deletedAt: null },
      { replies: { some: { quack: { ...matches, deletedAt: null } } } },
    ],
  });

  it('lists top-level quacks, alive or with a live reply', async () => {
    const { prisma, repository } = fakePrisma();

    await repository.getQuacks({}, 'viewer');

    expect(prisma.quack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: listedWhere({}) }),
    );
  });

  it('looks for a search in the quack and in its live replies', async () => {
    const { prisma, repository } = fakePrisma();

    await repository.getQuacks({ search: 'duck' }, 'viewer');

    expect(prisma.quack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: listedWhere({ OR: expect.any(Array) as unknown }),
      }),
    );
  });

  it('narrows a search to the author instead of replacing it, in replies too', async () => {
    const { prisma, repository } = fakePrisma();

    await repository.getQuacks({ search: 'duck', authorId: 'u1' }, 'u1');

    // Both conditions sit side by side and Prisma ANDs them; neither may
    // swallow the other — on the quack, and on the reply that lists it.
    expect(prisma.quack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: listedWhere({ userId: 'u1', OR: expect.any(Array) as unknown }),
      }),
    );
  });

  describe('a deleted quack in a list', () => {
    const storedRow = {
      id: 'q1',
      text: 'Duckweed tea cures molting',
      mood: 'happy',
      userId: 'u1',
      createdAt: new Date('2026-01-01T12:00:00Z'),
      updatedAt: new Date('2026-01-01T12:00:00Z'),
      deletedAt: new Date('2026-01-02T12:00:00Z'),
      user: { id: 'u1', name: 'Jana', username: 'jana', displayUsername: null },
      poll: null,
      _count: { replies: 2 },
      replies: [],
    };

    it('comes back as a placeholder that holds none of its content', async () => {
      const { prisma, repository } = fakePrisma();
      prisma.quack.findMany.mockResolvedValue([storedRow]);

      const [listed] = await repository.getQuacks({}, 'viewer');

      expect(listed).toEqual({
        id: 'q1',
        deleted: true,
        userId: 'u1',
        createdAt: storedRow.createdAt,
        user: { id: 'u1', name: 'Jana', username: 'jana' },
        replyCount: 2,
        matchedInReplies: false,
      });
      expect(JSON.stringify(listed)).not.toContain('Duckweed');
    });

    it('says a reply listed it only when the list was narrowed', async () => {
      const { prisma, repository } = fakePrisma();
      const row = { ...storedRow, replies: [{ quackId: 'r1' }] };
      prisma.quack.findMany.mockResolvedValue([row]);

      const [inFeed] = await repository.getQuacks({}, 'viewer');
      const [inSearch] = await repository.getQuacks({ search: 'x' }, 'viewer');

      expect(inFeed.matchedInReplies).toBe(false);
      expect(inSearch.matchedInReplies).toBe(true);
    });
  });

  describe('listedInThreads', () => {
    it("can't be talked into listing a deleted quack by its own content", () => {
      // The caller's `deletedAt` is overwritten on both branches, as in
      // notDeleted.
      const where = listedInThreads({ deletedAt: { not: null } });
      expect(where).toEqual(listedWhere({}));
    });
  });

  describe('getReplies', () => {
    it('reads nothing more when no list shows the parent', async () => {
      const { prisma, repository } = fakePrisma();

      await expect(repository.getReplies('q1', 'viewer')).resolves.toBeNull();
      expect(prisma.quack.findMany).not.toHaveBeenCalled();
    });

    it('reads the live replies of that parent, oldest first', async () => {
      const { prisma, repository } = fakePrisma();
      prisma.quack.findFirst.mockResolvedValue({ id: 'q1' });

      await expect(repository.getReplies('q1', 'viewer')).resolves.toEqual([]);
      expect(prisma.quack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { reply: { is: { parentId: 'q1' } }, deletedAt: null },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
      );
    });
  });

  describe('createReply', () => {
    const replyRow = {
      id: 'r1',
      text: 'Same',
      mood: null,
      userId: 'u2',
      createdAt: new Date('2026-01-01T12:00:00Z'),
      updatedAt: new Date('2026-01-01T12:00:00Z'),
      deletedAt: null,
      user: { id: 'u2', name: 'Petr', username: 'petr', displayUsername: null },
      poll: null,
    };

    it('writes the reply and the row naming its parent in one transaction', async () => {
      const { prisma, repository } = fakePrisma();
      prisma.quack.create.mockResolvedValue(replyRow);

      await expect(
        repository.createReply({
          parentId: 'q1',
          userId: 'u2',
          text: 'Same',
          mood: null,
        }),
      ).resolves.toMatchObject({ id: 'r1', text: 'Same', replyCount: 0 });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // no poll is ever created with a reply
      const [{ data }] = prisma.quack.create.mock.calls[0] as [
        { data: object },
      ];
      expect(data).not.toHaveProperty('poll');
      // the satellite's statement is bound to this reply and this parent;
      // what it checks is proved against Postgres in the db-spec
      const [, ...values] = prisma.$executeRaw.mock.calls[0] as unknown[];
      expect(values).toEqual(['r1', 'q1']);
    });

    it('returns null when the statement refused the parent', async () => {
      const { prisma, repository } = fakePrisma();
      prisma.quack.create.mockResolvedValue(replyRow);
      prisma.$executeRaw.mockResolvedValue(0);

      await expect(
        repository.createReply({
          parentId: 'q1',
          userId: 'u2',
          text: 'Same',
          mood: null,
        }),
      ).resolves.toBeNull();
    });
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

    it('records the author as the one who deleted it, at the same instant', async () => {
      const { prisma, repository } = fakePrisma();

      await repository.softDeleteOwnQuack('q1', 'u1');

      const [{ data: quackData }] = prisma.quack.updateMany.mock.calls[0] as [
        { data: { deletedAt: Date } },
      ];
      expect(prisma.quackDeletion.create).toHaveBeenCalledWith({
        data: {
          quackId: 'q1',
          deletedById: 'u1',
          reason: null,
          createdAt: quackData.deletedAt,
        },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('reports when nothing matched and records nothing', async () => {
      const { prisma, repository } = fakePrisma();
      prisma.quack.updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.softDeleteOwnQuack('q1', 'u1')).resolves.toBe(
        false,
      );
      expect(prisma.quackDeletion.create).not.toHaveBeenCalled();
    });
  });

  describe('softDeleteQuackAsModerator', () => {
    // The parameters of the one raw statement the call made, in order. What
    // the SQL itself does is checked against Postgres in
    // quack.repository.db-spec.ts; a mock can only echo its text back.
    const rawUpdateValues = (prisma: FakePrisma): unknown[] => {
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      const [, ...values] = prisma.$executeRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      return values;
    };

    it('deletes with one raw statement for this quack, moderator and roles', async () => {
      const { prisma, repository } = fakePrisma();

      await expect(
        repository.softDeleteQuackAsModerator('q1', 'admin1', 'Quackery'),
      ).resolves.toBe(true);

      const [deletedAt, updatedAt, ...rest] = rawUpdateValues(prisma);
      expect(deletedAt).toBeInstanceOf(Date);
      expect(updatedAt).toBe(deletedAt);
      expect(rest).toEqual(['q1', 'admin1', ['admin']]);
      expect(prisma.quack.updateMany).not.toHaveBeenCalled();
    });

    it('records the moderator and the reason, at the same instant', async () => {
      const { prisma, repository } = fakePrisma();

      await repository.softDeleteQuackAsModerator('q1', 'admin1', 'Quackery');

      const [deletedAt] = rawUpdateValues(prisma);
      expect(prisma.quackDeletion.create).toHaveBeenCalledWith({
        data: {
          quackId: 'q1',
          deletedById: 'admin1',
          reason: 'Quackery',
          createdAt: deletedAt,
        },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('records nothing when the statement matched nothing', async () => {
      // the quack is gone, or the user is no moderator in the database
      const { prisma, repository } = fakePrisma();
      prisma.$executeRaw.mockResolvedValue(0);

      await expect(
        repository.softDeleteQuackAsModerator('q1', 'admin1', 'Quackery'),
      ).resolves.toBe(false);
      expect(prisma.quackDeletion.create).not.toHaveBeenCalled();
    });
  });
});
