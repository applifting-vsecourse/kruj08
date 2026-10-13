import { zodResolver } from "@hookform/resolvers/zod"
import { ListChecks, Loader2, Plus, X } from "lucide-react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { QUACK_MOOD_OPTIONS, quackMoodSchema, type QuackMood } from "@/lib/quack-mood"
import { cn } from "@/lib/utils"

import { useAddQuack } from "@/features/quack/hooks/useAddQuack"
import {
  POLL_OPTION_MAX_LENGTH,
  POLL_OPTIONS_MAX,
  POLL_OPTIONS_MIN,
} from "@/features/quack/lib/poll"

// Mirrors the server-side DTO (MaxLength(280)) so the user is told before
// the request is made — the server still validates independently.
const MAX_LENGTH = 280

// react-hook-form's field arrays want objects, not bare strings, so an
// option is `{ text }` here and flattened to a string on submit.
const pollOptionSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Give this option some text")
    .max(POLL_OPTION_MAX_LENGTH, `Keep it under ${POLL_OPTION_MAX_LENGTH} characters`),
})

const pollSchema = z
  .object({
    options: z.array(pollOptionSchema).min(POLL_OPTIONS_MIN).max(POLL_OPTIONS_MAX),
  })
  // Two options that read the same once trimmed would be one choice shown
  // twice. The message lands on the later duplicate, under its own field.
  .superRefine((poll, ctx) => {
    const seen = new Set<string>()
    poll.options.forEach((option, index) => {
      const text = option.text.trim()
      if (seen.has(text)) {
        ctx.addIssue({
          code: "custom",
          message: "Options must be different from each other",
          path: ["options", index, "text"],
        })
      }
      seen.add(text)
    })
  })

const schema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters`),
  // Optional: a quack without a mood is the default, not a validation error.
  mood: quackMoodSchema.optional(),
  // Optional: absent for a plain quack, present once "Add poll" was clicked.
  poll: pollSchema.optional(),
})

type FormValues = z.infer<typeof schema>

const emptyOptions = () => Array.from({ length: POLL_OPTIONS_MIN }, () => ({ text: "" }))

type QuackFormProps = {
  className?: string
  // The mood from the user's settings, preselected so a post starts with it.
  // Clicking the active mood still clears it for that one post.
  defaultMood?: QuackMood | null
}

export function QuackForm({ className, defaultMood = null }: QuackFormProps) {
  const addQuack = useAddQuack()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { text: "", mood: defaultMood ?? undefined, poll: undefined },
  })

  const text = useWatch({ control: form.control, name: "text" })
  const length = text?.length ?? 0

  // The field array is the source of truth for "is there a poll": setting the
  // parent `poll` value would not update the array's own state, so the poll
  // is added and removed through the array itself.
  const options = useFieldArray({ control: form.control, name: "poll.options" })
  const hasPoll = options.fields.length > 0

  const addPoll = () => options.replace(emptyOptions())
  const removePoll = () => {
    options.replace([])
    // Leave no `{ options: [] }` behind: the schema treats "no poll" as absent.
    form.setValue("poll", undefined)
  }

  const handleSubmit = (values: FormValues) => {
    addQuack.mutate(
      {
        text: values.text,
        mood: values.mood,
        poll: values.poll
          ? { options: values.poll.options.map((option) => option.text) }
          : undefined,
      },
      // Reset to the current default rather than the values captured at mount,
      // so a default changed in Settings is picked up after the next post.
      {
        onSuccess: () => {
          options.replace([])
          form.reset({ text: "", mood: defaultMood ?? undefined, poll: undefined })
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-3", className)}
      >
        {addQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New quack</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  // The text doubles as the poll's question, so the example
                  // changes with the mode. Still an example, not a label.
                  placeholder={hasPoll ? "Ask a question..." : "Quack something..."}
                  disabled={addQuack.isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {hasPoll ? (
          <fieldset
            className="space-y-3"
            disabled={addQuack.isPending}
          >
            <legend className="text-sm font-medium">Poll options</legend>

            {options.fields.map((optionField, index) => (
              <FormField
                key={optionField.id}
                control={form.control}
                name={`poll.options.${index}.text`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Option {index + 1}</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          maxLength={POLL_OPTION_MAX_LENGTH}
                          placeholder={index === 0 ? "Pond buffet" : "Bread stand"}
                          {...field}
                        />
                      </FormControl>
                      {/* The first two options are the minimum, so only the
                          extra ones can be removed. */}
                      {index >= POLL_OPTIONS_MIN ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove option ${index + 1}`}
                          onClick={() => options.remove(index)}
                        >
                          <X className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <div className="flex flex-wrap gap-2">
              {options.fields.length < POLL_OPTIONS_MAX ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => options.append({ text: "" })}
                >
                  <Plus className="size-4" />
                  Add option
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removePoll}
              >
                Remove poll
              </Button>
            </div>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <FormField
              control={form.control}
              name="mood"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mood</FormLabel>
                  <FormControl>
                    {/* Radix reports "" when the active item is clicked again —
                        that is how the user clears the mood. */}
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      size="sm"
                      value={field.value ?? ""}
                      onValueChange={(value) => field.onChange(value === "" ? undefined : value)}
                      disabled={addQuack.isPending}
                      aria-label="Mood"
                    >
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
                  <FormMessage />
                </FormItem>
              )}
            />

            {!hasPoll ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={addQuack.isPending}
                onClick={addPoll}
              >
                <ListChecks className="size-4" />
                Add poll
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                "text-sm",
                length > MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {length}/{MAX_LENGTH}
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={addQuack.isPending}
            >
              {addQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Quack
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
