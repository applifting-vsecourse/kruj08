import type { QuackAuthorFilter } from "@/features/quack/api/quackSchemas"

export type QuackListFilter = {
  // Trimmed, non-empty search; undefined is the full feed.
  search?: string
  // "me" narrows to the signed-in user's own quacks; undefined is everyone's.
  author?: QuackAuthorFilter
}

export const quackKeys = {
  all: () => ["quacks"] as const,
  // Prefix for every list variant — invalidate this after a mutation so a
  // narrowed list refreshes along with the full feed.
  lists: () => [...quackKeys.all(), "list"] as const,
  // One cache entry per search and author, so results for an old filter are
  // never shown under a new one.
  list: (filter: QuackListFilter) => [...quackKeys.lists(), filter] as const,
}
