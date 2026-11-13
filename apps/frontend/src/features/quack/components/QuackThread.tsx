import { useCallback, useId, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, Loader2, MessageCircle, RefreshCw } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

import type { ListedQuack } from "@/features/quack/api/quackSchemas"
import { repliesQueryOptions } from "@/features/quack/api/repliesQueryOptions"
import { QuackItem } from "@/features/quack/components/QuackItem"
import { ReplyForm } from "@/features/quack/components/ReplyForm"

export const formatReplyCount = (count: number) => (count === 1 ? "1 reply" : `${count} replies`)

type QuackThreadProps = {
  quack: ListedQuack
  // Whether a reply in this thread would be lost on navigation, keyed by the
  // quack: several threads can hold a draft at once.
  onReplyDirtyChange?: (quackId: string, isDirty: boolean) => void
  // Passed on to the replies' delete dialogs (see QuackActions).
  onDeletionDirtyChange?: (isDirty: boolean) => void
}

// The replies under a quack: collapsed to a count until opened, then the
// replies oldest first and the form for a new one. A deleted quack keeps its
// thread but takes no new replies.
export function QuackThread({
  quack,
  onReplyDirtyChange,
  onDeletionDirtyChange,
}: QuackThreadProps) {
  const [isOpen, setIsOpen] = useState(quack.matchedInReplies)
  const [hasDraft, setHasDraft] = useState(false)
  const [isDiscardOpen, setIsDiscardOpen] = useState(false)
  // Opened through "Reply": the cursor goes straight into the form.
  const [shouldFocusForm, setShouldFocusForm] = useState(false)
  const repliesId = useId()
  const canReply = !quack.deleted

  // A search or "Mine" that lists the quack for one of its replies opens the
  // thread, also when the quack was on screen already. Adjusted while
  // rendering rather than in an effect, so the closed thread never paints.
  const [didMatch, setDidMatch] = useState(quack.matchedInReplies)
  if (quack.matchedInReplies !== didMatch) {
    setDidMatch(quack.matchedInReplies)
    if (quack.matchedInReplies) setIsOpen(true)
  }

  const repliesQuery = useQuery({ ...repliesQueryOptions(quack.id), enabled: isOpen })

  const quackId = quack.id
  const handleDraftChange = useCallback(
    (isDirty: boolean) => {
      setHasDraft(isDirty)
      onReplyDirtyChange?.(quackId, isDirty)
    },
    [quackId, onReplyDirtyChange],
  )

  const startReply = () => {
    setShouldFocusForm(true)
    setIsOpen(true)
  }

  const toggle = () => {
    if (!isOpen) {
      // Reading first: the replies, not the form, get the attention.
      setShouldFocusForm(false)
      setIsOpen(true)
      return
    }
    // Collapsing unmounts the form, so a half-written reply is worth a
    // question first.
    if (hasDraft) {
      setIsDiscardOpen(true)
      return
    }
    setIsOpen(false)
  }

  // A deleted quack shows the form only to keep a draft written before the
  // deletion, so it can be copied.
  const isFormShown = canReply || hasDraft

  return (
    <div className="mt-2 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {quack.replyCount > 0 || isOpen ? (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={isOpen}
            aria-controls={repliesId}
            onClick={toggle}
          >
            {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            {isOpen ? "Hide replies" : formatReplyCount(quack.replyCount)}
          </Button>
        ) : null}
        {canReply && !isOpen ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={startReply}
          >
            <MessageCircle className="size-4" />
            Reply
          </Button>
        ) : null}
      </div>

      {isOpen ? (
        <div
          id={repliesId}
          className="flex flex-col gap-3 border-l border-border pl-4"
        >
          {repliesQuery.isLoading ? (
            <div className="flex items-center py-2 text-muted-foreground">
              <Loader2
                className="size-4 animate-spin"
                aria-label="Loading replies"
              />
            </div>
          ) : repliesQuery.error ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 text-sm text-destructive"
            >
              <span>Couldn&apos;t load the replies. {repliesQuery.error.message}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void repliesQuery.refetch()}
              >
                <RefreshCw className="size-4" />
                Try again
              </Button>
            </div>
          ) : repliesQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {canReply ? "No replies yet. Be the first." : "No replies left."}
            </p>
          ) : (
            repliesQuery.data?.map((reply) => (
              <QuackItem
                key={reply.id}
                quack={reply}
                variant="reply"
                onDeletionDirtyChange={onDeletionDirtyChange}
              />
            ))
          )}

          {isFormShown ? (
            <ReplyForm
              quackId={quack.id}
              shouldFocusOnMount={shouldFocusForm}
              isQuackDeleted={!canReply}
              onDirtyChange={handleDraftChange}
            />
          ) : null}
        </div>
      ) : null}

      <AlertDialog
        open={isDiscardOpen}
        onOpenChange={setIsDiscardOpen}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your reply?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ve started writing a reply. If you hide the replies now, it is lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep writing</AlertDialogCancel>
            {/* Losing work is destructive, so the button says so. */}
            <AlertDialogAction
              variant="destructive"
              onClick={() => setIsOpen(false)}
            >
              Discard reply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
