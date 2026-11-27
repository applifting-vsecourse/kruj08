import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { isNotFoundError } from "@/lib/api-client"

import { likeQuack } from "@/features/quack/api/likeQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { ListedQuack, Quack } from "@/features/quack/api/quackSchemas"

type LikeFields = Pick<Quack, "likeCount" | "likedByMe">

// Rewrites the like fields of one quack wherever the cache holds it: the
// feed, any search or "Mine", and any open thread if it is a reply.
const updateLikes = (
  queryClient: QueryClient,
  quackId: string,
  update: (current: LikeFields) => LikeFields,
) =>
  queryClient.setQueriesData<ListedQuack[]>({ queryKey: quackKeys.all() }, (quacks) =>
    quacks?.map((cached) =>
      cached.id === quackId && !cached.deleted ? { ...cached, ...update(cached) } : cached,
    ),
  )

// Liking answers at once: the button and the count change before the server
// has answered, and go back with a message when it refuses. Unlike a vote,
// whose results stay hidden until the server has counted it, a like reveals
// nothing, so guessing the new count is safe; the server's answer then
// replaces the guess.
export function useLikeQuack(quackId: string) {
  const queryClient = useQueryClient()
  const mutationKey = [...quackKeys.all(), "like", quackId]
  // Whether this is the last like request for the quack still in flight: only
  // that one's answer is the state the user ended up asking for.
  const isLastInFlight = () => queryClient.isMutating({ mutationKey }) <= 1

  return useMutation({
    mutationKey,
    // A double click sends its requests one after the other, in click order,
    // so the server ends up where the last click meant.
    scope: { id: mutationKey.join(":") },
    mutationFn: likeQuack,
    onMutate: async ({ isLiked }) => {
      // A refetch landing now would overwrite the change below.
      await queryClient.cancelQueries({ queryKey: quackKeys.all() })
      let previous: LikeFields | undefined
      updateLikes(queryClient, quackId, (current) => {
        previous ??= { likeCount: current.likeCount, likedByMe: current.likedByMe }
        if (current.likedByMe === isLiked) return current
        return {
          likedByMe: isLiked,
          likeCount: Math.max(0, current.likeCount + (isLiked ? 1 : -1)),
        }
      })
      return { previous }
    },
    onSuccess: (quack) => {
      if (!isLastInFlight()) return
      updateLikes(queryClient, quackId, () => ({
        likeCount: quack.likeCount,
        likedByMe: quack.likedByMe,
      }))
    },
    onError: (error, _input, context) => {
      const previous = context?.previous
      if (previous) updateLikes(queryClient, quackId, () => previous)
      // 404: deleted after this screen loaded. The refetch below drops it or
      // turns it into a placeholder.
      toast.error(
        isNotFoundError(error)
          ? "This quack no longer exists. It was deleted."
          : "Couldn't save your like. Try again.",
      )
    },
    onSettled: () => {
      // …and then what the server says, likes other people gave included.
      if (isLastInFlight()) void queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })
}
