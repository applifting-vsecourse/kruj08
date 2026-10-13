import { describe, expect, it } from "vitest"

import { formatVoteCount, percentOf } from "@/features/quack/lib/poll"

describe("percentOf", () => {
  it("is 0 when nobody has voted", () => {
    expect(percentOf(0, 0)).toBe(0)
  })

  it("rounds to a whole percent", () => {
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(2, 3)).toBe(67)
    expect(percentOf(3, 3)).toBe(100)
  })
})

describe("formatVoteCount", () => {
  it("uses the singular for exactly one vote", () => {
    expect(formatVoteCount(0)).toBe("0 votes")
    expect(formatVoteCount(1)).toBe("1 vote")
    expect(formatVoteCount(12)).toBe("12 votes")
  })
})
