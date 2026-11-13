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

// What a live quack and a deleted one kept as a placeholder have in common.
const listedQuackFields = {
  id: z.string(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
  // Live replies under the quack. Always 0 for a reply: threads are one level
  // deep.
  replyCount: z.number().int().nonnegative(),
  // Decided by the server: true when a search or "Mine" lists the quack
  // because of one of its replies, so the thread opens by itself.
  matchedInReplies: z.boolean(),
}

export const quackSchema = z.object({
  ...listedQuackFields,
  deleted: z.literal(false),
  text: z.string(),
  // null is a plain post without a mood — the common case.
  mood: quackMoodSchema.nullable(),
  // null is a plain post without a poll — also the common case, and always
  // the case for a reply.
  poll: pollSchema.nullable(),
  // Decided by the server: true for the quack's author, and for an admin on
  // every quack. The client shows the delete action on it and never works it
  // out.
  canDelete: z.boolean(),
  // Also the server's call: true for an admin, who has to say why they delete
  // a quack — any quack, their own included.
  deletionReasonRequired: z.boolean(),
})

// A deleted quack that stays in the list because live replies remain under
// it. The server sends its text, mood and poll as null; this schema does not
// even keep the keys, so no component can show them.
export const deletedQuackSchema = z.object({
  ...listedQuackFields,
  deleted: z.literal(true),
})

export const listedQuackSchema = z.discriminatedUnion("deleted", [quackSchema, deletedQuackSchema])

export const quacksSchema = z.array(listedQuackSchema)

// A thread: live replies only, oldest first. A reply is a quack.
export const repliesSchema = z.array(quackSchema)

// Whose quacks a list shows, as the server's `author` parameter spells it:
// "me" is the signed-in user, resolved from the session on the server.
export const quackAuthorFilterSchema = z.enum(["me"])

export type QuackAuthorFilter = z.infer<typeof quackAuthorFilterSchema>

export type Quack = z.infer<typeof quackSchema>
export type DeletedQuack = z.infer<typeof deletedQuackSchema>
export type ListedQuack = z.infer<typeof listedQuackSchema>
export type Poll = z.infer<typeof pollSchema>
export type PollOption = z.infer<typeof pollOptionSchema>
