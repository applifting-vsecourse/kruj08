import { Loader2, PenLine, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import type { Quack, QuackAuthorFilter } from "@/features/quack/api/quackSchemas"
import { QuackItem } from "@/features/quack/components/QuackItem"

type QuackListProps = {
  quacks: Quack[]
  isLoading?: boolean
  error?: Error
  onReload?: () => void
  // The active search, if any — changes what an empty list means.
  search?: string
  // "me" when the list shows only the viewer's quacks — so does this.
  author?: QuackAuthorFilter
  // Takes the viewer to the new-quack form. Offered only to an author who
  // has posted nothing yet.
  onWriteFirst?: () => void
  // Whether a delete dialog in the list holds a reason that would be lost on
  // navigation. Dialogs are modal, so at most one is open at a time.
  onDeletionDirtyChange?: (isDirty: boolean) => void
}

const emptyMessage = (search?: string, author?: QuackAuthorFilter) => {
  if (author === "me") {
    return search ? `None of your quacks match “${search}”.` : "You haven't quacked anything yet."
  }
  return search
    ? `No quacks match “${search}”. Try a different word or name.`
    : "No quacks yet. Post the first one."
}

export function QuackList({
  quacks,
  isLoading,
  error,
  onReload,
  search,
  author,
  onWriteFirst,
  onDeletionDirtyChange,
}: QuackListProps) {
  return (
    <div className="flex flex-col">
      {isLoading && quacks.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : null}

      {error ? (
        <Alert
          variant="destructive"
          className="mb-4"
        >
          <AlertTitle>Couldn&apos;t load quacks</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error.message}</span>
            {onReload ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onReload}
              >
                <RefreshCw className="size-4" />
                Reload
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !error && quacks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage(search, author)}</p>
          {/* A search that missed is fixed by changing the search, so only an
              author with nothing at all is invited to write. */}
          {author === "me" && !search && onWriteFirst ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onWriteFirst}
            >
              <PenLine className="size-4" />
              Write your first quack
            </Button>
          ) : null}
        </div>
      ) : null}

      {quacks.map((quack) => (
        <QuackItem
          key={quack.id}
          quack={quack}
          onDeletionDirtyChange={onDeletionDirtyChange}
        />
      ))}
    </div>
  )
}
