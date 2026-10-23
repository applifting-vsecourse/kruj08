import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { voteQuack } from "@/features/quack/api/voteQuack"
import { useVoteQuack } from "@/features/quack/hooks/useVoteQuack"

vi.mock("@/features/quack/api/voteQuack")

// A real HTTPError, made by the real client, so the hook's status check is
// exercised against what ky actually throws.
const httpError = (status: number) =>
  api
    .extend({ fetch: () => Promise.resolve(new Response(null, { status })) })
    .put("quacks/q1/vote")
    .catch((error: unknown) => error)

const renderVote = () => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useVoteQuack(), { wrapper })
  return { result, invalidateQueries }
}

describe("useVoteQuack", () => {
  beforeEach(() => {
    vi.mocked(voteQuack).mockReset()
  })

  it("refreshes the feed when the quack has been deleted meanwhile", async () => {
    vi.mocked(voteQuack).mockRejectedValue(await httpError(404))
    const { result, invalidateQueries } = renderVote()

    result.current.mutate({ quackId: "q1", optionId: "o1" })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: quackKeys.lists() })
  })

  it("leaves the feed alone on other failures", async () => {
    // the feed would fail to load just the same; the poll's own message covers it
    vi.mocked(voteQuack).mockRejectedValue(await httpError(500))
    const { result, invalidateQueries } = renderVote()

    result.current.mutate({ quackId: "q1", optionId: "o1" })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
