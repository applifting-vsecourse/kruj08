import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys, type QuackListFilter } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

// Whitespace-only input is the full feed; the server treats it the same way.
export const normalizeQuackSearch = (search: string): string | undefined => {
  const trimmed = search.trim()
  return trimmed === "" ? undefined : trimmed
}

export const quacksQueryOptions = (filter: QuackListFilter = {}) =>
  queryOptions({
    queryKey: quackKeys.list(filter),
    queryFn: async () => {
      // ky leaves out the undefined ones, so the full feed has no query string.
      const searchParams = { search: filter.search, author: filter.author }
      return quacksSchema.parse(await api.get("quacks", { searchParams }).json())
    },
    // Keep the previous results on screen while a new search loads, so the
    // list doesn't blink empty on every keystroke — but only for the same
    // author. Switching to "Mine" must never show everyone's quacks under it,
    // not even for the moment the request takes.
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[2].author === filter.author ? previousData : undefined,
  })
