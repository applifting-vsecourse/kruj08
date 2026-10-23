import { api, isNotFoundError } from "@/lib/api-client"

// Deletes one of the signed-in user's own quacks. The server answers 204 with
// no body. A 404 means the quack is gone already (deleted in another tab, or a
// double click), which is the outcome the user asked for, so it counts as
// success rather than an error.
export async function deleteQuack(quackId: string): Promise<void> {
  try {
    await api.delete(`quacks/${quackId}`)
  } catch (error) {
    if (isNotFoundError(error)) return
    throw error
  }
}
