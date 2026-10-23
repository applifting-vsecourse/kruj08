import { afterEach, describe, expect, it, vi } from "vitest"

import { HTTPError } from "@/lib/api-client"

import { deleteQuack } from "@/features/quack/api/deleteQuack"

type Received = { method: string; url: string; contentType: string | null; body: string }

// What reached the "server". The body is read inside the stub, while the
// request still has it; ky is done with the request once fetch resolves.
let received: Received[] = []

// ky picks up the global fetch per request, so stubbing it stands in for the server.
const serverReplies = (status: number) => {
  received = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      received.push({
        method: request.method,
        url: request.url,
        contentType: request.headers.get("content-type"),
        body: await request.text(),
      })
      return new Response(null, { status })
    }),
  )
}

describe("deleteQuack", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("resolves when the server deleted the quack", async () => {
    serverReplies(204)

    await expect(deleteQuack({ quackId: "q1" })).resolves.toBeUndefined()
  })

  it("treats a quack that is gone already as deleted", async () => {
    // e.g. deleted in another tab, or the second request of a double click
    serverReplies(404)

    await expect(deleteQuack({ quackId: "q1" })).resolves.toBeUndefined()
  })

  it("sends no body without a reason", async () => {
    serverReplies(204)

    await deleteQuack({ quackId: "q1" })

    expect(received).toEqual([
      expect.objectContaining({
        method: "DELETE",
        url: expect.stringMatching(/\/quacks\/q1$/) as unknown,
        body: "",
      }),
    ])
  })

  it("sends an admin's reason as JSON", async () => {
    serverReplies(204)

    await deleteQuack({ quackId: "q1", reason: "Quackery" })

    const [request] = received
    expect(received).toHaveLength(1)
    expect(request?.contentType).toBe("application/json")
    expect(JSON.parse(request?.body ?? "")).toEqual({ reason: "Quackery" })
  })

  it.each([403, 500])("fails on any other error (%i)", async (status) => {
    serverReplies(status)

    await expect(deleteQuack({ quackId: "q1" })).rejects.toBeInstanceOf(HTTPError)
  })
})
