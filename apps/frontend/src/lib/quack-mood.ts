import { z } from "zod"

// Moods are shared by two features: a quack carries one, and a profile stores
// the default for new quacks. Features may not import from each other, so the
// definition lives here — the same reason auth-keys.ts is in lib/.
//
// Mirrors the backend's QuackMood enum. Order matters: pickers show the
// options in this order.
export const QUACK_MOODS = ["happy", "sad", "angry", "silly"] as const
export const quackMoodSchema = z.enum(QUACK_MOODS)
export type QuackMood = z.infer<typeof quackMoodSchema>

// One place that says how each mood looks, used wherever a mood is picked or
// shown, so the pickers and the feed can never disagree.
export const QUACK_MOOD_OPTIONS: { value: QuackMood; label: string; emoji: string }[] = [
  { value: "happy", label: "Happy", emoji: "😄" },
  { value: "sad", label: "Sad", emoji: "😢" },
  { value: "angry", label: "Angry", emoji: "😠" },
  { value: "silly", label: "Silly", emoji: "🤪" },
]
