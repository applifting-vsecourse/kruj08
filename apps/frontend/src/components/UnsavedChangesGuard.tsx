import { useBlocker } from "@tanstack/react-router"

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

type UnsavedChangesGuardProps = {
  // True while a form on the page has edits that are not saved yet.
  hasUnsavedChanges: boolean
}

/**
 * Keeps the user from losing edits by accident. In-app navigation (a link,
 * the back button, a redirect) is paused behind a dialog that asks first.
 * Closing or reloading the tab gets the browser's own "leave site?" prompt,
 * the only thing a page is allowed to show at that point.
 *
 * Nothing is registered while there is nothing to lose, so the page behaves
 * exactly as before until the first edit.
 */
export function UnsavedChangesGuard({ hasUnsavedChanges }: UnsavedChangesGuardProps) {
  const blocker = useBlocker({
    shouldBlockFn: () => true,
    enableBeforeUnload: true,
    disabled: !hasUnsavedChanges,
    withResolver: true,
  })

  return (
    <AlertDialog
      open={blocker.status === "blocked"}
      // Escape and "Keep editing" both close the dialog: the navigation is
      // cancelled and the user stays where they were.
      onOpenChange={(isOpen) => {
        if (!isOpen) blocker.reset?.()
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            Your edits haven&apos;t been saved. If you leave this page now, they will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          {/* Losing work is destructive, so the button says so. */}
          <AlertDialogAction
            variant="destructive"
            onClick={() => blocker.proceed?.()}
          >
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
