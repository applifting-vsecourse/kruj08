import { api } from "@/lib/api-client"

import { quackSchema, type Quack } from "@/features/quack/api/quackSchemas"

export type LikeQuackInput = {
  quackId: string
  // true likes the quack, false takes the like back.
  isLiked: boolean
}

// PUT likes, DELETE takes the like back; both are idempotent on the server,
// so a repeated request never undoes itself (docs/adr/002-likes.md). The
// server answers with the whole quack and the count everyone sees.
export async function likeQuack({ quackId, isLiked }: LikeQuackInput): Promise<Quack> {
  const path = `quacks/${quackId}/like`
  const json = await (isLiked ? api.put(path) : api.delete(path)).json()
  return quackSchema.parse(json)
}
