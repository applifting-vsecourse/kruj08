import { keepPreviousData, queryOptions } from "@tanstack/react-query"

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
      const searchParams = filter.search ? { search: filter.search } : undefined
      return quacksSchema.parse(await api.get("quacks", { searchParams }).json())
    },
    // Keep the previous results on screen while a new search loads, so the
    // list doesn't blink empty on every keystroke.
    placeholderData: keepPreviousData,
  })
