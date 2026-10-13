import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { profileKeys } from "@/features/profile/api/profileKeys"
import { profileSchema } from "@/features/profile/api/profileSchemas"

export const profileQueryOptions = () =>
  queryOptions({
    queryKey: profileKeys.me(),
    queryFn: async () => profileSchema.parse(await api.get("profile").json()),
  })
