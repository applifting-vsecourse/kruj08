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

**Never assume the ports.** The app listens where `apps/backend/.env` says: `FRONTEND_URL` is the page to open, `BACKEND_URL` the API origin, `DB_HOST_PORT` the Postgres port. `pnpm env:check` prints all three. The main checkout uses 3050 / 4050 / 5433; a worktree gets its own slot (see below), and hitting 3050 from a worktree exercises the _other_ checkout's code.

Tests and type-checks are the first line of evidence, not the last. **If a change touches the frontend, also verify it in the running app through the browser extension (Claude in Chrome) at `FRONTEND_URL`** — exercise the changed screen the way a user would, including the empty and error states, before calling the work done. Backend-only changes don't need the browser; the unit tests and a passing build are enough there.

Before trusting what the browser shows, confirm the backend watcher actually picked up your edits: `curl -s $BACKEND_URL/api/docs-json` must reflect the new endpoint or parameter, and the matching file under `apps/backend/dist-dev/` must be newer than your edit. The Nest watcher has been seen to miss files that an agent rewrote (the file gets a new inode and the per-file watch stays on the old one) while still reacting to files edited by hand. When that happens, the browser is exercising stale server code and a "it doesn't work" verdict is wrong — restart the dev servers rather than debugging the feature.

### Working in a worktree

A git worktree is a second checkout, so it needs its own `pnpm install` (the pnpm store makes it fast) and then runs the same `pnpm dev`. `scripts/check-env.js` notices it is in a worktree and writes `.env` files for a free **port slot**: slot _n_ is the main ports + 100·_n_ (3150 / 4150 / 5533 for the first worktree), plus a `COMPOSE_PROJECT_NAME` so the Postgres container, network and volume are separate from the main checkout's. Two stacks then run side by side with nothing shared. The slot is chosen once and read back from `.env` afterwards, so it is stable; delete both `.env` files to get a new one.

Everything port-related is derived from those `.env` files — `PORT`, `BACKEND_URL` and `FRONTEND_URL` (CORS and BetterAuth trusted origins), `DATABASE_URL` and `DB_HOST_PORT` (compose mapping), `VITE_PORT` and `VITE_API_URL`. Change them together or not at all: the backend only accepts requests from the exact `FRONTEND_URL` origin, so a lone edit shows up as an opaque CORS error.

Browser cookies are per host, not per port, so a login in one stack logs the other out when both are driven from the same browser profile. Use the built-in browser pane for one of them, or `127.0.0.1` for one and `localhost` for the other.

### Fix what the shadcn CLI generates

Review every file `pnpm dlx shadcn@latest add` writes before committing. Besides the shadows above, the CLI has been seen to import `cn` from a third-party npm package (`import { cn } from "cn"`) and add that package to `package.json` — change the import to `@/lib/utils` and drop the dependency. One `cn` helper in the codebase, not two.

### Model new entities for the next feature, not just this one

When a feature needs new data, ask what it will plausibly grow into and, if the more robust or more scalable shape costs about the same now, choose it now. A migration later costs far more than an extra table or constraint today. Concretely: give a concept that can grow its own table instead of columns on an existing one; let the database enforce an invariant (unique index, composite key, foreign key) instead of application code checking it; keep an id on a row when a constraint needs it, even if it is derivable through a join.

The worked example is the quack poll (`.plans/quack-polls/plan.md`). The first draft hung `PollOption` and `PollVote` straight off `Quack`, because a poll had no attributes of its own. The merged version adds a `Poll` satellite with a 1:1 relation to `Quack`: "has a poll" is a row instead of an inference from existing options, a vote belongs to a poll rather than a post, and closing time or multiple choice have a home without moving data. One join was the whole price. In the same spirit, "one person, one vote" is the primary key `(pollId, userId)` on `poll_vote`, and the composite foreign key `(pollId, optionId) → poll_option(pollId, id)` makes it impossible to store a vote for an option of a different poll — two guarantees no concurrent request can break and no service test has to re-prove.

Don't confuse this with building features nobody asked for: the rule is about the shape of the data, not about adding fields, endpoints or screens on speculation.

### Regenerate the Prisma client after a schema change

`pnpm backend prisma:migrations:run` writes and applies the migration but does not refresh the generated client in `apps/backend/src/generated/`. Run `pnpm backend prisma:generate` right after, or the next `pnpm backend test` fails with "Property X does not exist" against the stale types — a confusing error for a migration that just succeeded.
