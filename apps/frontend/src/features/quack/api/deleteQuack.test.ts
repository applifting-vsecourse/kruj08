import { afterEach, describe, expect, it, vi } from "vitest"

import { HTTPError } from "@/lib/api-client"

import { deleteQuack } from "@/features/quack/api/deleteQuack"

// ky picks up the global fetch per request, so stubbing it stands in for the server.
const serverReplies = (status: number) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(null, { status }))),
  )

describe("deleteQuack", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("resolves when the server deleted the quack", async () => {
    serverReplies(204)

    await expect(deleteQuack("q1")).resolves.toBeUndefined()
  })

  it("treats a quack that is gone already as deleted", async () => {
    // e.g. deleted in another tab, or the second request of a double click
    serverReplies(404)

    await expect(deleteQuack("q1")).resolves.toBeUndefined()
  })

  it.each([403, 500])("fails on any other error (%i)", async (status) => {
    serverReplies(status)

    await expect(deleteQuack("q1")).rejects.toBeInstanceOf(HTTPError)
  })
})
