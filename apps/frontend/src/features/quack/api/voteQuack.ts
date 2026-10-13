import { api } from "@/lib/api-client"

import { quackSchema, type Quack } from "@/features/quack/api/quackSchemas"

export type VoteQuackInput = {
  quackId: string
  optionId: string
}

// Casts the signed-in user's vote, or moves it when they already voted. The
// server answers with the whole quack so the feed can swap the item in place
// without doing any arithmetic on the client.
export async function voteQuack({ quackId, optionId }: VoteQuackInput): Promise<Quack> {
  const json = await api.put(`quacks/${quackId}/vote`, { json: { optionId } }).json()
  return quackSchema.parse(json)
}
