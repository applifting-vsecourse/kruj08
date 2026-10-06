import { Loader2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type QuackSearchProps = {
  value: string
  onChange: (value: string) => void
  // True while results for the current search are still loading.
  isSearching?: boolean
  className?: string
}

export function QuackSearch({ value, onChange, isSearching, className }: QuackSearchProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor="quack-search">Search quacks</Label>
      <div className="relative">
        <Input
          id="quack-search"
          type="search"
          autoComplete="off"
          placeholder="A word from the quack, or who wrote it"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={isSearching ? "pr-9" : undefined}
        />
        {isSearching ? (
          <Loader2
            role="status"
            aria-label="Searching"
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        ) : null}
      </div>
    </div>
  )
}
