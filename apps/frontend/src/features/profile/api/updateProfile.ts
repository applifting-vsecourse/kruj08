import { api, HTTPError } from "@/lib/api-client"
import type { QuackMood } from "@/lib/quack-mood"

import { profileSchema, type Profile } from "@/features/profile/api/profileSchemas"

export type UpdateProfileInput = {
  name: string
  username: string
  // null clears the value; the server also treats "" as null.
  bio: string | null
  defaultMood: QuackMood | null
}

// The one failure the form handles differently from the rest: it belongs
// under the username field, not in a banner. Typed so the component does not
// have to know about HTTP status codes.
export class UsernameTakenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UsernameTakenError"
  }
}

export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  try {
    const json = await api.patch("profile", { json: input }).json()
    return profileSchema.parse(json)
  } catch (error) {
    // api-client has already replaced ky's generic message with the server's.
    if (error instanceof HTTPError && error.response.status === 409) {
      throw new UsernameTakenError(error.message)
    }
    throw error
  }
}
