import { expect, request, type APIRequestContext } from "@playwright/test"

import { API_URL, FRONTEND_URL } from "./env"

// An API client signed in as one user, for the steps a test only sets up or
// checks and doesn't need a screen for. It sends the Origin a browser on the
// app would; BetterAuth accepts sign-ins from its own frontend only. Dispose
// of it when the test is done.
export async function apiAs(email: string, password: string): Promise<APIRequestContext> {
  const api = await request.newContext({
    baseURL: `${API_URL}/`,
    extraHTTPHeaders: { Origin: FRONTEND_URL },
  })
  const signedIn = await api.post("auth/sign-in/email", { data: { email, password } })
  expect(signedIn.ok(), `sign-in as ${email}`).toBe(true)
  return api
}
