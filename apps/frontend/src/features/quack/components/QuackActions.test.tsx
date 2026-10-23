import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll, Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

// Only the network call is mocked. The real hook runs, so the pending and
// error states on screen are the ones TanStack Query actually produces.
vi.mock("@/features/quack/api/deleteQuack")
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const deleteQuackMock = vi.mocked(deleteQuack)

const poll = (totalVotes: number): Poll => ({
  options: [
    { id: "o1", text: "Pond buffet", votes: totalVotes },
    { id: "o2", text: "Bread stand", votes: 0 },
  ],
  totalVotes,
  myOptionId: null,
  canSeeResults: true,
})

const quack = (overrides: Partial<Quack> = {}): Quack => ({
  id: "q1",
  text: "my own quack",
  mood: null,
  userId: "me",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "me", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  poll: null,
  canDelete: true,
  ...overrides,
})

const someoneElsesQuack = quack({
  id: "q2",
  text: "someone else's quack",
  userId: "other",
  canDelete: false,
})

const renderList = (quacks: Quack[]) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  // The feed and a search, as the quacks page would have cached them.
  queryClient.setQueryData(quackKeys.list({}), quacks)
  queryClient.setQueryData(quackKeys.list({ search: "quack" }), quacks)
  render(
    <QueryClientProvider client={queryClient}>
      <QuackList quacks={quacks} />
    </QueryClientProvider>,
  )
  return { queryClient }
}

const openDeleteDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Quack actions" }))
  await user.click(await screen.findByRole("menuitem", { name: "Delete" }))
  return screen.findByRole("alertdialog")
}

const dialogIsClosed = () =>
  waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())

describe("QuackActions", () => {
  beforeEach(() => {
    deleteQuackMock.mockReset()
    vi.mocked(toast.success).mockReset()
  })

  it("offers the actions only on the viewer's own quacks", () => {
    renderList([quack(), someoneElsesQuack])

    // getByRole throws on two matches, so this also proves there is only one
    const actions = screen.getByRole("button", { name: "Quack actions" })
    expect(actions.closest("article")).toHaveTextContent("my own quack")
  })

  it("asks before deleting anything", async () => {
    const user = userEvent.setup()
    renderList([quack()])

    const dialog = await openDeleteDialog(user)

    expect(within(dialog).getByText("Delete quack?")).toBeInTheDocument()
    expect(dialog).toHaveTextContent("The quack will disappear from the feed for everyone.")
    expect(deleteQuackMock).not.toHaveBeenCalled()
  })

  it("deletes the quack once confirmed, drops it from every cached list and says so", async () => {
    const user = userEvent.setup()
    deleteQuackMock.mockResolvedValue()
    const { queryClient } = renderList([quack(), someoneElsesQuack])

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(deleteQuackMock).toHaveBeenCalledWith("q1", expect.anything())
    await dialogIsClosed()
    expect(toast.success).toHaveBeenCalledWith("Quack deleted")
    for (const filter of [{}, { search: "quack" }]) {
      expect(
        queryClient.getQueryData<Quack[]>(quackKeys.list(filter))?.map(({ id }) => id),
      ).toEqual(["q2"])
    }
  })

  it("closes without deleting when the user cancels", async () => {
    const user = userEvent.setup()
    renderList([quack()])

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

    await dialogIsClosed()
    expect(deleteQuackMock).not.toHaveBeenCalled()
    expect(screen.getByText("my own quack")).toBeInTheDocument()
  })

  it.each([
    [3, "The poll has 3 votes. Deleting the quack removes them too."],
    [1, "The poll has 1 vote. Deleting the quack removes it too."],
  ])("warns that a poll's votes go too (%i)", async (votes, warning) => {
    const user = userEvent.setup()
    renderList([quack({ poll: poll(votes) })])

    const dialog = await openDeleteDialog(user)

    expect(dialog).toHaveTextContent(warning)
  })

  it("says nothing about a poll nobody has voted in", async () => {
    const user = userEvent.setup()
    renderList([quack({ poll: poll(0) })])

    const dialog = await openDeleteDialog(user)

    expect(dialog).not.toHaveTextContent("The poll has")
  })

  it("locks the dialog while the quack is being deleted", async () => {
    const user = userEvent.setup()
    // the server answers only when the test says so
    let answer: (() => void) | undefined
    deleteQuackMock.mockReturnValue(
      new Promise<void>((resolve) => {
        answer = resolve
      }),
    )
    renderList([quack()])

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(await within(dialog).findByRole("button", { name: "Deleting…" })).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
    // Escape doesn't pretend to call the request back either
    await user.keyboard("{Escape}")
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()

    answer?.()
    await dialogIsClosed()
  })

  it("stays open with a message when deleting fails, and lets the user retry", async () => {
    const user = userEvent.setup()
    deleteQuackMock.mockRejectedValueOnce(new Error("Server unreachable"))
    renderList([quack()])

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Couldn't delete the quack. Try again.",
    )
    expect(toast.success).not.toHaveBeenCalled()

    deleteQuackMock.mockResolvedValueOnce()
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))

    await dialogIsClosed()
    expect(deleteQuackMock).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledWith("Quack deleted")
  })

  it("forgets an earlier failure when the dialog is opened again", async () => {
    const user = userEvent.setup()
    deleteQuackMock.mockRejectedValueOnce(new Error("Server unreachable"))
    renderList([quack()])

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))
    await within(dialog).findByRole("alert")
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await dialogIsClosed()

    const reopened = await openDeleteDialog(user)

    expect(within(reopened).queryByRole("alert")).not.toBeInTheDocument()
  })
})
