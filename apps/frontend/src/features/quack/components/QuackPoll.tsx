import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

import type { Poll } from "@/features/quack/api/quackSchemas"
import { useVoteQuack } from "@/features/quack/hooks/useVoteQuack"
import { formatVoteCount, percentOf } from "@/features/quack/lib/poll"

type QuackPollProps = {
  quackId: string
  poll: Poll
  className?: string
}

// Two looks, one component: plain option buttons while the counts are hidden,
// result bars (with the viewer's own vote highlighted, if any) once the server
// says they may see them. Clicking an option in either look casts or moves
// the vote.
export function QuackPoll({ quackId, poll, className }: QuackPollProps) {
  const vote = useVoteQuack()

  const handleVote = (optionId: string) => {
    // Re-picking the current choice is a no-op, not a request.
    if (optionId === poll.myOptionId) return
    // Clear a previous failure so the message doesn't linger over a retry.
    vote.reset()
    vote.mutate({ quackId, optionId })
  }

  return (
    <div
      role="group"
      aria-label="Poll"
      className={cn("flex flex-col gap-2", className)}
    >
      {poll.options.map((option) => {
        const isMine = option.id === poll.myOptionId

        if (!poll.canSeeResults) {
          return (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start"
              disabled={vote.isPending}
              onClick={() => handleVote(option.id)}
            >
              {option.text}
            </Button>
          )
        }

        const percent = percentOf(option.votes, poll.totalVotes)
        return (
          <div
            key={option.id}
            className="flex flex-col gap-1"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={isMine}
              className={cn("w-full justify-between", isMine && "font-medium")}
              disabled={vote.isPending}
              onClick={() => handleVote(option.id)}
            >
              <span className="flex items-center gap-2 truncate">
                {isMine ? (
                  <Check
                    className="size-4"
                    aria-label="Your vote"
                  />
                ) : null}
                <span className="truncate">{option.text}</span>
              </span>
              <span className="text-muted-foreground">{percent}%</span>
            </Button>
            <Progress
              value={percent}
              aria-label={`${option.text}: ${formatVoteCount(option.votes)}`}
            />
          </div>
        )
      })}

      {poll.canSeeResults ? (
        <p className="text-sm text-muted-foreground">{formatVoteCount(poll.totalVotes)}</p>
      ) : null}

      {vote.isError ? (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          Couldn&apos;t save your vote. Try again.
        </p>
      ) : null}
    </div>
  )
}
