import type { ReactNode } from "react"
import { MessageSquareOff } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDate } from "@/lib/date"
import { cn } from "@/lib/utils"

import type { ListedQuack } from "@/features/quack/api/quackSchemas"
import { QuackActions } from "@/features/quack/components/QuackActions"
import { QuackMoodLabel } from "@/features/quack/components/QuackMoodLabel"
import { QuackPoll } from "@/features/quack/components/QuackPoll"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"

type QuackItemProps = {
  quack: ListedQuack
  // A reply sits inside its quack's thread: smaller, and without the divider
  // that separates quacks in the list.
  variant?: "quack" | "reply"
  // Whether the delete dialog holds a reason that would be lost on navigation.
  onDeletionDirtyChange?: (isDirty: boolean) => void
  // The thread, under the quack's content. Rendered in the same place for a
  // live quack and its placeholder, so a reply being written survives the
  // quack turning into one.
  children?: ReactNode
}

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

export function QuackItem({
  quack,
  variant = "quack",
  onDeletionDirtyChange,
  children,
}: QuackItemProps) {
  const { name, username } = quack.user
  const isReply = variant === "reply"

  return (
    <article
      className={cn(
        "flex w-full",
        isReply ? "gap-3" : "gap-4 border-b border-border pt-2 pb-4 last:border-b-0",
      )}
    >
      <Avatar className={isReply ? "size-8" : "size-12"}>
        <AvatarFallback>
          {/* A placeholder has no author to show, only that it is gone. */}
          {quack.deleted ? (
            <MessageSquareOff
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            initialsOf(name)
          )}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {quack.deleted ? (
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-sm text-muted-foreground">Deleted quack by @{username}</p>
            <span className="text-xs text-muted-foreground">·</span>
            <time className="text-xs text-muted-foreground">{formatDate(quack.createdAt)}</time>
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-2">
            <span>
              <UsersName name={name} /> <UsersUserName username={username} />
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <time className="text-xs text-muted-foreground">{formatDate(quack.createdAt)}</time>
            {/* A quack without a mood renders exactly as before: nothing extra. */}
            {quack.mood ? (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <QuackMoodLabel
                  mood={quack.mood}
                  className="text-xs text-muted-foreground"
                />
              </>
            ) : null}
          </div>
        )}
        {quack.deleted ? null : (
          <p className="text-sm break-words whitespace-pre-line">{quack.text}</p>
        )}
        {/* The text is the question; the poll sits right under it. No card —
            spacing alone separates it from the text (see DESIGN.md). */}
        {!quack.deleted && quack.poll ? (
          <QuackPoll
            quackId={quack.id}
            poll={quack.poll}
            className="mt-2"
          />
        ) : null}
        {children}
      </div>

      {/* Someone else's quack, and any placeholder, gets no menu at all rather
          than an empty one. */}
      {!quack.deleted && quack.canDelete ? (
        <QuackActions
          quack={quack}
          isReply={isReply}
          className="self-start"
          onDirtyChange={onDeletionDirtyChange}
        />
      ) : null}
    </article>
  )
}
