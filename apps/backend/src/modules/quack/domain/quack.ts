export const QUACK_MOODS = ['happy', 'sad', 'angry', 'silly'] as const;
export type QuackMood = (typeof QUACK_MOODS)[number];

// Limits for a poll attached to a quack. Mirrored in the frontend form schema
// so the user is told before the request is made; the server still validates.
export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 4;
export const POLL_OPTION_MAX_LENGTH = 50;

export type QuackAuthor = {
  id: string;
  name: string;
  username: string;
};

export type PollOption = {
  id: string;
  text: string;
  position: number;
  // Counted on the server from stored votes — the client never adds these up.
  votes: number;
};

export type Poll = {
  // Kept in the domain for the repository (votes key on it) but not exposed
  // over HTTP: the client addresses polls by their quack.
  id: string;
  options: PollOption[];
  totalVotes: number;
  // The option the viewer voted for, or null when they have not voted yet.
  myOptionId: string | null;
};

export type Quack = {
  id: string;
  text: string;
  // Optional by design: a quack without a mood is a plain post, not an error.
  mood: QuackMood | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user?: QuackAuthor;
  // null is a plain post without a poll — the common case.
  poll: Poll | null;
};

// Domain errors. The controller translates them to HTTP status codes so the
// service stays free of them.
export class InvalidPollError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPollError';
  }
}

export class QuackNotFoundError extends Error {
  constructor(quackId: string) {
    super(`Quack ${quackId} not found`);
    this.name = 'QuackNotFoundError';
  }
}

export class QuackHasNoPollError extends Error {
  constructor(quackId: string) {
    super(`Quack ${quackId} has no poll`);
    this.name = 'QuackHasNoPollError';
  }
}

export class PollOptionNotFoundError extends Error {
  constructor(optionId: string) {
    super(`Poll option ${optionId} not found in this poll`);
    this.name = 'PollOptionNotFoundError';
  }
}
