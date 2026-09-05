# Vercel Preview release gate

PLAYROOM deploys from the repository root. Vercel should detect the committed
`bun.lock` file and use Bun for dependency installation. The checked-in
`vercel.json` pins the Next.js framework and the reproducible Bun install/build
commands without embedding any credentials.

## Preview environment

Configure these variables in the Vercel project with the **Preview** target and
values from the hosted development Supabase project (`playroom-dev`):

| Variable | Vercel target | Browser-visible |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Preview | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview | Yes |
| `SUPABASE_URL` | Preview | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview | No |

The two `NEXT_PUBLIC_*` values are intentionally usable by the browser. The
service-role key must exist only in Vercel's server-side environment and must
never be copied into a `NEXT_PUBLIC_*` variable or committed to this repository.

## Import and deploy

1. Import `yoursun0/OnlineGame` into Vercel with the repository root as the
   project root and the `main` branch as the production branch.
2. Confirm the detected framework is **Next.js** and the install command is
   `bun install --frozen-lockfile`.
3. Add the four Preview variables above, then create a Preview deployment.
4. Record the resulting Preview URL in the issue or release notes; do not put
   credentials in this file.

## Preview smoke test

Against the Preview URL, use two independent browser contexts and verify:

1. The catalogue loads and the privacy notice is visible.
2. An anonymous host creates a turn-based Tic-tac-toe room with a `TIK-` code.
3. A second anonymous guest joins; both players become ready; the host starts.
4. A legal move is accepted and synchronized to the other browser.
5. Refreshing either browser recovers the canonical room snapshot.

## Release checks

Before promoting a Preview deployment, confirm:

- `bun run typecheck`, `bun run build`, and the Issue #3 integration test pass.
- Hosted development migrations are applied and `supabase migration list`
  reports no pending migration for the target project.
- RLS is enabled for `rooms`, `room_members`, and `game_events`; anonymous
  clients can use the intended RPC/API paths but cannot write tables directly.
- Required Preview variables are present, and the server-only key is absent from
  client-exposed variables and generated browser assets.

The Vercel project import, environment-variable entry, deployment, and final
Preview URL are account-scoped operations and must be completed by an authorized
Vercel account owner.
