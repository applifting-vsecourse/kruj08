export const profileKeys = {
  all: () => ["profile"] as const,
  // There is only ever one profile to fetch: the signed-in user's own.
  me: () => [...profileKeys.all(), "me"] as const,
}
