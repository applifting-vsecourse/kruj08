import { api } from "@/lib/api-client"

import { quackSchema, type Quack, type QuackMood } from "@/features/quack/api/quackSchemas"

export type AddQuackInput = {
  text: string
  // Left out of the request body when undefined, so the server stores null.
  mood?: QuackMood
}

export async function addQuack(input: AddQuackInput): Promise<Quack> {
  const json = await api.post("quacks", { json: input }).json()
  return quackSchema.parse(json)
}
