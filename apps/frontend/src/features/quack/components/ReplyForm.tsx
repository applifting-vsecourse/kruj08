import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
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
import { Textarea } from "@/components/ui/textarea"
import { isNotFoundError } from "@/lib/api-client"
import { quackMoodSchema } from "@/lib/quack-mood"
import { cn } from "@/lib/utils"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { MoodToggleGroup } from "@/features/quack/components/MoodToggleGroup"
import { useAddReply } from "@/features/quack/hooks/useAddReply"

// The same limit as a quack, mirrored from the server's CreateReplyDto.
const MAX_LENGTH = 280

const schema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters`),
  mood: quackMoodSchema.optional(),
})

type FormValues = z.infer<typeof schema>

const emptyValues: FormValues = { text: "", mood: undefined }

type ReplyFormProps = {
  quackId: string
  // Put the cursor in the text field as the form appears, when the user
  // asked to write rather than to read.
  shouldFocusOnMount?: boolean
  // The quack is a placeholder now: it was deleted while this reply was being
  // written. The text stays for copying, but it can't be sent.
  isQuackDeleted?: boolean
  // Reports whether the form holds a reply that would be lost. The thread
  // asks before collapsing; the route guards navigation.
  onDirtyChange?: (isDirty: boolean) => void
  className?: string
}

export function ReplyForm({
  quackId,
  shouldFocusOnMount = false,
  isQuackDeleted = false,
  onDirtyChange,
  className,
}: ReplyFormProps) {
  const queryClient = useQueryClient()
  const addReply = useAddReply()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  })

  useEffect(() => {
    if (shouldFocusOnMount) form.setFocus("text")
    // Only as the form appears, not whenever the flag changes later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Only a form holding a reply reports, and it takes the report back once
  // the reply is gone: sent, discarded, or unmounted with its thread.
  const { isDirty } = form.formState
  useEffect(() => {
    if (!isDirty) return
    onDirtyChange?.(true)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  const text = useWatch({ control: form.control, name: "text" })
  const length = text?.length ?? 0

  // The server answered 404: the quack went while the reply was written.
  const isQuackGone = isQuackDeleted || isNotFoundError(addReply.error)

  const handleSubmit = (values: FormValues) => {
    addReply.mutate(
      { quackId, text: values.text, mood: values.mood },
      { onSuccess: () => form.reset(emptyValues) },
    )
  }

  const discard = () => {
    form.reset(emptyValues)
    addReply.reset()
    // Only now does the list learn the quack is gone: refetched earlier, a
    // quack without other replies would leave the list, and this form and
    // the text in it with it.
    void queryClient.invalidateQueries({ queryKey: quackKeys.lists() })
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-3", className)}
      >
        {isQuackGone ? (
          <Alert variant="destructive">
            <AlertDescription>
              This quack was deleted in the meantime, so your reply wasn&apos;t posted. Copy it if
              you want to keep it.
            </AlertDescription>
          </Alert>
        ) : addReply.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addReply.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your reply</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Was it at least good bread?"
                  disabled={addReply.isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-wrap items-end justify-between gap-3">
          <FormField
            control={form.control}
            name="mood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mood</FormLabel>
                <FormControl>
                  <MoodToggleGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={addReply.isPending || isQuackGone}
                    aria-label="Mood"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center gap-3">
            <span
              className={cn(
                "text-sm",
                length > MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {length}/{MAX_LENGTH}
            </span>
            {isQuackGone ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={discard}
              >
                Discard reply
              </Button>
            ) : (
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={addReply.isPending}
              >
                {addReply.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Reply
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  )
}
