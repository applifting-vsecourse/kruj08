import { defineConfig, devices } from "@playwright/test"

import { FRONTEND_URL } from "./e2e/env"

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: FRONTEND_URL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
