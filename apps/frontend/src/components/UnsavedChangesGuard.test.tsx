import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { UnsavedChangesGuard } from "@/components/UnsavedChangesGuard"

// A two-page router: the guarded page links to the other one. Blocking only
// shows up in a real router, so there is no point mocking it.
const renderGuardedPage = (hasUnsavedChanges: boolean) => {
  const rootRoute = createRootRoute({ component: Outlet })
  const guardedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => (
      <>
        <h1>Settings</h1>
        <UnsavedChangesGuard hasUnsavedChanges={hasUnsavedChanges} />
        <Link to="/quacks">Quacks</Link>
      </>
    ),
  })
  const otherRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/quacks",
    component: () => <h1>Quacks</h1>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([guardedRoute, otherRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  render(<RouterProvider router={router} />)
}

describe("UnsavedChangesGuard", () => {
  it("lets navigation through when there is nothing to lose", async () => {
    renderGuardedPage(false)

    await userEvent.click(await screen.findByRole("link", { name: "Quacks" }))

    expect(await screen.findByRole("heading", { name: "Quacks" })).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("asks first and stays on the page when the user keeps editing", async () => {
    renderGuardedPage(true)

    await userEvent.click(await screen.findByRole("link", { name: "Quacks" }))

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("Discard unsaved changes?")

    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }))

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument()
  })

  it("continues the navigation when the user discards the changes", async () => {
    renderGuardedPage(true)

    await userEvent.click(await screen.findByRole("link", { name: "Quacks" }))
    await screen.findByRole("alertdialog")

    await userEvent.click(screen.getByRole("button", { name: "Discard changes" }))

    expect(await screen.findByRole("heading", { name: "Quacks" })).toBeInTheDocument()
  })
})
