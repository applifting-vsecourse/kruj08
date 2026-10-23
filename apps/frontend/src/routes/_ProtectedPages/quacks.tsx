import { useRef, useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { Seo } from "@/components/Seo"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UnsavedChangesGuard } from "@/components/UnsavedChangesGuard"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"

import { profileQueryOptions } from "@/features/profile/api/profileQueryOptions"
import { quackAuthorFilterSchema } from "@/features/quack/api/quackSchemas"
import { normalizeQuackSearch, quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { QuackForm, type QuackFormHandle } from "@/features/quack/components/QuackForm"
import { QuackList } from "@/features/quack/components/QuackList"
import { QuackSearch } from "@/features/quack/components/QuackSearch"

// The tab lives in the URL (`?author=me` is Mine), so it survives a reload,
// Back from another page, a bookmark and the round trip through login. Any
// other value opens All rather than an error page.
const quacksSearchSchema = z.object({
  author: quackAuthorFilterSchema.optional().catch(undefined),
})

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  validateSearch: quacksSearchSchema,
  // The new-quack form starts with the user's default mood, so the profile is
  // loaded before the page renders — otherwise the form would mount without it.
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQueryOptions()),
  component: QuacksPage,
})

// How long the user has to stop typing before a search request is sent.
const SEARCH_DEBOUNCE_MS = 300

function QuacksPage() {
  const { data: profile } = useSuspenseQuery(profileQueryOptions())
  const { author } = Route.useSearch()
  const navigate = Route.useNavigate()
  const formRef = useRef<QuackFormHandle>(null)
  const [searchInput, setSearchInput] = useState("")
  // A half-written quack (or poll), or an admin's half-written reason for
  // deleting one, is worth a warning before the user leaves. The form and the
  // list report their dirty state; the route owns the guard, as Settings does.
  const [hasUnsavedQuack, setHasUnsavedQuack] = useState(false)
  const [hasUnsavedDeletionReason, setHasUnsavedDeletionReason] = useState(false)
  const search = normalizeQuackSearch(useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS))
  const quacksQuery = useQuery(quacksQueryOptions({ search, author }))

  // "Searching" covers both the debounce window and the request in flight,
  // so the indicator never disappears and reappears mid-typing.
  const isSearching =
    normalizeQuackSearch(searchInput) !== search || (quacksQuery.isFetching && search !== undefined)

  const tab = author === "me" ? "mine" : "all"
  const selectTab = (value: string) =>
    void navigate({
      // The search box is left alone: the same words now look in the other tab.
      search: (previous) => ({ ...previous, author: value === "mine" ? "me" : undefined }),
      // Back leaves the page instead of replaying every tab that was clicked.
      replace: true,
    })

  return (
    <>
      <Seo title="Quacks" />
      <UnsavedChangesGuard hasUnsavedChanges={hasUnsavedQuack || hasUnsavedDeletionReason} />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        {/* The route component composes the two features: quack/ may not import
            from profile/, so the default mood arrives as a prop. */}
        <QuackForm
          ref={formRef}
          className="mb-6"
          defaultMood={profile.defaultMood}
          onDirtyChange={setHasUnsavedQuack}
        />

        <Tabs
          value={tab}
          onValueChange={selectTab}
          className="gap-4"
        >
          <TabsList
            variant="line"
            aria-label="Whose quacks"
          >
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="mine">Mine</TabsTrigger>
          </TabsList>

          {/* Both tabs are the same search and list with a different filter,
              so a single panel follows whichever tab is active. */}
          <TabsContent value={tab}>
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
              author={author}
              // Only the error state offers a retry — posting invalidates the list,
              // and refocusing the tab refetches it.
              onReload={() => void quacksQuery.refetch()}
              onWriteFirst={() => formRef.current?.focus()}
              onDeletionDirtyChange={setHasUnsavedDeletionReason}
            />
          </TabsContent>
        </Tabs>
      </section>
    </>
  )
}
