import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Profile } from "@/features/profile/api/profileSchemas"
import type * as updateProfileModule from "@/features/profile/api/updateProfile"
import { updateProfile, UsernameTakenError } from "@/features/profile/api/updateProfile"
import { SettingsForm } from "@/features/profile/components/SettingsForm"

// Only the network call is mocked; the typed error stays real so the form's
// `instanceof` check is exercised.
vi.mock("@/features/profile/api/updateProfile", async (importOriginal) => {
  const actual = await importOriginal<typeof updateProfileModule>()
  return { ...actual, updateProfile: vi.fn() }
})

const updateProfileMock = vi.mocked(updateProfile)

const aProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: "u1",
  name: "Caffeinated Duck",
  username: "CaffeinatedDuck",
  bio: null,
  defaultMood: "happy",
  ...overrides,
})

const renderForm = (profile = aProfile()) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsForm profile={profile} />
    </QueryClientProvider>,
  )
}

const usernameField = () => screen.getByLabelText("Username")
const nameField = () => screen.getByLabelText("Display name")
const saveButton = () => screen.getByRole("button", { name: /save changes/i })
const discardButton = () => screen.getByRole("button", { name: /discard/i })

describe("SettingsForm", () => {
  beforeEach(() => {
    updateProfileMock.mockReset()
  })

  it("starts from the saved profile", () => {
    renderForm(aProfile({ bio: "Quacks about coffee." }))

    expect(nameField()).toHaveValue("Caffeinated Duck")
    expect(usernameField()).toHaveValue("CaffeinatedDuck")
    expect(screen.getByLabelText("Bio")).toHaveValue("Quacks about coffee.")
    expect(screen.getByRole("radio", { name: "Happy" })).toHaveAttribute("aria-checked", "true")
    // nothing has changed yet, so there is nothing to discard
    expect(discardButton()).toBeDisabled()
  })

  it("explains an invalid username without calling the server", async () => {
    renderForm()

    await userEvent.clear(usernameField())
    await userEvent.type(usernameField(), "no spaces")
    await userEvent.click(saveButton())

    expect(
      await screen.findByText("Only letters, digits, dots and underscores"),
    ).toBeInTheDocument()

    await userEvent.clear(usernameField())
    await userEvent.type(usernameField(), "ab")
    await userEvent.click(saveButton())

    expect(await screen.findByText("Use at least 3 characters")).toBeInTheDocument()
    expect(updateProfileMock).not.toHaveBeenCalled()
  })

  it("discards edits and returns to the saved values", async () => {
    renderForm()

    await userEvent.clear(nameField())
    await userEvent.type(nameField(), "Espresso")
    await userEvent.click(screen.getByRole("radio", { name: "Silly" }))
    expect(discardButton()).toBeEnabled()

    await userEvent.click(discardButton())

    expect(nameField()).toHaveValue("Caffeinated Duck")
    expect(screen.getByRole("radio", { name: "Happy" })).toHaveAttribute("aria-checked", "true")
    expect(discardButton()).toBeDisabled()
  })

  it("sends the edited profile, with an empty bio as null", async () => {
    const saved = aProfile({ name: "Espresso", defaultMood: null })
    updateProfileMock.mockResolvedValue(saved)
    renderForm()

    await userEvent.clear(nameField())
    await userEvent.type(nameField(), "Espresso")
    await userEvent.click(screen.getByRole("radio", { name: "None" }))
    await userEvent.click(saveButton())

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledOnce())
    // TanStack Query passes a mutation context as a second argument, so only
    // the payload is asserted on.
    expect(updateProfileMock.mock.calls[0]?.[0]).toEqual({
      name: "Espresso",
      username: "CaffeinatedDuck",
      bio: null,
      defaultMood: null,
    })
    // the saved copy is the new baseline, so the form is clean again
    await waitFor(() => expect(discardButton()).toBeDisabled())
    expect(nameField()).toHaveValue("Espresso")
  })

  it("shows a taken username under the field and keeps what was typed", async () => {
    updateProfileMock.mockRejectedValue(new UsernameTakenError("That username is already taken."))
    renderForm()

    await userEvent.clear(usernameField())
    await userEvent.type(usernameField(), "BreadCritic")
    await userEvent.click(saveButton())

    const message = await screen.findByText("That username is already taken.")
    expect(message).toBeInTheDocument()
    // under the field, not in a banner
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(usernameField()).toHaveValue("BreadCritic")
    expect(usernameField()).toHaveAttribute("aria-invalid", "true")
  })
})
