import { z } from "zod"

import { quackMoodSchema } from "@/lib/quack-mood"

// Validation limits mirror the backend DTO so the user is told before the
// request is made — the server still validates independently.
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 30
export const USERNAME_PATTERN = /^[A-Za-z0-9._]+$/
export const NAME_MAX_LENGTH = 50
export const BIO_MAX_LENGTH = 160

export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  bio: z.string().nullable(),
  // null means no default: the new-quack form starts without a mood.
  defaultMood: quackMoodSchema.nullable(),
})

export type Profile = z.infer<typeof profileSchema>
