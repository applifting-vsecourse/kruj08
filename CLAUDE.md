# Quacker — starter template

Full-stack teaching template: pnpm monorepo with two apps.

- `apps/backend` — NestJS + Prisma + Postgres. Auth: BetterAuth (mounted at `/api/auth/*`, treat as a black box). API docs: Swagger at `/api/docs`.
- `apps/frontend` — React + Vite + TanStack Router/Query, Tailwind + shadcn/ui, `ky` + `zod` API client. Feature folders under `src/features/`.

The worked example is the quack feed: `Quack` model → seed → repository → service → `GET`/`POST /api/quacks` (DTO-validated, author taken from the session) → zod schema → TanStack Query → list page + post form. Copy its pattern for new features.

**Before writing or changing any UI, read [`DESIGN.md`](DESIGN.md).** It is a contract, not a suggestion — it exists to stop generated screens drifting into generic nested cards.

## Commands

- `pnpm dev` — everything: env files, Postgres (Docker), migrate, seed, both dev servers
- `pnpm check-all` — lint + type-check + tests + build (same as CI)
- `pnpm backend test` / `pnpm frontend test:ci` — unit tests
- `pnpm backend prisma:migrations:run` — create/apply migrations after schema changes

## Conventions

Deliberately sparse — this file grows as the team learns what it expects from generated code. Add rules here when you find yourself repeating the same review feedback.

### Commit messages are semantic

Every commit subject follows `<type>(<optional-scope>): <short description in present tense>`, for example `feat(api): change client response format`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`. Scope is the part of the repo touched (`api`, `web`, `quack`, `auth`, …) and is left out when the change is cross-cutting. The description is lowercase, imperative, no trailing period. One concern per commit; the body explains why when the subject can't.

### UI controls come from the kit

Need a control that isn't in `src/components/ui/`? Add it with `pnpm dlx shadcn@latest add <name>` — don't hand-roll one in a feature folder, even where a native input would do the job. One accessibility implementation to reason about beats a per-control judgement call.

The CLI puts `shadow-xs`/`shadow-sm` on inputs, textareas and cards. [`DESIGN.md`](DESIGN.md) keeps shadows for things that genuinely float — dialogs, dropdowns, toasts. Strip them.

### The app is already running

Assume the dev servers are up. If something is listening on the app's ports, that is this application: use it rather than starting a second instance. Restarting it (`pnpm dev`) is fine when the running code is stale.

Tests and type-checks are the first line of evidence, not the last. **If a change touches the frontend, also verify it in the running app through the browser extension (Claude in Chrome) at `http://localhost:3050/`** — exercise the changed screen the way a user would, including the empty and error states, before calling the work done. Backend-only changes don't need the browser; the unit tests and a passing build are enough there.

Before trusting what the browser shows, confirm the backend watcher actually picked up your edits: `curl -s http://localhost:4050/api/docs-json` must reflect the new endpoint or parameter, and the matching file under `apps/backend/dist-dev/` must be newer than your edit. The Nest watcher has been seen to miss files that an agent rewrote (the file gets a new inode and the per-file watch stays on the old one) while still reacting to files edited by hand. When that happens, the browser is exercising stale server code and a "it doesn't work" verdict is wrong — restart the dev servers rather than debugging the feature.

### Fix what the shadcn CLI generates

Review every file `pnpm dlx shadcn@latest add` writes before committing. Besides the shadows above, the CLI has been seen to import `cn` from a third-party npm package (`import { cn } from "cn"`) and add that package to `package.json` — change the import to `@/lib/utils` and drop the dependency. One `cn` helper in the codebase, not two.

### Regenerate the Prisma client after a schema change

`pnpm backend prisma:migrations:run` writes and applies the migration but does not refresh the generated client in `apps/backend/src/generated/`. Run `pnpm backend prisma:generate` right after, or the next `pnpm backend test` fails with "Property X does not exist" against the stale types — a confusing error for a migration that just succeeded.
