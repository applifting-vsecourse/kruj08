import { readFileSync } from "node:fs"
import { parseEnv } from "node:util"

// Where this checkout's app listens, read from apps/backend/.env like
// everything else port-related (see CLAUDE.md, "Never assume the ports"). A
// worktree runs on its own port slot, so the main checkout's 3050/4050 would
// test another checkout's code, or not this app at all.
const backendEnv = parseEnv(readFileSync(new URL("../../backend/.env", import.meta.url), "utf8"))

const required = (name: string): string => {
  const value = backendEnv[name]
  if (!value) {
    throw new Error(`${name} is missing in apps/backend/.env. Run \`pnpm env:check\`.`)
  }
  return value
}

export const FRONTEND_URL = required("FRONTEND_URL")
export const API_URL = `${required("BACKEND_URL")}/api`

// The admin the seed creates from the same two variables.
export const SUPERADMIN = {
  email: required("SUPERADMIN_EMAIL"),
  password: required("SUPERADMIN_PASSWORD"),
}
