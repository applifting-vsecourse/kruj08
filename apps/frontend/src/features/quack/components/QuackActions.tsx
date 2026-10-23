import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Ellipsis, Loader2, Trash2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { useDeleteQuack } from "@/features/quack/hooks/useDeleteQuack"
import { formatVoteCount } from "@/features/quack/lib/poll"

// Mirrors DELETION_REASON_MAX_LENGTH on the server, which checks it again.
const REASON_MAX_LENGTH = 500

// Characters as the server and its database count them: code points, so an
// emoji is one. `.max()` would count UTF-16 units, where it is two.
const characterCount = (value: string) => Array.from(value).length

// The reason is checked only where the server asks for one (an admin). For
// everyone else the field is not on screen and anything goes.
const deletionSchema = (isReasonRequired: boolean) =>
  z.object({
    reason: isReasonRequired
      ? z
          .string()
          .trim()
          .min(1, "Write why you're deleting this quack")
          .refine(
            (reason) => characterCount(reason) <= REASON_MAX_LENGTH,
            `Keep it under ${REASON_MAX_LENGTH} characters`,
          )
      : z.string(),
  })

type DeletionValues = { reason: string }

type QuackActionsProps = {
  quack: Quack
  className?: string
  // Reports whether the dialog holds a reason that would be lost on
  // navigation. The route turns it into a guard, as it does for the form.
  onDirtyChange?: (isDirty: boolean) => void
}

// The "⋯" menu on a quack and the confirmation behind its Delete item.
// QuackItem renders it only when the server says `canDelete`. When the server
// also says `deletionReasonRequired` (an admin), the confirmation asks why.
export function QuackActions({ quack, className, onDirtyChange }: QuackActionsProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDiscardOpen, setIsDiscardOpen] = useState(false)
  const deleteQuack = useDeleteQuack()
  const votes = quack.poll?.totalVotes ?? 0
  const isReasonRequired = quack.deletionReasonRequired

  const form = useForm<DeletionValues>({
    resolver: zodResolver(deletionSchema(isReasonRequired)),
    defaultValues: { reason: "" },
  })

  const { isDirty } = form.formState
  // Only the dialog holding a reason reports, and it takes the report back
  // once the reason is gone: sent, discarded, or unmounted along with a quack
  // that left the list. Every other quack's menu stays silent, so newcomers
  // and leavers on a refetch can't clear the guard this one relies on.
  useEffect(() => {
    if (!isDirty) return
    onDirtyChange?.(true)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  const openConfirm = () => {
    // A failure or a discarded reason from an earlier attempt shouldn't greet
    // the next one.
    deleteQuack.reset()
    form.reset()
    setIsConfirmOpen(true)
  }

  const handleOpenChange = (isOpen: boolean) => {
    // A request in flight cannot be called back, so neither Cancel nor Escape
    // pretends it can.
    if (deleteQuack.isPending) return
    // A half-written reason is worth a question before it is thrown away.
    if (!isOpen && isDirty) {
      setIsDiscardOpen(true)
      return
    }
    setIsConfirmOpen(isOpen)
  }

  const discardReason = () => {
    form.reset()
    setIsConfirmOpen(false)
  }

  const handleDelete = form.handleSubmit(async ({ reason }) => {
    try {
      // mutateAsync rather than mutate(…, { onSuccess }): on success the quack
      // leaves the cache and this component unmounts, and per-call callbacks
      // never run for an unmounted component. The awaited code below still does.
      await deleteQuack.mutateAsync({
        quackId: quack.id,
        reason: isReasonRequired ? reason : undefined,
      })
    } catch {
      // The dialog stays open, with the reason as typed, and shows the error
      // from the mutation state.
      return
    }
    form.reset()
    setIsConfirmOpen(false)
    toast.success("Quack deleted")
  })

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
        <AlertDialogContent
          // An admin's next step is writing the reason, so the cursor starts
          // there instead of on Cancel.
          onOpenAutoFocus={(event) => {
            if (!isReasonRequired) return
            event.preventDefault()
            form.setFocus("reason")
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete quack?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">
                {/* An admin may be deleting someone else's words, so the
                    dialog names whose. */}
                {isReasonRequired ? (
                  <p>
                    The quack by {quack.user.name} (@{quack.user.username}) will disappear from the
                    feed for everyone, its author included. This can&apos;t be undone.
                  </p>
                ) : (
                  <p>The quack will disappear from the feed for everyone.</p>
                )}
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

          <Form {...form}>
            <form
              noValidate
              onSubmit={(event) => void handleDelete(event)}
              className="grid gap-4"
            >
              {isReasonRequired ? (
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Sells duckweed tea as a cure for molting."
                          disabled={deleteQuack.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Kept on record only. Nobody sees it, and the author isn&apos;t told.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

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
                {/* A plain submit button, not AlertDialogAction: that one
                    closes the dialog on click, and this one has to stay open
                    until the reason checks out and the server answers. */}
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={deleteQuack.isPending}
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
            </form>
          </Form>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stacks on top of the confirmation; Escape and "Keep writing" close
          only this one and leave the reason where it was. */}
      <AlertDialog
        open={isDiscardOpen}
        onOpenChange={setIsDiscardOpen}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard the reason?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ve started writing why this quack should go. If you close now, the reason is
              lost and the quack stays.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep writing</AlertDialogCancel>
            {/* Losing work is destructive, so the button says so. */}
            <AlertDialogAction
              variant="destructive"
              onClick={discardReason}
            >
              Discard reason
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
