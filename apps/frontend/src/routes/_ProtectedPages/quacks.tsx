import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"

import { normalizeQuackSearch, quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { QuackForm } from "@/features/quack/components/QuackForm"
import { QuackList } from "@/features/quack/components/QuackList"
import { QuackSearch } from "@/features/quack/components/QuackSearch"

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  component: QuacksPage,
})

// How long the user has to stop typing before a search request is sent.
const SEARCH_DEBOUNCE_MS = 300

function QuacksPage() {
  const [searchInput, setSearchInput] = useState("")
  const search = normalizeQuackSearch(useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS))
  const quacksQuery = useQuery(quacksQueryOptions({ search }))

  // "Searching" covers both the debounce window and the request in flight,
  // so the indicator never disappears and reappears mid-typing.
  const isSearching =
    normalizeQuackSearch(searchInput) !== search || (quacksQuery.isFetching && search !== undefined)

  return (
    <>
      <Seo title="Quacks" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        <QuackForm className="mb-6" />

        <QuackSearch
          value={searchInput}
          onChange={setSearchInput}
          isSearching={isSearching}
          className="mb-4"
        />

        <QuackList
          quacks={quacksQuery.data ?? []}
          isLoading={quacksQuery.isLoading}
          error={quacksQuery.error ?? undefined}
          search={search}
          // Only the error state offers a retry — posting invalidates the list,
          // and refocusing the tab refetches it.
          onReload={() => void quacksQuery.refetch()}
        />
      </section>
    </>
  )
}
