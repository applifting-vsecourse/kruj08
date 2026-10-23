import { useMutation, useQueryClient } from "@tanstack/react-query"

import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"

export function useDeleteQuack() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteQuack,
    onSuccess: (_data, { quackId }) => {
      // Drop the quack from every cached list (full feed and any active
      // search) so it is gone the moment the dialog closes…
      queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
        quacks?.filter((cached) => cached.id !== quackId),
      )
      // …then refetch anyway, so the feed is what the server says again.
      void queryClient.invalidateQueries({ queryKey: quackKeys.lists() })
    },
  })
}
