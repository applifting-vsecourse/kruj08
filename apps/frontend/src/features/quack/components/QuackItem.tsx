import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDate } from "@/lib/date"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackActions } from "@/features/quack/components/QuackActions"
import { QuackMoodLabel } from "@/features/quack/components/QuackMoodLabel"
import { QuackPoll } from "@/features/quack/components/QuackPoll"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"

type QuackItemProps = {
  quack: Quack
  // Whether the delete dialog holds a reason that would be lost on navigation.
  onDeletionDirtyChange?: (isDirty: boolean) => void
}

export function QuackItem({ quack, onDeletionDirtyChange }: QuackItemProps) {
  const { name, username } = quack.user

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <article className="flex w-full gap-4 border-b border-border pt-2 pb-4 last:border-b-0">
      <Avatar className="size-12">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex flex-1 flex-col gap-1">
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
        <p className="text-sm break-words whitespace-pre-line">{quack.text}</p>
        {/* The text is the question; the poll sits right under it. No card —
            spacing alone separates it from the text (see DESIGN.md). */}
        {quack.poll ? (
          <QuackPoll
            quackId={quack.id}
            poll={quack.poll}
            className="mt-2"
          />
        ) : null}
      </div>

      {/* Someone else's quack gets no menu at all rather than an empty one. */}
      {quack.canDelete ? (
        <QuackActions
          quack={quack}
          className="self-start"
          onDirtyChange={onDeletionDirtyChange}
        />
      ) : null}
    </article>
  )
}
