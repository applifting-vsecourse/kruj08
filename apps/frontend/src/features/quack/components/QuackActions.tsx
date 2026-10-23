import { useState } from "react"
import { Ellipsis, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { useDeleteQuack } from "@/features/quack/hooks/useDeleteQuack"
import { formatVoteCount } from "@/features/quack/lib/poll"

type QuackActionsProps = {
  quack: Quack
  className?: string
}

// The "⋯" menu on a quack and the confirmation behind its Delete item.
// QuackItem renders it only when the server says `canDelete`.
export function QuackActions({ quack, className }: QuackActionsProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const deleteQuack = useDeleteQuack()
  const votes = quack.poll?.totalVotes ?? 0

  const openConfirm = () => {
    // A failure from an earlier attempt shouldn't greet the next one.
    deleteQuack.reset()
    setIsConfirmOpen(true)
  }

  const handleOpenChange = (isOpen: boolean) => {
    // A request in flight cannot be called back, so neither Cancel nor Escape
    // pretends it can.
    if (deleteQuack.isPending) return
    setIsConfirmOpen(isOpen)
  }

  const handleDelete = async () => {
    try {
      // mutateAsync rather than mutate(…, { onSuccess }): on success the quack
      // leaves the cache and this component unmounts, and per-call callbacks
      // never run for an unmounted component. The awaited code below still does.
      await deleteQuack.mutateAsync(quack.id)
    } catch {
      // The dialog stays open and shows the error from the mutation state.
      return
    }
    setIsConfirmOpen(false)
    toast.success("Quack deleted")
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Quack actions"
            className={className}
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Opens the dialog rather than containing it, so the menu can close
              and hand focus over cleanly. */}
          <DropdownMenuItem onSelect={openConfirm}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={isConfirmOpen}
        onOpenChange={handleOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete quack?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">
                <p>The quack will disappear from the feed for everyone.</p>
                {/* Votes are other people's answers, so losing them is worth
                    a sentence. A poll nobody answered loses nothing. */}
                {votes > 0 ? (
                  <p>
                    The poll has {formatVoteCount(votes)}. Deleting the quack removes{" "}
                    {votes === 1 ? "it" : "them"} too.
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteQuack.isError ? (
            <p
              role="alert"
              className="text-sm text-destructive"
            >
              Couldn&apos;t delete the quack. Try again.
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteQuack.isPending}>Cancel</AlertDialogCancel>
            {/* A plain button, not AlertDialogAction: that one closes the
                dialog on click, and this one has to stay open until the server
                answers. */}
            <Button
              variant="destructive"
              disabled={deleteQuack.isPending}
              onClick={() => void handleDelete()}
            >
              {deleteQuack.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
