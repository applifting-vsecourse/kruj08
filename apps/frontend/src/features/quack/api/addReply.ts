import { api } from "@/lib/api-client"
import type { QuackMood } from "@/lib/quack-mood"

import { quackSchema, type Quack } from "@/features/quack/api/quackSchemas"

export type AddReplyInput = {
  // The quack replied to.
  quackId: string
  text: string
  // Left out of the request body when undefined, so the server stores null.
  mood?: QuackMood
}

// A 404 means the quack is no longer there to answer — deleted in the
// meantime. Unlike a deletion, that is not the outcome the user asked for, so
// it stays an error and the form keeps the text (see isNotFoundError).
export async function addReply({ quackId, ...body }: AddReplyInput): Promise<Quack> {
  const json = await api.post(`quacks/${quackId}/replies`, { json: body }).json()
  return quackSchema.parse(json)
}
