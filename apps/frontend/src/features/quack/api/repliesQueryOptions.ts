import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { repliesSchema } from "@/features/quack/api/quackSchemas"

// The live replies under a quack, oldest first. Fetched only once the thread
// is opened; the list itself carries just the count.
export const repliesQueryOptions = (quackId: string) =>
  queryOptions({
    queryKey: quackKeys.replies(quackId),
    queryFn: async () => repliesSchema.parse(await api.get(`quacks/${quackId}/replies`).json()),
  })
