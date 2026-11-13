import { useMutation, useQueryClient } from "@tanstack/react-query"

import { addReply } from "@/features/quack/api/addReply"
import { quackKeys } from "@/features/quack/api/quackKeys"

export function useAddReply() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addReply,
    onSuccess: async (_reply, { quackId }) => {
      // The thread shows the new reply; the lists, its new count.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: quackKeys.replies(quackId) }),
        queryClient.invalidateQueries({ queryKey: quackKeys.lists() }),
      ])
    },
  })
}
