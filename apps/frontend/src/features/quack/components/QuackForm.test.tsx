import { createRef, type Ref } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { QuackForm, type QuackFormHandle } from "@/features/quack/components/QuackForm"

// The mutation hook needs a query client; no request is ever sent here.
const renderForm = (onDirtyChange?: (isDirty: boolean) => void, ref?: Ref<QuackFormHandle>) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <QuackForm
        ref={ref}
        onDirtyChange={onDirtyChange}
      />
    </QueryClientProvider>,
  )
}

const textField = () => screen.getByLabelText("New quack")
const addPollButton = () => screen.getByRole("button", { name: /add poll/i })

describe("QuackForm", () => {
  it("reports when it starts holding unsaved edits", async () => {
    const onDirtyChange = vi.fn()
    renderForm(onDirtyChange)
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)

    await userEvent.type(textField(), "Lunch?")
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it("puts the cursor in the text field when asked from outside", async () => {
    const ref = createRef<QuackFormHandle>()
    renderForm(undefined, ref)
    expect(textField()).not.toHaveFocus()

    act(() => ref.current?.focus())

    // react-hook-form focuses on the next tick, not synchronously
    await waitFor(() => expect(textField()).toHaveFocus())
  })

  it("starts without a poll and opens two option fields on Add poll", async () => {
    renderForm()
    expect(screen.queryByLabelText(/^Option \d$/)).not.toBeInTheDocument()

    await userEvent.click(addPollButton())

    expect(screen.getByLabelText("Option 1")).toBeInTheDocument()
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument()
    expect(screen.queryByLabelText("Option 3")).not.toBeInTheDocument()
    // the entry point is gone while the poll block is open
    expect(screen.queryByRole("button", { name: /add poll/i })).not.toBeInTheDocument()
  })

  it("grows to four options and lets the extra ones be removed", async () => {
    renderForm()
    await userEvent.click(addPollButton())
    const addOption = () => screen.getByRole("button", { name: /add option/i })

    await userEvent.click(addOption())
    await userEvent.click(addOption())
    expect(screen.getByLabelText("Option 4")).toBeInTheDocument()
    // four is the maximum, so there is nothing more to add
    expect(screen.queryByRole("button", { name: /add option/i })).not.toBeInTheDocument()
    // the first two are the minimum and cannot be removed
    expect(screen.queryByRole("button", { name: "Remove option 1" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove option 2" })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Remove option 4" }))
    expect(screen.queryByLabelText("Option 4")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /add option/i })).toBeInTheDocument()
  })

  it("drops the poll again on Remove poll and is clean afterwards", async () => {
    const onDirtyChange = vi.fn()
    renderForm(onDirtyChange)
    await userEvent.click(addPollButton())
    await userEvent.click(screen.getByRole("button", { name: /remove poll/i }))

    expect(screen.queryByLabelText(/^Option \d$/)).not.toBeInTheDocument()
    expect(addPollButton()).toBeInTheDocument()
    // nothing typed, poll gone: nothing left that could be lost
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it("tells the user about empty and duplicate options before sending", async () => {
    renderForm()
    await userEvent.type(textField(), "Lunch?")
    await userEvent.click(addPollButton())
    await userEvent.type(screen.getByLabelText("Option 1"), "Pizza")
    await userEvent.type(screen.getByLabelText("Option 2"), " Pizza ")

    await userEvent.click(screen.getByRole("button", { name: "Quack" }))
    expect(await screen.findByText("Options must be different from each other")).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText("Option 2"))
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))
    expect(await screen.findByText("Give this option some text")).toBeInTheDocument()
  })
})
