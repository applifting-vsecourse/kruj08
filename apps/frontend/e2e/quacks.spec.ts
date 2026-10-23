import { expect, test, type Page } from "@playwright/test"

import { apiAs } from "./apiAs"
import { API_URL as API, SUPERADMIN } from "./env"
import { signIn } from "./signIn"

async function findQuackNotBy(page: Page, username: string): Promise<{ id: string }> {
  const response = await page.request.get(`${API}/quacks`)
  const quacks = (await response.json()) as { id: string; user: { username: string } }[]
  return quacks.find((quack) => quack.user.username !== username)!
}

test("author can post a quack and delete it", async ({ page }) => {
  const text = `E2E quack ${Date.now()}`
  await signIn(page, "caffeinatedduck@example.com", "password1")
  await page.goto("/quacks")

  await page.getByLabel("New quack").fill(text)
  await page.getByRole("button", { name: "Quack", exact: true }).click()
  const quack = page.getByRole("article").filter({ hasText: text })
  await expect(quack).toBeVisible()

  // Delete sits in the "⋯" menu and asks for confirmation in an alert dialog.
  await quack.getByRole("button", { name: "Quack actions" }).click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
  await expect(quack).toHaveCount(0)
})

test("the Mine tab lists only your own quacks", async ({ page }) => {
  await signIn(page, "caffeinatedduck@example.com", "password1")
  await page.goto("/quacks")

  const quacks = page.getByRole("article")
  const notMine = quacks.filter({ hasNotText: "@CaffeinatedDuck" })
  // All has to show someone else's quack, or the filter below proves nothing.
  await expect(notMine.first()).toBeVisible()

  await page.getByRole("tab", { name: "Mine" }).click()
  await expect(page).toHaveURL(/author=me/)
  // Mine starts empty while it loads, so wait for the filtered list itself —
  // otherwise the count below would pass against the loading state.
  await expect(quacks.filter({ hasText: "@CaffeinatedDuck" }).first()).toBeVisible()
  await expect(notMine).toHaveCount(0)
})

// An admin can (see below); everyone else can't.
test("a regular user can't delete someone else's quack", async ({ page }) => {
  await signIn(page, "deepduckthoughts@example.com", "password2")
  await page.goto("/quacks")

  const othersQuack = page.getByRole("article").filter({ hasNotText: "@DeepDuckThoughts" }).first()
  // Same trap: no menu on a quack that hasn't rendered yet proves nothing.
  await expect(othersQuack).toBeVisible()
  await expect(othersQuack.getByRole("button", { name: "Quack actions" })).toHaveCount(0)

  // The menu is hidden. Now skip the UI and ask the server directly.
  const notMine = await findQuackNotBy(page, "DeepDuckThoughts")
  const response = await page.request.delete(`${API}/quacks/${notMine.id}`)
  expect(response.status()).toBe(403)
})

test("an admin deletes someone else's quack; everyone else still gets 403", async ({ page }) => {
  // A quack of its own, so the test removes nothing the seed or another
  // test relies on.
  const text = `E2E quackery ${Date.now()}`
  const author = await apiAs("migrationseason@example.com", "password4")
  const bystander = await apiAs("deepduckthoughts@example.com", "password2")
  try {
    const posted = await author.post("quacks", { data: { text } })
    expect(posted.status()).toBe(201)
    const { id } = (await posted.json()) as { id: string }

    // Someone who is neither its author nor an admin still can't, not even
    // past the UI.
    expect((await bystander.delete(`quacks/${id}`)).status()).toBe(403)

    await signIn(page, SUPERADMIN.email, SUPERADMIN.password)
    await page.goto("/quacks")
    const quack = page.getByRole("article").filter({ hasText: text })
    await quack.getByRole("button", { name: "Quack actions" }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()

    const dialog = page.getByRole("alertdialog")
    // The dialog names whose quack it is, and won't go without a reason.
    await expect(dialog).toContainText("The quack by Migration Season (@MigrationSeason)")
    await dialog.getByRole("button", { name: "Delete" }).click()
    await expect(dialog.getByText("Write why you're deleting this quack")).toBeVisible()

    await dialog.getByLabel("Reason").fill("Sells quackery, won't take it down.")
    await dialog.getByRole("button", { name: "Delete" }).click()
    await expect(page.getByText("Quack deleted")).toBeVisible()
    await expect(quack).toHaveCount(0)

    // Gone for its author too, not just from the admin's screen.
    const authorsFeed = (await (await author.get("quacks")).json()) as { id: string }[]
    expect(authorsFeed.map((each) => each.id)).not.toContain(id)
  } finally {
    await author.dispose()
    await bystander.dispose()
  }
})

test("the admin sees Delete on every quack", async ({ page }) => {
  await signIn(page, SUPERADMIN.email, SUPERADMIN.password)
  await page.goto("/quacks")

  const quacks = page.getByRole("article")
  // Other people's quacks have to be there, or "every" proves nothing.
  await expect(quacks.filter({ hasNotText: "@superadmin" }).first()).toBeVisible()

  for (const quack of await quacks.all()) {
    await quack.getByRole("button", { name: "Quack actions" }).click()
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menuitem")).toHaveCount(0)
  }
})
