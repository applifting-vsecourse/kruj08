import { z } from "zod"

import { quackMoodSchema } from "@/lib/quack-mood"

// Per the Applifting frontend playbook: validate every server payload with zod
// and infer types from the schema rather than auto-generating them.
export const quackUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
})

export const pollOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  // Counted by the server. The client only ever displays it.
  votes: z.number().int().nonnegative(),
})

export const pollSchema = z.object({
  // In author order.
  options: z.array(pollOptionSchema),
  totalVotes: z.number().int().nonnegative(),
  // The option the signed-in user voted for; null until they vote.
  myOptionId: z.string().nullable(),
  // Decided by the server: true once the viewer has voted, and always for the
  // quack's author.
  canSeeResults: z.boolean(),
})

export const quackSchema = z.object({
  id: z.string(),
  text: z.string(),
  // null is a plain post without a mood — the common case.
  mood: quackMoodSchema.nullable(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
  // null is a plain post without a poll — also the common case.
  poll: pollSchema.nullable(),
  // Decided by the server: true only for the quack's author; admins get no
  // exception. The client shows the delete action on it and never works it out.
  canDelete: z.boolean(),
})

export const quacksSchema = z.array(quackSchema)

// Whose quacks a list shows, as the server's `author` parameter spells it:
// "me" is the signed-in user, resolved from the session on the server.
export const quackAuthorFilterSchema = z.enum(["me"])

export type QuackAuthorFilter = z.infer<typeof quackAuthorFilterSchema>

export type Quack = z.infer<typeof quackSchema>
export type Poll = z.infer<typeof pollSchema>
export type PollOption = z.infer<typeof pollOptionSchema>
