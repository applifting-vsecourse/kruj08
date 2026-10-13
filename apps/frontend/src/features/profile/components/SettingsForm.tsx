import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { QUACK_MOOD_OPTIONS, quackMoodSchema } from "@/lib/quack-mood"
import { cn } from "@/lib/utils"

import {
  BIO_MAX_LENGTH,
  NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  type Profile,
} from "@/features/profile/api/profileSchemas"
import { UsernameTakenError, type UpdateProfileInput } from "@/features/profile/api/updateProfile"
import { useUpdateProfile } from "@/features/profile/hooks/useUpdateProfile"

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(NAME_MAX_LENGTH, `Keep it under ${NAME_MAX_LENGTH} characters`),
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN_LENGTH, `Use at least ${USERNAME_MIN_LENGTH} characters`)
    .max(USERNAME_MAX_LENGTH, `Use at most ${USERNAME_MAX_LENGTH} characters`)
    .regex(USERNAME_PATTERN, "Only letters, digits, dots and underscores"),
  // The textarea always holds a string; "" becomes null on the way out.
  bio: z.string().trim().max(BIO_MAX_LENGTH, `Keep it under ${BIO_MAX_LENGTH} characters`),
  defaultMood: quackMoodSchema.nullable(),
})

type FormValues = z.infer<typeof schema>

// Radix needs a non-empty value for the selected item, and "no mood" is a real
// choice here, so it gets its own item instead of "deselect to clear".
const NO_MOOD = "none"

const toFormValues = (profile: Profile): FormValues => ({
  name: profile.name,
  username: profile.username,
  bio: profile.bio ?? "",
  defaultMood: profile.defaultMood,
})

const toInput = (values: FormValues): UpdateProfileInput => ({
  name: values.name,
  username: values.username,
  bio: values.bio === "" ? null : values.bio,
  defaultMood: values.defaultMood,
})

type SettingsFormProps = {
  // The saved profile the form starts from and that "Discard" returns to.
  profile: Profile
  className?: string
}

export function SettingsForm({ profile, className }: SettingsFormProps) {
  const updateProfile = useUpdateProfile()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(profile),
  })

  const bio = useWatch({ control: form.control, name: "bio" })
  const bioLength = bio?.length ?? 0
  const { isDirty } = form.formState

  const handleSubmit = (values: FormValues) => {
    updateProfile.mutate(toInput(values), {
      onSuccess: (saved) => {
        // The server's copy becomes the new baseline: the form is clean again
        // and "Discard" now returns to what was just saved.
        form.reset(toFormValues(saved))
        toast.success("Settings saved")
      },
      onError: (error) => {
        // Shown under the field, with the typed value left in place so the
        // user can adjust it rather than retype it.
        if (error instanceof UsernameTakenError) {
          form.setError("username", { type: "server", message: error.message })
        }
      },
    })
  }

  const handleDiscard = () => {
    form.reset()
    updateProfile.reset()
  }

  // A taken username is reported at the field; everything else in a banner.
  const bannerError =
    updateProfile.error && !(updateProfile.error instanceof UsernameTakenError)
      ? updateProfile.error
      : null

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-6", className)}
      >
        {bannerError ? (
          <Alert variant="destructive">
            <AlertDescription>{bannerError.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
                  disabled={updateProfile.isPending}
                  {...field}
                />
              </FormControl>
              <FormDescription>Shown next to your quacks.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input
                  autoComplete="username"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={updateProfile.isPending}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH} characters: letters, digits, dots and
                underscores. People find you as @{field.value || "username"}.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-baseline justify-between gap-3">
                <FormLabel>Bio</FormLabel>
                <span
                  className={cn(
                    "text-sm",
                    bioLength > BIO_MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {bioLength}/{BIO_MAX_LENGTH}
                </span>
              </div>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="e.g. Quacks mostly about coffee."
                  disabled={updateProfile.isPending}
                  {...field}
                />
              </FormControl>
              <FormDescription>Optional. A sentence or two about you.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultMood"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default mood</FormLabel>
              <FormControl>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={field.value ?? NO_MOOD}
                  // Radix reports "" when the active item is clicked again;
                  // treat that like picking "None" so one item is always active.
                  onValueChange={(value) =>
                    field.onChange(value === "" || value === NO_MOOD ? null : value)
                  }
                  disabled={updateProfile.isPending}
                  aria-label="Default mood"
                >
                  <ToggleGroupItem value={NO_MOOD}>None</ToggleGroupItem>
                  {QUACK_MOOD_OPTIONS.map((option) => (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                    >
                      <span aria-hidden="true">{option.emoji}</span>
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormControl>
              <FormDescription>
                Preselected on the new quack form. You can still change it for each post.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            // Not a submit button: with nothing changed there is nothing to discard.
            disabled={!isDirty || updateProfile.isPending}
          >
            Discard
          </Button>
        </div>
      </form>
    </Form>
  )
}
