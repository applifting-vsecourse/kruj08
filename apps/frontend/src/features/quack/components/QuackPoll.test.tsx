import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Poll } from "@/features/quack/api/quackSchemas"
import { QuackPoll } from "@/features/quack/components/QuackPoll"
import { useVoteQuack } from "@/features/quack/hooks/useVoteQuack"

// The component owns no request logic; the hook is the seam, so it is mocked
// and the test drives its state directly.
vi.mock("@/features/quack/hooks/useVoteQuack")

const mutate = vi.fn()
const reset = vi.fn()

const mockVote = (state: Partial<ReturnType<typeof useVoteQuack>> = {}) => {
  vi.mocked(useVoteQuack).mockReturnValue({
    mutate,
    reset,
    isPending: false,
    isError: false,
    ...state,
  } as unknown as ReturnType<typeof useVoteQuack>)
}

const poll = (overrides: Partial<Poll> = {}): Poll => ({
  options: [
    { id: "o1", text: "Pond buffet", votes: 2 },
    { id: "o2", text: "Bread stand", votes: 1 },
    { id: "o3", text: "Skip lunch", votes: 0 },
  ],
  totalVotes: 3,
  myOptionId: null,
  ...overrides,
})

describe("QuackPoll", () => {
  beforeEach(() => {
    mutate.mockReset()
    reset.mockReset()
    mockVote()
  })

  it("shows only the options before the viewer has voted", () => {
    render(
      <QuackPoll
        quackId="q1"
        poll={poll()}
      />,
    )

    expect(screen.getByRole("button", { name: "Pond buffet" })).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/votes?$/)).not.toBeInTheDocument()
  })

  it("casts a vote for the clicked option", async () => {
    const user = userEvent.setup()
    render(
      <QuackPoll
        quackId="q1"
        poll={poll()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Bread stand" }))

    expect(reset).toHaveBeenCalledTimes(1)
    expect(mutate).toHaveBeenCalledWith({ quackId: "q1", optionId: "o2" })
  })

  it("locks the options while a vote is being saved", () => {
    mockVote({ isPending: true })
    render(
      <QuackPoll
        quackId="q1"
        poll={poll()}
      />,
    )

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled()
    }
  })

  it("shows results with the viewer's choice highlighted after they voted", () => {
    render(
      <QuackPoll
        quackId="q1"
        poll={poll({ myOptionId: "o1" })}
      />,
    )

    expect(screen.getByText("67%")).toBeInTheDocument()
    expect(screen.getByText("33%")).toBeInTheDocument()
    expect(screen.getByText("0%")).toBeInTheDocument()
    expect(screen.getByText("3 votes")).toBeInTheDocument()

    const mine = screen.getByRole("button", { name: /Pond buffet/ })
    expect(mine).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /Bread stand/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })

  it("moves the vote when a different option is clicked, and ignores the current one", async () => {
    const user = userEvent.setup()
    render(
      <QuackPoll
        quackId="q1"
        poll={poll({ myOptionId: "o1" })}
      />,
    )

    await user.click(screen.getByRole("button", { name: /Pond buffet/ }))
    expect(mutate).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /Skip lunch/ }))
    expect(mutate).toHaveBeenCalledWith({ quackId: "q1", optionId: "o3" })
  })

  it("tells the viewer when the vote could not be saved and lets them retry", () => {
    mockVote({ isError: true })
    render(
      <QuackPoll
        quackId="q1"
        poll={poll()}
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save your vote. Try again.")
    // Nothing was counted, so the poll still looks un-voted and stays clickable.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeEnabled()
    }
  })
})
