export type QuackListFilter = {
  // Trimmed, non-empty search; undefined is the full feed.
  search?: string
}

export const quackKeys = {
  all: () => ["quacks"] as const,
  // Prefix for every list variant — invalidate this after a mutation so a
  // narrowed list refreshes along with the full feed.
  lists: () => [...quackKeys.all(), "list"] as const,
  // One cache entry per search, so results for an old search are never
  // shown under a new one.
  list: (filter: QuackListFilter) => [...quackKeys.lists(), filter] as const,
}
