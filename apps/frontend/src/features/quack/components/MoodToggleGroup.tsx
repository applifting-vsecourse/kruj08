import type { ComponentProps } from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { QUACK_MOOD_OPTIONS, type QuackMood } from "@/lib/quack-mood"

type MoodToggleGroupProps = Omit<
  ComponentProps<typeof ToggleGroup>,
  "type" | "value" | "defaultValue" | "onValueChange"
> & {
  value?: QuackMood
  onValueChange: (mood: QuackMood | undefined) => void
}

// The mood picker of the new-quack and reply forms. The rest of the props are
// passed on, so FormControl can put its id and aria attributes on the group.
export function MoodToggleGroup({ value, onValueChange, ...props }: MoodToggleGroupProps) {
  return (
    // Radix reports "" when the active item is clicked again — that is how
    // the user clears the mood.
    <ToggleGroup
      {...props}
      type="single"
      variant="outline"
      size="sm"
      value={value ?? ""}
      onValueChange={(mood) => onValueChange(mood === "" ? undefined : (mood as QuackMood))}
    >
      {QUACK_MOOD_OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
        >
          <span aria-hidden="true">{option.emoji}</span>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
