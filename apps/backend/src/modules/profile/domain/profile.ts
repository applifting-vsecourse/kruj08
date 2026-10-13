import { QuackMood } from '@/modules/quack/domain/quack';

// What the user can edit about themselves on the Settings page. Everything
// else on the user row (email, role, timestamps) belongs to BetterAuth.
export type Profile = {
  id: string;
  name: string;
  // The handle as the user typed it — the value shown with an "@" everywhere.
  username: string;
  bio: string | null;
  // Preselected on the new-quack form. null means "no mood", like on a quack.
  defaultMood: QuackMood | null;
};

// A partial update: a key that is missing is left untouched, a key set to
// null clears the value (bio, defaultMood).
export type ProfileChanges = Partial<{
  name: string;
  username: string;
  bio: string | null;
  defaultMood: QuackMood | null;
}>;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
// Letters, digits, dots and underscores — the same shape BetterAuth accepts at
// sign-up, so a name that was fine to register with is fine to change to.
export const USERNAME_PATTERN = /^[A-Za-z0-9._]+$/;

export const NAME_MAX_LENGTH = 50;
export const BIO_MAX_LENGTH = 160;

// Domain error, not an HTTP one: the controller decides that it is a 409.
export class UsernameTakenError extends Error {
  constructor(public readonly username: string) {
    super('That username is already taken.');
    this.name = 'UsernameTakenError';
  }
}
