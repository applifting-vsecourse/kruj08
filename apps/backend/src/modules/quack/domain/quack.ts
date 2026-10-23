export const QUACK_MOODS = ['happy', 'sad', 'angry', 'silly'] as const;
export type QuackMood = (typeof QUACK_MOODS)[number];

// Whose quacks a list shows. Only "me" for now; the filter is named for what
// it narrows, so a profile page can later pass a username without changing
// the contract.
export const QUACK_AUTHOR_FILTERS = ['me'] as const;
export type QuackAuthorFilter = (typeof QUACK_AUTHOR_FILTERS)[number];

// Limits for a poll attached to a quack. Mirrored in the frontend form schema
// so the user is told before the request is made; the server still validates.
export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 4;
export const POLL_OPTION_MAX_LENGTH = 50;

// The longest reason for deleting a quack, in characters as Postgres counts
// them (code points), since it is stored in a VARCHAR(500). Mirrored in the
// frontend dialog.
export const DELETION_REASON_MAX_LENGTH = 500;

// The roles that moderate the feed: they may delete any quack, and have to
// say why every time, their own quacks included. Everyone else deletes only
// their own. The repository checks the role against the database inside the
// delete itself; the session's copy only decides what the client is offered
// and which path the service takes.
export const MODERATOR_ROLES: readonly string[] = ['admin'];

export const canModerateQuacks = (role: string): boolean =>
  MODERATOR_ROLES.includes(role);

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

// Someone who is not an admin tried to delete a quack that isn't theirs.
export class QuackNotOwnedError extends Error {
  constructor(quackId: string) {
    super(`Quack ${quackId} belongs to someone else`);
    this.name = 'QuackNotOwnedError';
  }
}

// Someone deleted a quack as a moderator whom the database does not count as
// one (any more): the role in their session was out of date.
export class NotAModeratorError extends Error {
  constructor(userId: string) {
    super(`User ${userId} may not delete other people's quacks`);
    this.name = 'NotAModeratorError';
  }
}

// An admin tried to delete a quack without saying why.
export class DeletionReasonRequiredError extends Error {
  constructor(quackId: string) {
    super(`Deleting quack ${quackId} as an admin needs a reason`);
    this.name = 'DeletionReasonRequiredError';
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
