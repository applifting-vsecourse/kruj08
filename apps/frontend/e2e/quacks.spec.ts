import { expect, test, type Page } from "@playwright/test"

import { API_URL as API } from "./env"
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

test("nobody can delete someone else's quack", async ({ page }) => {
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
