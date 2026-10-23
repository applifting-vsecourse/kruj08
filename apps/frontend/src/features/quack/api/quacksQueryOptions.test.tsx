import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi, type Mock } from "vitest"

import type { QuackListFilter } from "@/features/quack/api/quackKeys"
import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"

const quackJson = {
  id: "q1",
  text: "quack quack",
  mood: null,
  userId: "u2",
  createdAt: "2026-01-01T12:00:00Z",
  user: { id: "u2", name: "Deep Duck", username: "DeepDuckThoughts" },
  poll: null,
  canDelete: false,
}

// The first request answers with someone else's quack; every later one hangs,
// so while it is pending only placeholder data could fill the list.
const serverAnswersOnce = () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify([quackJson]), {
        headers: { "content-type": "application/json" },
      }),
    )
    .mockReturnValue(
      new Promise<Response>(() => {
        // never settles
      }),
    )
  vi.stubGlobal("fetch", fetch)
  return fetch
}

// ky hands fetch a Request, not a URL string.
const requestedUrl = (fetch: Mock) => new URL((fetch.mock.lastCall as [Request])[0].url)

const renderList = (filter: QuackListFilter) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(
    ({ filter }: { filter: QuackListFilter }) => useQuery(quacksQueryOptions(filter)),
    { initialProps: { filter }, wrapper },
  )
}

describe("quacksQueryOptions", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("asks for the full feed without a query string", async () => {
    const fetch = serverAnswersOnce()
    const { result } = renderList({})

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(requestedUrl(fetch).search).toBe("")
  })

  it("asks for the viewer's own quacks together with the search", async () => {
    const fetch = serverAnswersOnce()
    const { result } = renderList({ search: "duck", author: "me" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const url = requestedUrl(fetch)
    expect(url.searchParams.get("author")).toBe("me")
    expect(url.searchParams.get("search")).toBe("duck")
  })

  it("keeps the previous results on screen while a new search loads", async () => {
    serverAnswersOnce()
    const { result, rerender } = renderList({})
    await waitFor(() => expect(result.current.data).toHaveLength(1))

    rerender({ filter: { search: "duck" } })

    expect(result.current.isPlaceholderData).toBe(true)
    expect(result.current.data).toHaveLength(1)
  })

  it("never shows everyone's quacks under Mine while it loads", async () => {
    serverAnswersOnce()
    const { result, rerender } = renderList({})
    await waitFor(() => expect(result.current.data).toHaveLength(1))

    rerender({ filter: { author: "me" } })

    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(true)
  })
})
