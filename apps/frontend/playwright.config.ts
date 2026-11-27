import { defineConfig, devices } from "@playwright/test"

import { API_URL, FRONTEND_URL } from "./e2e/env"

const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: "./e2e",
  // A test.only left in by accident would otherwise turn CI green on one test.
  forbidOnly: isCI,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: FRONTEND_URL,
    // What CI uploads when a test fails: a trace to open in `playwright show-trace`.
    trace: isCI ? "retain-on-failure" : "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Locally the dev servers are already running (CLAUDE.md, "The app is already
  // running"), so Playwright finds both URLs answering and starts nothing. In CI
  // nothing runs yet: Playwright starts both, waits for them and stops them at
  // the end. The database must be up, migrated and seeded first either way.
  webServer: [
    {
      command: "pnpm --filter backend start",
      url: `${API_URL}/docs-json`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: "pipe",
    },
    {
      command: "pnpm --filter frontend dev",
      url: FRONTEND_URL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
})
