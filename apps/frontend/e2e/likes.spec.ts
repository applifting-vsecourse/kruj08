import { expect, test, type Locator, type Page } from "@playwright/test"

import { apiAs } from "./apiAs"
import { signIn } from "./signIn"

// .plans/quack-likes/user-story.md, end to end: the like button, the count
// everyone sees, and that both survive a reload.

// Quacks in the list, without the replies an open thread nests inside them.
const topLevelQuacks = (page: Page) => page.locator("article:not(article article)")

// A toggle button: the name stays "Like…", `aria-pressed` says whether the
// viewer likes the quack, and the count is a number of its own inside it.
const likeButtonOf = (quack: Locator) => quack.getByRole("button", { name: /^like/i }).first()
const count = (n: number) => new RegExp(`(^|\\D)${n}(\\D|$)`)

test("a user likes a quack, everyone sees the count, and the like can be taken back", async ({
  page,
}) => {
  // A quack of its own, so the test changes nothing the seed relies on.
  const text = `E2E likeable ${Date.now()}`
  const author = await apiAs("migrationseason@example.com", "password4")
  const fan = await apiAs("breadcritic@example.com", "password3")
  let id: string | undefined
  try {
    const posted = await author.post("quacks", { data: { text } })
    expect(posted.status()).toBe(201)
    id = ((await posted.json()) as { id: string }).id
    // Someone else likes it first, so the viewer starts from 1, not from 0.
    expect((await fan.put(`quacks/${id}/like`)).status()).toBe(200)

    await signIn(page, "deepduckthoughts@example.com", "password2")
    await page.goto("/quacks")
    const quack = topLevelQuacks(page).filter({ hasText: text })
    const like = likeButtonOf(quack)

    await expect(like).toHaveAttribute("aria-pressed", "false")
    await expect(like).toHaveText(count(1))

    // Scenario 1: like it.
    await like.click()
    await expect(like).toHaveAttribute("aria-pressed", "true")
    await expect(like).toHaveText(count(2))

    // Saved, not just drawn: a reload shows the same.
    await page.reload()
    await expect(like).toHaveAttribute("aria-pressed", "true")
    await expect(like).toHaveText(count(2))

    // Scenario 4: the author sees the same number, and not as their own like.
    const authorsView = (
      (await (await author.get("quacks")).json()) as {
        id: string
        likeCount: number
        likedByMe: boolean
      }[]
    ).find((each) => each.id === id)
    expect(authorsView).toMatchObject({ likeCount: 2, likedByMe: false })

    // Scenario 2: take it back.
    await like.click()
    await expect(like).toHaveAttribute("aria-pressed", "false")
    await expect(like).toHaveText(count(1))
    await page.reload()
    await expect(like).toHaveAttribute("aria-pressed", "false")
    await expect(like).toHaveText(count(1))
  } finally {
    // Leave the feed as it was.
    if (id) await author.delete(`quacks/${id}`)
    await author.dispose()
    await fan.dispose()
  }
})

test("a deleted quack's placeholder offers no like", async ({ page }) => {
  const text = `E2E soon gone ${Date.now()}`
  const author = await apiAs("migrationseason@example.com", "password4")
  const replier = await apiAs("breadcritic@example.com", "password3")
  try {
    const posted = await author.post("quacks", { data: { text } })
    const { id } = (await posted.json()) as { id: string }
    const replied = await replier.post(`quacks/${id}/replies`, {
      data: { text: "Keeps it listed" },
    })
    expect(replied.status()).toBe(201)
    expect((await replier.put(`quacks/${id}/like`)).status()).toBe(200)
    expect((await author.delete(`quacks/${id}`)).status()).toBe(204)

    // Scenario 6: nobody can like it any more, not even past the UI.
    expect((await replier.put(`quacks/${id}/like`)).status()).toBe(404)

    await signIn(page, "deepduckthoughts@example.com", "password2")
    await page.goto("/quacks")
    const placeholder = topLevelQuacks(page)
      .filter({ hasText: "Deleted quack by @MigrationSeason" })
      .first()
    await expect(placeholder).toBeVisible()
    // Its thread is closed, so no reply's button can be counted here.
    await expect(placeholder.getByRole("button", { name: /^like/i })).toHaveCount(0)

    const { id: replyId } = (await replied.json()) as { id: string }
    expect((await replier.delete(`quacks/${replyId}`)).status()).toBe(204)
  } finally {
    await author.dispose()
    await replier.dispose()
  }
})
