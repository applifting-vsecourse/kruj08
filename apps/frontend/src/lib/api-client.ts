import ky, { HTTPError } from "ky"

import { env } from "@/config/env"
import { queryClient } from "@/config/react-query"
import { authKeys } from "@/lib/auth-keys"

// Single shared HTTP client. Per the Applifting frontend playbook:
// - send credentials so better-auth's session cookie travels with every request
// - on 401 invalidate the auth session query so route loaders re-resolve auth
//   and redirect through the login flow
// - turn API errors into readable messages (see beforeError below)
//
// Paths are joined onto `prefix`, and a leading slash is normalised away, so
// both `api.get("quacks")` and `api.get("/quacks")` hit the same endpoint.
export const api = ky.create({
  prefix: env.VITE_API_URL,
  credentials: "include",
  retry: { limit: 0 },
  hooks: {
    // NestJS returns { message: string | string[] } on validation failures and
    // on conflicts. Without this the user would see ky's generic "Request
    // failed with status code 400" and never learn what was actually wrong.
    //
    // ky 2 has already read the body into `error.data` by the time this runs,
    // so the response stream cannot be read again here — `error.data` is the
    // only way at the message. It is a string for non-JSON bodies.
    beforeError: [
      ({ error }) => {
        if (!(error instanceof HTTPError)) return error
        const body = error.data as { message?: string | string[] } | string | undefined
        if (body && typeof body === "object") {
          const message = Array.isArray(body.message) ? body.message.join(", ") : body.message
          if (message) error.message = message
        }
        return error
      },
    ],
    afterResponse: [
      ({ response }) => {
        if (response.status === 401) {
          void queryClient.invalidateQueries({ queryKey: authKeys.session() })
        }
      },
    ],
  },
})

export { HTTPError }
