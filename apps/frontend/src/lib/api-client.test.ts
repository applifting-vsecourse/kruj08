import { describe, expect, it } from "vitest"

import { api, HTTPError } from "@/lib/api-client"

// ky accepts its own `fetch`, so the hooks can be exercised without a server.
const apiReplying = (status: number, body: BodyInit | null, contentType?: string) =>
  api.extend({
    fetch: () =>
      Promise.resolve(
        new Response(body, {
          status,
          headers: contentType ? { "content-type": contentType } : undefined,
        }),
      ),
  })

describe("api client error messages", () => {
  it("uses the server's message for a single-message error", async () => {
    const client = apiReplying(
      409,
      JSON.stringify({ message: "That username is already taken.", statusCode: 409 }),
      "application/json",
    )

    const error = await client.patch("profile").catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(HTTPError)
    expect((error as HTTPError).message).toBe("That username is already taken.")
  })

  it("joins the messages of a validation error", async () => {
    const client = apiReplying(
      400,
      JSON.stringify({ message: ["text should not be empty", "mood must be one of"] }),
      "application/json",
    )

    const error = await client.post("quacks").catch((caught: unknown) => caught)

    expect((error as HTTPError).message).toBe("text should not be empty, mood must be one of")
  })

  it("keeps ky's own message when the body is not JSON", async () => {
    const client = apiReplying(502, "Bad gateway", "text/plain")

    const error = await client.get("quacks").catch((caught: unknown) => caught)

    expect((error as HTTPError).message).toMatch(/status code 502/)
  })
})
