import { QUACK_MOOD_OPTIONS, type QuackMood } from "@/lib/quack-mood"
import { cn } from "@/lib/utils"

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
