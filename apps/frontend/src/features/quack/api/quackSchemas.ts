import { z } from "zod"

// Per the Applifting frontend playbook: validate every server payload with zod
// and infer types from the schema rather than auto-generating them.
export const quackUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
})

// Mirrors the backend's QuackMood enum. Order matters: the form shows the
// options in this order.
export const QUACK_MOODS = ["happy", "sad", "angry", "silly"] as const
export const quackMoodSchema = z.enum(QUACK_MOODS)

export const quackSchema = z.object({
  id: z.string(),
  text: z.string(),
  // null is a plain post without a mood — the common case.
  mood: quackMoodSchema.nullable(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
})

export const quacksSchema = z.array(quackSchema)

export type Quack = z.infer<typeof quackSchema>
export type QuackMood = z.infer<typeof quackMoodSchema>
