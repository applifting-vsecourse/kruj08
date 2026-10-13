import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"

import { profileQueryOptions } from "@/features/profile/api/profileQueryOptions"
import { SettingsForm } from "@/features/profile/components/SettingsForm"

export const Route = createFileRoute("/_ProtectedPages/settings")({
  // The form starts from the saved profile, so the page waits for it instead
  // of rendering empty fields that fill in a moment later.
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQueryOptions()),
  component: SettingsPage,
})

function SettingsPage() {
  const { data: profile } = useSuspenseQuery(profileQueryOptions())

  return (
    <>
      <Seo title="Settings" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          How you appear to other ducks, and how a new quack starts.
        </p>

        <SettingsForm
          profile={profile}
          className="mt-8"
        />
      </section>
    </>
  )
}
