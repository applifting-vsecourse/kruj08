import { useMutation, useQueryClient } from "@tanstack/react-query"

import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { ListedQuack } from "@/features/quack/api/quackSchemas"

export function useDeleteQuack() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteQuack,
    onSuccess: (_data, { quackId }) => {
      // Drop the quack from every cached list and thread (full feed, any
      // active search, any open thread if it was a reply) so it is gone the
      // moment the dialog closes. A quack with replies stays: the refetch
      // turns it into a placeholder, and removing it first would make its
      // thread blink out and back.
      queryClient.setQueriesData<Pick<ListedQuack, "id" | "replyCount">[]>(
        { queryKey: quackKeys.all() },
        (quacks) => quacks?.filter((cached) => cached.id !== quackId || cached.replyCount > 0),
      )
      // …then refetch anyway, so lists, counts and threads are what the
      // server says again.
      void queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })
}
