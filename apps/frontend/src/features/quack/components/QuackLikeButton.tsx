import { Heart } from "lucide-react"

import { Toggle } from "@/components/ui/toggle"
import { cn } from "@/lib/utils"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { useLikeQuack } from "@/features/quack/hooks/useLikeQuack"

type QuackLikeButtonProps = {
  // A live quack or reply: a placeholder of a deleted one has no likes to
  // show, so the caller renders no button for it.
  quack: Quack
}

// A toggle: `aria-pressed` says whether the viewer likes the quack, and the
// name stays "Like" either way, as for any toggle button. The count is the
// server's, the same for everyone; the client only displays it.
export function QuackLikeButton({ quack }: QuackLikeButtonProps) {
  const like = useLikeQuack(quack.id)
  const { likeCount } = quack

  return (
    <Toggle
      size="sm"
      pressed={quack.likedByMe}
      onPressedChange={(isPressed) => like.mutate({ quackId: quack.id, isLiked: isPressed })}
      className="text-muted-foreground"
    >
      <Heart
        className={cn("size-4", quack.likedByMe && "fill-current")}
        aria-hidden="true"
      />
      {/* Read as "Like, 3 likes"; seen as the heart and the number. */}
      <span className="sr-only">Like, </span>
      <span className="tabular-nums">{likeCount}</span>
      <span className="sr-only">{likeCount === 1 ? " like" : " likes"}</span>
    </Toggle>
  )
}
