import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { DeletedQuack, ListedQuack, Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

const author = { id: "jana", name: "Jana Nováková", username: "jana" }

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: "q1",
  text: "Duckweed tea, anyone?",
  mood: null,
  userId: "jana",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: author,
  poll: null,
  canDelete: false,
  deletionReasonRequired: false,
  deleted: false,
  replyCount: 0,
  matchedInReplies: false,
  ...overrides,
})

const aPlaceholder = (overrides: Partial<DeletedQuack> = {}): DeletedQuack => ({
  id: "q1",
  userId: "jana",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: author,
  deleted: true,
  replyCount: 1,
  matchedInReplies: false,
  ...overrides,
})

// A reply as the server sends it.
const replyJson = (id: string, text: string) => ({
  id,
  text,
  mood: null,
  userId: "petr",
  createdAt: "2026-01-01T13:00:00Z",
  user: { id: "petr", name: "Petr", username: "petr" },
  poll: null,
  canDelete: false,
  deletionReasonRequired: false,
  deleted: false,
  replyCount: 0,
  matchedInReplies: false,
})

// A fake API behind the real client: GET answers with `replies`, POST with
// `postStatus`. Every request is recorded.
let replies: object[]
let postStatus: number
let requests: { method: string; path: string; body: unknown }[]

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

