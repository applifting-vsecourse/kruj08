import { useMutation, useQueryClient } from "@tanstack/react-query"

import { updateProfile } from "@/features/profile/api/updateProfile"

// The hook owns the mutation only — form state belongs to react-hook-form
// in the component, the same way QuackForm does it.
export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      // The name and handle are embedded in the session, in every cached quack
      // and in the profile itself. Refreshing everything is simpler and safer
      // than enumerating other features' query keys here.
      await queryClient.invalidateQueries()
    },
  })
}
