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
  deletionReasonRequired: false,
  ...overrides,
})

const someoneElsesQuack = quack({
  id: "q2",
  text: "someone else's quack",
  userId: "other",
  canDelete: false,
})

const renderList = (quacks: Quack[], onDeletionDirtyChange?: (isDirty: boolean) => void) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  // The feed and a search, as the quacks page would have cached them.
  queryClient.setQueryData(quackKeys.list({}), quacks)
  queryClient.setQueryData(quackKeys.list({ search: "quack" }), quacks)
  render(
    <QueryClientProvider client={queryClient}>
      <QuackList
        quacks={quacks}
        onDeletionDirtyChange={onDeletionDirtyChange}
      />
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

    // an author is never asked why
    expect(deleteQuackMock).toHaveBeenCalledWith({ quackId: "q1" }, expect.anything())
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

  describe("for an admin", () => {
    // What the server sends an admin for someone else's quack.
    const moderated = quack({
      text: "Duckweed tea cures molting!!!",
      userId: "other",
      user: { id: "other", name: "Migration Season", username: "MigrationSeason" },
      deletionReasonRequired: true,
    })

    it("names whose quack it is and that it can't be undone", async () => {
      const user = userEvent.setup()
      renderList([moderated])

      const dialog = await openDeleteDialog(user)

      expect(dialog).toHaveTextContent(
        "The quack by Migration Season (@MigrationSeason) will disappear from the feed for everyone, its author included. This can't be undone.",
      )
      // the cursor is already where the admin has to type
      expect(within(dialog).getByLabelText("Reason")).toHaveFocus()
    })

    it.each([
      ["empty", ""],
      ["only spaces", "   "],
    ])("won't delete with a reason that is %s", async (_label, reason) => {
      const user = userEvent.setup()
      renderList([moderated])

      const dialog = await openDeleteDialog(user)
      if (reason) await user.type(within(dialog).getByLabelText("Reason"), reason)
      await user.click(within(dialog).getByRole("button", { name: "Delete" }))

      expect(await within(dialog).findByText("Write why you're deleting this quack")).toBeVisible()
      expect(deleteQuackMock).not.toHaveBeenCalled()
      expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    })

    it("won't delete with a reason over 500 characters", async () => {
      const user = userEvent.setup()
      renderList([moderated])

      const dialog = await openDeleteDialog(user)
      // paste rather than type: 501 keystrokes would only slow the test down
      await user.click(within(dialog).getByLabelText("Reason"))
      await user.paste("x".repeat(501))
      await user.click(within(dialog).getByRole("button", { name: "Delete" }))

      expect(await within(dialog).findByText("Keep it under 500 characters")).toBeVisible()
      expect(deleteQuackMock).not.toHaveBeenCalled()
    })

    it("sends the trimmed reason with the deletion", async () => {
      const user = userEvent.setup()
      deleteQuackMock.mockResolvedValue()
      renderList([moderated])

      const dialog = await openDeleteDialog(user)
      await user.type(within(dialog).getByLabelText("Reason"), "  Quack medicine  ")
      await user.click(within(dialog).getByRole("button", { name: "Delete" }))

      expect(deleteQuackMock).toHaveBeenCalledWith(
        { quackId: "q1", reason: "Quack medicine" },
        expect.anything(),
      )
      await dialogIsClosed()
      expect(toast.success).toHaveBeenCalledWith("Quack deleted")
    })

    it("keeps the reason when deleting fails", async () => {
      const user = userEvent.setup()
      deleteQuackMock.mockRejectedValueOnce(new Error("Server unreachable"))
      renderList([moderated])

      const dialog = await openDeleteDialog(user)
      await user.type(within(dialog).getByLabelText("Reason"), "Quack medicine")
      await user.click(within(dialog).getByRole("button", { name: "Delete" }))

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Couldn't delete the quack. Try again.",
      )
      expect(within(dialog).getByLabelText("Reason")).toHaveValue("Quack medicine")
    })

    it("asks before throwing a half-written reason away, and keeps it on Keep writing", async () => {
      const user = userEvent.setup()
      renderList([moderated])

      const dialog = await openDeleteDialog(user)
      await user.type(within(dialog).getByLabelText("Reason"), "Quack medicine")
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

      const discard = await screen.findByRole("alertdialog", { name: "Discard the reason?" })
      await user.click(within(discard).getByRole("button", { name: "Keep writing" }))

      await waitFor(() =>
        expect(
          screen.queryByRole("alertdialog", { name: "Discard the reason?" }),
        ).not.toBeInTheDocument(),
      )
      expect(within(dialog).getByLabelText("Reason")).toHaveValue("Quack medicine")
      expect(deleteQuackMock).not.toHaveBeenCalled()
    })

    it("closes without deleting once the reason is discarded, and starts empty next time", async () => {
      const user = userEvent.setup()
      renderList([moderated])

      const dialog = await openDeleteDialog(user)
      await user.type(within(dialog).getByLabelText("Reason"), "Quack medicine")
      // Escape asks the same question as Cancel
      await user.keyboard("{Escape}")
      const discard = await screen.findByRole("alertdialog", { name: "Discard the reason?" })
      await user.click(within(discard).getByRole("button", { name: "Discard reason" }))

      await dialogIsClosed()
      expect(deleteQuackMock).not.toHaveBeenCalled()

      const reopened = await openDeleteDialog(user)
      expect(within(reopened).getByLabelText("Reason")).toHaveValue("")
    })

    it("closes straight away when nothing has been written", async () => {
      const user = userEvent.setup()
      renderList([moderated])

      const dialog = await openDeleteDialog(user)
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

      await dialogIsClosed()
    })

    it("tells the page while a reason is unsaved, so it can guard navigation", async () => {
      const user = userEvent.setup()
      const onDeletionDirtyChange = vi.fn()
      renderList([moderated], onDeletionDirtyChange)

      const dialog = await openDeleteDialog(user)
      await user.type(within(dialog).getByLabelText("Reason"), "Q")
      expect(onDeletionDirtyChange).toHaveBeenLastCalledWith(true)

      await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
      const discard = await screen.findByRole("alertdialog", { name: "Discard the reason?" })
      await user.click(within(discard).getByRole("button", { name: "Discard reason" }))

      await waitFor(() => expect(onDeletionDirtyChange).toHaveBeenLastCalledWith(false))
    })
  })
})
