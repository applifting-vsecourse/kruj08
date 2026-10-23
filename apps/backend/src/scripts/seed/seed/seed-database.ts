import { PrismaService } from '@/core/prisma/prisma.service';
import { User } from '@/generated/prisma/client';
import { QuackMood } from '@/modules/quack/domain/quack';
import { BetterAuth } from '@/shared/auth/providers/better-auth.provider';
import { Config } from '@/shared/config/config.service';
import { createQuack } from './create-quack';
import { createUser } from './create-user';

const MINUTE_IN_MS = 60 * 1000;

export const seedDatabase = async (
  prisma: PrismaService,
  config: Config,
  betterAuth: BetterAuth,
): Promise<void> => {
  const auth = betterAuth;

  // `pnpm dev` runs the seed on every start, so never clobber a database that
  // already has data — that would delete the account and posts you just made.
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log(
      `Database already has ${existingUsers} user(s) — skipping seed. ` +
        'Run `pnpm backend db:reset` to wipe and start over.',
    );
    return;
  }

  // Drop existing database data from all tables
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "poll_vote", "poll_option", "poll", "quack", "session", "account", "verification", "user" RESTART IDENTITY CASCADE;',
    );
  } catch (error) {
    console.error('Error truncating tables:', error);
  }

  console.log('Creating superadmin user');

  // Create a superadmin user. This should be delete in prod app
  await createUser(prisma, auth, {
    email: config.superadminEmail,
    password: config.superadminPassword,
    name: 'Admin (Delete in Prod)',
    username: 'superadmin',
    role: 'admin',
  });

  console.log('Creating example users');

  const caffeinatedDuck = await createUser(prisma, auth, {
    email: 'caffeinatedduck@example.com',
    password: 'password1',
    name: 'Caffeinated Duck',
    username: 'CaffeinatedDuck',
  });

  const deepDuckThoughts = await createUser(prisma, auth, {
    email: 'deepduckthoughts@example.com',
    password: 'password2',
    name: 'Deep Duck Thoughts',
    username: 'DeepDuckThoughts',
  });

  const breadCritic = await createUser(prisma, auth, {
    email: 'breadcritic@example.com',
    password: 'password3',
    name: 'The Bread Critic',
    username: 'BreadCritic',
  });

  const migrationSeason = await createUser(prisma, auth, {
    email: 'migrationseason@example.com',
    password: 'password4',
    name: 'Migration Season',
    username: 'MigrationSeason',
  });

  const pondAdmin = await createUser(prisma, auth, {
    email: 'pondadmin@example.com',
    password: 'password5',
    name: 'Pond Admin',
    username: 'PondAdmin',
  });

  console.log('Creating example quacks');

  // Listed oldest first. The feed sorts newest first, so the last entry here is
  // the one at the top of the screen.
  // Some quacks carry a mood and some do not, so the feed shows both cases.
  // One visible quack carries a poll, with votes cast below, so the feed shows
  // result bars without anyone having to vote first.
  const exampleQuacks: {
    author: User;
    minutesAgo: number;
    text: string;
    mood?: QuackMood;
    pollOptions?: string[];
    // Usernames of seeded users voting, in option order (index = option).
    votes?: User[][];
    // Set for a quack its author has since deleted. It stays in the database
    // with its poll and votes, and must show up nowhere in the app.
    deletedMinutesAgo?: number;
  }[] = [
    {
      author: pondAdmin,
      minutesAgo: 2870,
      text: `Reminder: the north end of the pond is closed for reed maintenance until Thursday.
Yes, again. No, we don't know why the contractor is a heron.`,
    },
    {
      author: migrationSeason,
      minutesAgo: 2610,
      text: `Left at dawn. 400 km down, 2,600 to go.
The V formation works beautifully right up until whoever is at the front decides to take a shortcut.`,
    },
    {
      author: breadCritic,
      minutesAgo: 2255,
      text: `Sourdough. Thrown by a child. Landed two metres short of anyone.
Crust: excellent. Delivery: amateur. 6/10.`,
    },
    {
      author: caffeinatedDuck,
      minutesAgo: 1980,
      mood: 'silly',
      text: `just spilled coffee on my keyboard
now every time i type "duck" it autocorrects to "quack"
send help or more caffeine`,
    },
    {
      // Deleted by its author. Search for "rye" to check it stays hidden.
      author: breadCritic,
      minutesAgo: 1720,
      deletedMinutesAgo: 1700,
      text: `Hot take: rye is the best bread for ducks. Fight me.`,
      pollOptions: ['Agreed', 'Absolutely not'],
      votes: [[caffeinatedDuck], [deepDuckThoughts, migrationSeason]],
    },
    {
      author: deepDuckThoughts,
      minutesAgo: 1495,
      text: `If a pond reflects the sky, is the sky just a very large and very shy pond?`,
    },
    {
      author: migrationSeason,
      minutesAgo: 1240,
      mood: 'angry',
      text: `Update on the shortcut: it added 90 km and one entire mountain.
We are not currently speaking to the front of the V.`,
    },
    {
      author: pondAdmin,
      minutesAgo: 890,
      text: `Whoever keeps rearranging the stones on the west bank — we see you.
We have footage. It is extremely blurry footage. But we have it.`,
    },
    {
      author: caffeinatedDuck,
      minutesAgo: 640,
      mood: 'silly',
      text: `third espresso and i can hear colours now
one of them is quacking`,
    },
    {
      author: breadCritic,
      minutesAgo: 415,
      mood: 'happy',
      text: `Multigrain. Seeds still attached. Genuinely nutritious.
The pond is not ready for this level of quality and, frankly, neither am I. 9/10.`,
    },
    {
      author: deepDuckThoughts,
      minutesAgo: 260,
      mood: 'sad',
      text: `Everyone says "water off a duck's back" like it's a compliment.
Some of us would quite like to feel things.`,
    },
    {
      author: caffeinatedDuck,
      minutesAgo: 150,
      mood: 'happy',
      text: `Lunch plans? I can't decide and I've had too much coffee to think.`,
      pollOptions: ['Pond buffet', 'Bread stand', 'Skip lunch, more espresso'],
      // Two for the buffet, one for the bread stand, nobody for more espresso.
      // The author and the superadmin stay out, so a tester signing in as
      // either one sees the "not voted yet" state.
      votes: [[deepDuckThoughts, breadCritic], [migrationSeason], []],
    },
    {
      author: caffeinatedDuck,
      minutesAgo: 95,
      text: `me: throws one crumb into the pond
ducks: assemble like the Avengers
i fear i may have started something`,
    },
    {
      author: pondAdmin,
      minutesAgo: 20,
      mood: 'angry',
      text: `The bread situation has been resolved. The swan has been spoken to.
Please stop tagging me.`,
    },
  ];

  const now = Date.now();

  for (const {
    author,
    minutesAgo,
    text,
    mood,
    pollOptions,
    votes,
    deletedMinutesAgo,
  } of exampleQuacks) {
    const quack = await createQuack(prisma, {
      text,
      mood,
      pollOptions,
      userId: author.id,
      createdAt: new Date(now - minutesAgo * MINUTE_IN_MS),
      deletion:
        deletedMinutesAgo === undefined
          ? undefined
          : {
              at: new Date(now - deletedMinutesAgo * MINUTE_IN_MS),
              byUserId: author.id,
            },
    });

    if (quack.poll && votes) {
      for (const [index, voters] of votes.entries()) {
        const option = quack.poll.options[index];
        for (const voter of voters) {
          await prisma.pollVote.create({
            data: {
              pollId: quack.poll.id,
              optionId: option.id,
              userId: voter.id,
            },
          });
        }
      }
    }
  }
};
