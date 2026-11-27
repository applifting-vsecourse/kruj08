// The like button as a user meets it (.plans/quack-likes/user-story.md): the
// feed is read through the real query, as the quacks page reads it, from a
// fake server behind the real API client that keeps likes the way the
// backend does (docs/adr/002-likes.md). So the tests hold whether the screen
// learns about a like from an optimistic cache update, local state or a
// refetch — only what the user sees is pinned.
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { QuackList } from "@/features/quack/components/QuackList"

// Any way of telling the user something through sonner is recorded.
const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
  }),
}))
vi.mock("sonner", () => ({ toast }))

type QuackJson = Record<string, unknown> & {
  id: string
  likeCount?: number
  likedByMe?: boolean
}

const quackJson = (overrides: Partial<QuackJson> = {}): QuackJson => ({
  id: "q1",
  text: "Bread is overrated",
  mood: null,
  userId: "jana",
  createdAt: "2026-01-01T12:00:00Z",
  user: { id: "jana", name: "Jana Nováková", username: "jana" },
  poll: null,
  canDelete: false,
  deletionReasonRequired: false,
  deleted: false,
  replyCount: 0,
  matchedInReplies: false,
  likeCount: 0,
  likedByMe: false,
  ...overrides,
})

const placeholderJson = (overrides: Partial<QuackJson> = {}): QuackJson => ({
  id: "q1",
  text: null,
  mood: null,
  userId: "jana",
  createdAt: "2026-01-01T12:00:00Z",
  user: { id: "jana", name: "Jana Nováková", username: "jana" },
  poll: null,
  canDelete: false,
  deletionReasonRequired: false,
  deleted: true,
  replyCount: 1,
  matchedInReplies: false,
  likeCount: 0,
  likedByMe: false,
  ...overrides,
})

// --- the fake server ---------------------------------------------------------

let feed: QuackJson[]
let threads: Record<string, QuackJson[]>
// When set, PUT/DELETE …/like answer with this status instead of saving.
let likeFailure: number | null
// When set, PUT/DELETE …/like wait for it before answering.
let likeGate: Promise<void> | null
let requests: { method: string; path: string }[]

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const stored = (id: string): QuackJson | undefined =>
  [...feed, ...Object.values(threads).flat()].find((quack) => quack.id === id)

