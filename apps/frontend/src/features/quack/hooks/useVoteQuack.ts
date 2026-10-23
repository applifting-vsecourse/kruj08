import { useMutation, useQueryClient } from "@tanstack/react-query"

import { isNotFoundError } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { voteQuack } from "@/features/quack/api/voteQuack"

// No optimistic update on purpose: the options stay locked while the request
// is in flight and the results only appear once the server has counted the
// vote. That is what makes "the numbers are the same for everyone" true.
export function useVoteQuack() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: voteQuack,
    onSuccess: (quack) => {
      // Swap the quack in every cached list (full feed and any active search)
      // so the result bars show without waiting for a refetch…
      queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
        quacks?.map((cached) => (cached.id === quack.id ? quack : cached)),
      )
      // …then refetch anyway, so votes other people cast meanwhile come in too.
      void queryClient.invalidateQueries({ queryKey: quackKeys.lists() })
    },
    onError: (error) => {
      // 404: the author deleted the quack after this feed loaded. Refetch, so
      // it drops out of the feed instead of offering a poll nobody can vote in.
      if (isNotFoundError(error)) {
        void queryClient.invalidateQueries({ queryKey: quackKeys.lists() })
      }
    },
  })
}
