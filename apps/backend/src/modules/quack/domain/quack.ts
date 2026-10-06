export const QUACK_MOODS = ['happy', 'sad', 'angry', 'silly'] as const;
export type QuackMood = (typeof QUACK_MOODS)[number];

export type QuackAuthor = {
  id: string;
  name: string;
  username: string;
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
};