beforeEach(() => {
  feed = []
  threads = {}
  likeFailure = null
  likeGate = null
  requests = []
  for (const notify of [
    toast,
    toast.success,
    toast.error,
    toast.warning,
    toast.info,
    toast.message,
  ]) {
    notify.mockReset()
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const { pathname } = new URL(request.url)
      requests.push({ method: request.method, path: pathname })

      const like = /\/quacks\/([^/]+)\/like$/.exec(pathname)
      if (like && (request.method === "PUT" || request.method === "DELETE")) {
        if (likeGate) await likeGate
        if (likeFailure !== null) return json(likeFailure, { message: "Something broke" })
        const quackId = like[1] ?? ""
        const quack = stored(quackId)
        if (!quack || quack.deleted) return json(404, { message: `Quack ${quackId} not found` })
        // At most once per person, and taking back what isn't there is a no-op.
        const isLike = request.method === "PUT"
        if (quack.likedByMe !== isLike) {
          quack.likedByMe = isLike
          quack.likeCount = (quack.likeCount ?? 0) + (isLike ? 1 : -1)
        }
        return json(200, quack)
      }

      const thread = /\/quacks\/([^/]+)\/replies$/.exec(pathname)
      if (thread && request.method === "GET") return json(200, threads[thread[1] ?? ""] ?? [])
      if (request.method === "GET" && pathname.endsWith("/quacks")) return json(200, feed)
      return json(404, { message: "Unexpected request in the test" })
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

// --- the screen --------------------------------------------------------------

// What the quacks page does: read the feed through the query, show the list.
function Feed() {
  const { data } = useQuery(quacksQueryOptions())
  return <QuackList quacks={data ?? []} />
}

const renderFeed = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <Feed />
    </QueryClientProvider>,
  )
}

// The quack (or reply) whose text is `text`, once the feed has shown it.
const articleWith = async (text: string): Promise<HTMLElement> => {
  const article = (await screen.findByText(text)).closest("article")
  if (!article) throw new Error(`No article around “${text}”`)
  return article
}

// A toggle button: its name stays "Like…" and `aria-pressed` says whether the
// viewer likes the quack. "Unlike" would not match on purpose.
const likeButtonOf = (article: HTMLElement): HTMLElement =>
  within(article).getByRole("button", { name: /^like/i })

// The count, shown in the button as a number of its own: 3 matches "3" or
// "Like 3", never "13".
const count = (n: number) => new RegExp(`(^|\\D)${n}(\\D|$)`)

// The like requests made, as "PUT /quacks/q1/like", whatever the API prefix.
const likeRequests = () =>
  requests
    .filter(({ path }) => path.endsWith("/like"))
    .map(({ method, path }) => `${method} ${path.replace(/^.*(\/quacks\/)/, "$1")}`)

// Anything the user is told: a toast of any kind, or an alert on the page.
const toldUser = (): string[] => [
  ...[toast, toast.success, toast.error, toast.warning, toast.info, toast.message].flatMap(
    (notify) => notify.mock.calls.map(([message]) => String(message)),
  ),
  ...screen.queryAllByRole("alert").map((alert) => alert.textContent ?? ""),
]

describe("Liking quacks", () => {
  describe("Scenario 1: liking a quack", () => {
    it("shows the like at once, before the server has answered", async () => {
      const user = userEvent.setup()
      const quack = quackJson({ likeCount: 3 })
      feed = [quack]
      let answer!: () => void
      likeGate = new Promise((resolve) => (answer = resolve))
      renderFeed()

      const like = likeButtonOf(await articleWith("Bread is overrated"))
      expect(like).toHaveAttribute("aria-pressed", "false")
      expect(like).toHaveTextContent(count(3))

      await user.click(like)

      // the server has not answered yet: this is the button's own response
      expect(likeButtonOf(await articleWith("Bread is overrated"))).toHaveAttribute(
        "aria-pressed",
        "true",
      )
      expect(likeButtonOf(await articleWith("Bread is overrated"))).toHaveTextContent(count(4))
      expect(likeRequests()).toEqual(["PUT /quacks/q1/like"])

      answer()
      await waitFor(() => expect(quack.likedByMe).toBe(true))
      await waitFor(() =>
        expect(
          likeButtonOf(screen.getByText("Bread is overrated").closest("article")!),
        ).toHaveTextContent(count(4)),
      )
      expect(likeButtonOf(await articleWith("Bread is overrated"))).toHaveAttribute(
        "aria-pressed",
        "true",
      )
    })
  })

  describe("Scenario 2: taking the like back", () => {
    it("unlikes a quack the viewer liked and lowers the count", async () => {
      const user = userEvent.setup()
      feed = [quackJson({ likeCount: 4, likedByMe: true })]
      renderFeed()

      const like = likeButtonOf(await articleWith("Bread is overrated"))
      expect(like).toHaveAttribute("aria-pressed", "true")
      expect(like).toHaveTextContent(count(4))

      await user.click(like)

      await waitFor(() =>
        expect(
          likeButtonOf(screen.getByText("Bread is overrated").closest("article")!),
        ).toHaveAttribute("aria-pressed", "false"),
      )
      expect(likeButtonOf(await articleWith("Bread is overrated"))).toHaveTextContent(count(3))
      expect(likeRequests()).toEqual(["DELETE /quacks/q1/like"])
    })
  })

  describe("Scenario 4: the count everyone sees", () => {
    it("shows every quack's own count, and 0 for one nobody liked", async () => {
      feed = [
        quackJson({ id: "q1", text: "Liked by two", likeCount: 2 }),
        quackJson({ id: "q2", text: "Liked by nobody", likeCount: 0 }),
      ]
      renderFeed()

      const likedByTwo = likeButtonOf(await articleWith("Liked by two"))
      expect(likedByTwo).toHaveTextContent(count(2))
      // other people's likes are not the viewer's
      expect(likedByTwo).toHaveAttribute("aria-pressed", "false")

      const likedByNobody = likeButtonOf(await articleWith("Liked by nobody"))
      expect(likedByNobody).toHaveTextContent(count(0))
      expect(likedByNobody).toHaveAttribute("aria-pressed", "false")
    })
  })

  describe("Scenario 5: replies", () => {
    it("lets the viewer like a reply in an opened thread", async () => {
      const user = userEvent.setup()
      feed = [quackJson({ text: "Who saw the heron?", replyCount: 1 })]
      threads = {
        q1: [quackJson({ id: "r1", text: "By the mill", userId: "petr", likeCount: 0 })],
      }
      renderFeed()

      const quack = await articleWith("Who saw the heron?")
      await user.click(within(quack).getByRole("button", { name: "1 reply" }))
      const reply = await articleWith("By the mill")
      expect(likeButtonOf(reply)).toHaveTextContent(count(0))

      await user.click(likeButtonOf(reply))

      await waitFor(() =>
        expect(likeButtonOf(screen.getByText("By the mill").closest("article")!)).toHaveAttribute(
          "aria-pressed",
          "true",
        ),
      )
      expect(likeButtonOf(await articleWith("By the mill"))).toHaveTextContent(count(1))
      expect(likeRequests()).toEqual(["PUT /quacks/r1/like"])
    })
  })

  describe("Scenario 6: a deleted quack", () => {
    it("offers no like and no count on a deleted quack's placeholder", async () => {
      feed = [placeholderJson()]
      renderFeed()

      expect(await screen.findByText(/Deleted quack by @jana/)).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /^like/i })).not.toBeInTheDocument()
    })

    it("tells the viewer the quack is gone when it was deleted meanwhile, and saves nothing", async () => {
      const user = userEvent.setup()
      const quack = quackJson({ likeCount: 3 })
      feed = [quack]
      renderFeed()
      const like = likeButtonOf(await articleWith("Bread is overrated"))
      // The author deletes it after the feed loaded.
      quack.deleted = true

      await user.click(like)

      await waitFor(() =>
        expect(toldUser().some((message) => /no longer exists|deleted/i.test(message))).toBe(true),
      )
      const after = screen.queryByText("Bread is overrated")?.closest("article")
      // Still on screen until a refetch drops it, the like must not show as saved.
      if (after) {
        expect(likeButtonOf(after)).toHaveAttribute("aria-pressed", "false")
        expect(likeButtonOf(after)).toHaveTextContent(count(3))
      }
    })
  })

  describe("Scenario 7: the like can't be saved", () => {
    it("puts the button and the count back and says so", async () => {
      const user = userEvent.setup()
      feed = [quackJson({ likeCount: 3 })]
      likeFailure = 500
      renderFeed()

      await user.click(likeButtonOf(await articleWith("Bread is overrated")))

      await waitFor(() => expect(toldUser()).not.toEqual([]))
      await waitFor(() =>
        expect(
          likeButtonOf(screen.getByText("Bread is overrated").closest("article")!),
        ).toHaveAttribute("aria-pressed", "false"),
      )
      expect(likeButtonOf(await articleWith("Bread is overrated"))).toHaveTextContent(count(3))
    })

    it("puts a taken-back like back when the server refuses", async () => {
      const user = userEvent.setup()
      feed = [quackJson({ likeCount: 4, likedByMe: true })]
      likeFailure = 500
      renderFeed()

      await user.click(likeButtonOf(await articleWith("Bread is overrated")))

      await waitFor(() => expect(toldUser()).not.toEqual([]))
      await waitFor(() =>
        expect(
          likeButtonOf(screen.getByText("Bread is overrated").closest("article")!),
        ).toHaveAttribute("aria-pressed", "true"),
      )
      expect(likeButtonOf(await articleWith("Bread is overrated"))).toHaveTextContent(count(4))
    })
  })
})
