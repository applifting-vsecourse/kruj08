// Limits for a poll attached to a quack. Mirror the backend's domain constants
// so the user is told before the request is made; the server still validates.
export const POLL_OPTIONS_MIN = 2
export const POLL_OPTIONS_MAX = 4
export const POLL_OPTION_MAX_LENGTH = 50

// One rounding rule for every percentage on screen. A poll with no votes shows
// 0% everywhere rather than NaN.
export const percentOf = (votes: number, total: number): number =>
  total === 0 ? 0 : Math.round((votes / total) * 100)

export const formatVoteCount = (total: number): string =>
  `${total} ${total === 1 ? "vote" : "votes"}`
