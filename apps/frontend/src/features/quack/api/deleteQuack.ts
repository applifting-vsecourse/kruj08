import { api, isNotFoundError } from "@/lib/api-client"

export type DeleteQuackInput = {
  quackId: string
  // Required by the server from an admin; an author deleting their own quack
  // sends none.
  reason?: string
}

// Deletes one of the signed-in user's own quacks, or any quack for an admin.
// The server answers 204 with no body. A 404 means the quack is gone already
// (deleted in another tab, by someone else in the meantime, or a double
// click), which is the outcome the user asked for, so it counts as success
// rather than an error.
export async function deleteQuack({ quackId, reason }: DeleteQuackInput): Promise<void> {
  try {
    // Without a reason the request carries no body at all, as it always has.
    await api.delete(`quacks/${quackId}`, reason === undefined ? undefined : { json: { reason } })
  } catch (error) {
    if (isNotFoundError(error)) return
    throw error
  }
}
