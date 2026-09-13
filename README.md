# PLAYROOM / 玩房

PLAYROOM is an anonymous multiplayer game portal for short, shareable games. The production vertical slice is a two-player Tic-tac-toe room with a public catalogue, short room codes, guest sessions, server-authoritative moves, reconnect recovery, abuse controls, and Vercel/Supabase deployment. Connect Four / 四子棋 uses the same room flow with `CON-` codes once its migration is applied.

Production: [online-game-helic.vercel.app](https://online-game-helic.vercel.app/)

AFK delivery canary: 2026-09 (ai-delivery-control).

## Technology stack

| Area | Choice | Responsibility |
| --- | --- | --- |
| Web framework | Next.js 16 App Router | Pages, route handlers, metadata, deployment entry point |
| Language | TypeScript 7 | Application and shared contracts |
| Runtime/package manager | Bun 1.x | Install, scripts, tests, and Vercel builds |
| UI | React 19 + CSS | Lobby, room, Tic-tac-toe, and Connect Four client UI |
| API | Next.js Route Handlers | Authenticated room commands and snapshots |
| Database/auth | Supabase Postgres + Supabase Auth | Durable room state, event history, anonymous guest sessions |
| Transport | Supabase client and database polling/recovery | Guest auth and canonical room snapshots |
| Hosting | Vercel Hobby, project `helic/online-game` | Preview and Production deployments |
| Testing | Bun test + TypeScript checks + production two-browser smoke test | Regression and release verification |

The browser receives only the Supabase URL and anon key. The service-role key is used by server-side route handlers and must never be exposed to client code.

## Repository map

```text
app/                    Next.js production app, pages, CSS, and API routes
games/                  Game modules and game-specific rules/tests
packages/               Shared game contracts, room protocol, and UI packages
supabase/migrations/    Ordered production database migrations
supabase/config.toml    Local Supabase/auth defaults (including anonymous auth)
tests/                  Bun integration test for room lifecycle and abuse controls
docs/                   Architecture, release, operations, and ADR documentation
prototype/              Disposable original visual prototype
AGENTS.md               Repository workflow and safety instructions
```

Read [docs/REPOSITORY-ARCHITECTURE.md](docs/REPOSITORY-ARCHITECTURE.md) before changing platform/game boundaries. Read the nearest game `AGENTS.md` and `rules.md` before changing a game's rules.

## Local development

Prerequisites: Bun 1.x and access to the hosted development Supabase project. Docker/Supabase local services are optional and must not be introduced without an explicit approval; the normal workflow uses hosted development Supabase.

```powershell
# clone and enter the repository
git clone https://github.com/yoursun0/OnlineGame.git
cd OnlineGame

# install exactly from the lockfile
bun install --frozen-lockfile

# create a local file from the template, then fill development values only
Copy-Item .env.example .env.local

# start Next.js
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). `.env.local` is ignored by Git. Use the hosted development Supabase project for local work; never point local development at production.

Useful checks:

```powershell
bun run typecheck
bun run build

# starts a local Next.js test server automatically when `PLAYROOM_TEST_URL` is not set
bun test
```

The integration tests read `.env.local`, use the hosted development Supabase project, and default to `http://127.0.0.1:3000`. `bun test` starts and stops a local Next.js test server automatically; set `PLAYROOM_TEST_URL` to test a deployed target instead. Test records are temporary and deleted in `afterAll`.

The original static concept can still be previewed without Next.js:

```powershell
uv run python -m http.server 4173 --bind 127.0.0.1
```

Then open [http://127.0.0.1:4173/prototype/index.html](http://127.0.0.1:4173/prototype/index.html). It is local-only and does not write to Supabase.

## Environment variables

Copy [.env.example](.env.example) to `.env.local` and use development values:

| Variable | Browser-visible | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL used by the browser client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key; protected by database/RPC policy, not secrecy |
| `SUPABASE_URL` | No | Server-side Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server-only administrative key for route handlers; never commit or prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | Yes in metadata | Canonical URL used for Open Graph/Twitter metadata |
| `RATE_LIMIT_SALT` | No | Server-only salt for one-way IP hashes; use a different random value per environment |

Do not paste credentials, tokens, service-role keys, or database passwords into issues, chat, commits, screenshots, or documentation. If a secret is exposed, rotate it in the provider immediately.

## Application behavior

1. A browser creates or resumes a Supabase anonymous guest session.
2. The lobby calls `POST /api/rooms` to create a `TIK-XXX` or `CON-XXX` room.
3. A second guest joins with `POST /api/rooms/[code]` and the room becomes ready when both players are ready.
4. The host starts the room. Every move goes through `POST /api/rooms/[code]/move`.
5. Route handlers authenticate the bearer token, validate the move against the game adapter, and persist the canonical state/event with an optimistic version check.
6. `GET /api/rooms/[code]` returns the room snapshot and event history. Refresh/reconnect rehydrates from that canonical state.

The server owns room membership, turn order, versions, expiry, and authorization. A room code is a routing hint, not a capability or secret.

API surface:

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/rooms` | Create a Tic-tac-toe or Connect Four room |
| `GET` | `/api/rooms/[code]` | Read a member's canonical snapshot; supports `?since=<version>` |
| `POST` | `/api/rooms/[code]` | Join, ready/unready, start, leave, or report |
| `POST` | `/api/rooms/[code]/move` | Validate and append one game move |

## Database and migration workflow

Migrations are ordered and append-only. Never edit a migration already applied to a shared environment; add a new migration instead.

```powershell
# inspect the target before changing it
bunx supabase migration list --project-ref <project-ref>

# apply reviewed migrations to the explicit target
bunx supabase db push --project-ref <project-ref> --yes

# verify local and remote history match
bunx supabase migration list --project-ref <project-ref>
```

Use the development project for Preview/local work and the separate production project for Production. See [supabase/migrations/README.md](supabase/migrations/README.md) and [docs/PRODUCTION-HANDOFF.md](docs/PRODUCTION-HANDOFF.md).

## Deployments

Vercel is linked to the repository root. [vercel.json](vercel.json) pins Next.js, Bun installation, and the build command:

```powershell
bun install --frozen-lockfile
bun run typecheck
bun run build

# Preview deployment from the current branch
bunx vercel deploy --scope helic

# Production promotion requires an approved push to main
git push origin main
```

Vercel Production variables are configured in the Vercel project, not in Git. Preview and Production must use different Supabase projects. Production currently uses the Vercel alias above and has no custom domain. See [docs/VERCEL-PREVIEW.md](docs/VERCEL-PREVIEW.md) and [docs/PRODUCTION-HANDOFF.md](docs/PRODUCTION-HANDOFF.md).

## Cost, quota, and abuse controls

There is no webhook implementation in this repository today. Do not add provider webhooks, cron jobs, or external monitoring without documenting their owner, secret, retry behavior, idempotency key, rate limit, and monthly cost budget.

Application-level controls currently enforced:

| Resource/action | Limit | Why it matters |
| --- | ---: | --- |
| Room create | 5 per guest + IP hash per 60 seconds | Prevent room-flooding |
| Room join | 10 per guest + IP hash per 60 seconds | Prevent code probing |
| Move | 12 per guest + IP hash per 10 seconds | Bound API/database writes |
| Room report | 3 per guest + IP hash per hour | Prevent report spam |
| JSON request body | 8 KiB; move body 1 KiB | Bound Vercel/Supabase work per request |
| Display name | 32 characters | Bound stored and rendered input |
| Report reason | 1–280 characters | Bound abuse-report storage |
| Room lifetime | 6 hours after activity; expired lazily on API calls | Bound retained room/event data |
| Snapshot event read | 100 events per request | Bound response size |

Provider quotas change over time. As a planning baseline for the current free tiers, verify the provider dashboards and official docs before launch:

| Provider | Current baseline | Guardrail |
| --- | --- | --- |
| Supabase Free | 500 MB database read-only threshold, 5 GB uncached + 5 GB cached egress, 1 GB Storage, 2M Realtime messages, 200 peak Realtime connections, 500k Edge Function invocations | Alert before 70% database/egress usage; expire rooms; avoid unbounded event payloads |
| Vercel Hobby | 1M function invocations/month, 4 active CPU-hours, 360 GB-hours provisioned memory, 100 GB-hours function duration, 100 deployments/day, 45-minute build limit | Keep handlers short; avoid polling storms; inspect Runtime Logs and usage dashboard |

These figures are not contractual and are documented with links in [docs/OPERATIONS.md](docs/OPERATIONS.md). Free-tier limits can cause throttling or read-only behavior rather than a predictable bill. Set provider spend/usage alerts where the plan supports them.

## Monitoring and incident response

Route handlers emit structured Vercel runtime events:

- `playroom.room.lifecycle`: create, join, ready, start, move, report, leave
- `playroom.api.failure`: route failure with safe route/action metadata

Guest IDs are hashed with `RATE_LIMIT_SALT`; display names, report text, IP addresses, credentials, and raw guest IDs are not logged. Use the room code and approximate timestamp when investigating a report. Follow [docs/OPERATIONS.md](docs/OPERATIONS.md) for rollback, quota response, and support procedures.

## Documentation index

- [Repository architecture](docs/REPOSITORY-ARCHITECTURE.md)
- [Operations and cost controls](docs/OPERATIONS.md)
- [Production handoff](docs/PRODUCTION-HANDOFF.md)
- [Vercel Preview release gate](docs/VERCEL-PREVIEW.md)
- [Architecture decision records](docs/adr/README.md)
- [Migration notes](supabase/migrations/README.md)
- [Tic-tac-toe rules](games/tic-tac-toe/rules.md)
- [Connect Four rules](games/connect-four/rules.md)

## Change and release rules

- Keep `main` releasable; use a short-lived `codex/` or feature branch.
- Read the relevant architecture/rules document before changing a boundary.
- Run the narrowest relevant check, then `bun run typecheck`, `bun run test`, and `bun run build` before release.
- Commit locally before handing work over. Push only with approval.
- Keep secrets and production credentials in provider environment variables.
