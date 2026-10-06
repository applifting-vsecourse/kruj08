import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useDebouncedValue } from "@/hooks/useDebouncedValue"

describe("useDebouncedValue", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("only settles on the last value once typing pauses", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "" },
    })

    rerender({ value: "d" })
    rerender({ value: "du" })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    rerender({ value: "duck" })

    // Still the initial value: nothing has been quiet for 300 ms yet.
    expect(result.current).toBe("")

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe("duck")
  })
})
