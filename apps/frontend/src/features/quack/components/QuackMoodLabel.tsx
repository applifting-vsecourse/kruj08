import { cn } from "@/lib/utils"

import type { QuackMood } from "@/features/quack/api/quackSchemas"

// One place that says how each mood looks, used by the form (to pick one) and
// by the feed (to show it), so the two can never disagree.
export const QUACK_MOOD_OPTIONS: { value: QuackMood; label: string; emoji: string }[] = [
  { value: "happy", label: "Happy", emoji: "😄" },
  { value: "sad", label: "Sad", emoji: "😢" },
  { value: "angry", label: "Angry", emoji: "😠" },
  { value: "silly", label: "Silly", emoji: "🤪" },
]

type QuackMoodLabelProps = {
  mood: QuackMood
  className?: string
}

export function QuackMoodLabel({ mood, className }: QuackMoodLabelProps) {
  const option = QUACK_MOOD_OPTIONS.find((candidate) => candidate.value === mood)
  if (!option) return null

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span aria-hidden="true">{option.emoji}</span>
      {option.label}
    </span>
  )
}