beforeEach(() => {
  replies = []
  postStatus = 201
  requests = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const { pathname } = new URL(request.url)
      const body: unknown = request.method === "POST" ? await request.json() : undefined
      requests.push({ method: request.method, path: pathname, body })
      if (request.method === "GET" && pathname.endsWith("/replies")) return json(200, replies)
      if (request.method === "POST") {
        return postStatus === 201
          ? json(201, replyJson("r9", (body as { text: string }).text))
          : json(postStatus, { message: "Quack q1 not found" })
      }
      // The list refetch after a post; the list on screen is a prop here.
      return json(200, [])
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

const renderList = (
  quacks: ListedQuack[],
  onReplyDirtyChange?: (quackId: string, isDirty: boolean) => void,
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const list = (shown: ListedQuack[]) => (
    <QueryClientProvider client={queryClient}>
      <QuackList
        quacks={shown}
        onReplyDirtyChange={onReplyDirtyChange}
      />
    </QueryClientProvider>
  )
  const { rerender } = render(list(quacks))
  return { showQuacks: (shown: ListedQuack[]) => rerender(list(shown)) }
}

const repliesRequested = () =>
  requests.filter(({ method, path }) => method === "GET" && path.endsWith("/replies"))

describe("QuackThread", () => {
  it("shows the count and loads the replies only once opened, oldest first", async () => {
    const user = userEvent.setup()
    replies = [replyJson("r1", "Source?"), replyJson("r2", "Never mind")]
    renderList([aQuack({ replyCount: 2 })])

    expect(repliesRequested()).toHaveLength(0)
    await user.click(screen.getByRole("button", { name: "2 replies" }))

    const texts = await screen.findAllByText(/Source\?|Never mind/)
    expect(texts.map((element) => element.textContent)).toEqual(["Source?", "Never mind"])
    expect(screen.getByRole("button", { name: "Hide replies" })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
  })

  it("offers only Reply on a quack nobody answered, with an empty thread behind it", async () => {
    const user = userEvent.setup()
    renderList([aQuack()])

    expect(screen.queryByRole("button", { name: /replies/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Reply" }))

    expect(await screen.findByText("No replies yet. Be the first.")).toBeInTheDocument()
    expect(screen.getByLabelText("Your reply")).toHaveFocus()
    // a reply has no poll to add
    expect(screen.queryByRole("button", { name: "Add poll" })).not.toBeInTheDocument()
  })

  it("posts a reply and keeps the thread open for the next one", async () => {
    const user = userEvent.setup()
    renderList([aQuack()])

    await user.click(screen.getByRole("button", { name: "Reply" }))
    await user.type(screen.getByLabelText("Your reply"), "  Only if it's cold  ")
    await user.click(screen.getByRole("radio", { name: /Silly/ }))
    await user.click(screen.getByRole("button", { name: "Reply" }))

    await waitFor(() => expect(screen.getByLabelText("Your reply")).toHaveValue(""))
    expect(requests).toContainEqual({
      method: "POST",
      path: "/api/quacks/q1/replies",
      // trimmed, and without the quack id, which travels in the path
      body: { text: "Only if it's cold", mood: "silly" },
    })
    expect(screen.getByRole("button", { name: "Hide replies" })).toBeInTheDocument()
  })

  it("won't send an empty reply", async () => {
    const user = userEvent.setup()
    renderList([aQuack()])

    await user.click(screen.getByRole("button", { name: "Reply" }))
    await user.type(screen.getByLabelText("Your reply"), "   ")
    await user.click(screen.getByRole("button", { name: "Reply" }))

    expect(await screen.findByText("Write something first")).toBeInTheDocument()
    expect(requests.filter(({ method }) => method === "POST")).toHaveLength(0)
  })

  it("keeps the text when the quack was deleted in the meantime, until discarded", async () => {
    const user = userEvent.setup()
    postStatus = 404
    renderList([aQuack()])

    await user.click(screen.getByRole("button", { name: "Reply" }))
    await user.type(screen.getByLabelText("Your reply"), "Too late?")
    await user.click(screen.getByRole("button", { name: "Reply" }))

    expect(await screen.findByText(/deleted in the meantime/)).toBeInTheDocument()
    expect(screen.getByLabelText("Your reply")).toHaveValue("Too late?")
    // it can't be sent again, only let go
    await user.click(screen.getByRole("button", { name: "Discard reply" }))
    expect(screen.getByLabelText("Your reply")).toHaveValue("")
  })

  it("shows a deleted quack's replies under a placeholder that takes no new ones", async () => {
    const user = userEvent.setup()
    replies = [replyJson("r1", "Reported.")]
    renderList([aPlaceholder()])

    const placeholder = screen.getByRole("article")
    expect(within(placeholder).getByText("Deleted quack by @jana")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /actions/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "1 reply" }))

    expect(await screen.findByText("Reported.")).toBeInTheDocument()
    expect(screen.queryByLabelText("Your reply")).not.toBeInTheDocument()
  })

  it("keeps a draft written before the quack turned into a placeholder", async () => {
    const user = userEvent.setup()
    replies = [replyJson("r1", "Reported.")]
    const { showQuacks } = renderList([aQuack({ replyCount: 1 })])

    await user.click(screen.getByRole("button", { name: "1 reply" }))
    await user.type(screen.getByLabelText("Your reply"), "Half a thought")
    // a refetch brings the quack back deleted
    showQuacks([aPlaceholder()])

    expect(await screen.findByText(/deleted in the meantime/)).toBeInTheDocument()
    expect(screen.getByLabelText("Your reply")).toHaveValue("Half a thought")
  })

  it("opens by itself when a search or Mine lists the quack for a reply", async () => {
    replies = [replyJson("r1", "By the mill")]
    renderList([aQuack({ replyCount: 1, matchedInReplies: true })])

    expect(await screen.findByText("By the mill")).toBeInTheDocument()
  })

  it("asks before hiding a thread with a reply in progress, and reports the draft", async () => {
    const user = userEvent.setup()
    const onReplyDirtyChange = vi.fn()
    renderList([aQuack()], onReplyDirtyChange)

    await user.click(screen.getByRole("button", { name: "Reply" }))
    await user.type(screen.getByLabelText("Your reply"), "Hm")
    expect(onReplyDirtyChange).toHaveBeenLastCalledWith("q1", true)

    await user.click(screen.getByRole("button", { name: "Hide replies" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Keep writing" }))
    expect(screen.getByLabelText("Your reply")).toHaveValue("Hm")

    await user.click(screen.getByRole("button", { name: "Hide replies" }))
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Discard reply",
      }),
    )
    expect(screen.queryByLabelText("Your reply")).not.toBeInTheDocument()
    expect(onReplyDirtyChange).toHaveBeenLastCalledWith("q1", false)
  })

  it("offers a retry when the replies can't be loaded", async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(json(500, { message: "Pond offline" }))),
    )
    renderList([aQuack({ replyCount: 3 })])

    await user.click(screen.getByRole("button", { name: "3 replies" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Pond offline")
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })
})
