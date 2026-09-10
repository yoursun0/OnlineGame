# PLAYROOM production handoff

This is the record of the current public launch configuration. Secret values are intentionally omitted.

## Current production configuration

- Supabase project: `playroom`
- Supabase project ref: `xrkwxaxsmnraygwsmdiq`
- Supabase region: `ap-northeast-2` (Seoul)
- Supabase plan: Free
- Vercel project: `helic/online-game`
- Production URL: [https://online-game-helic.vercel.app](https://online-game-helic.vercel.app)
- Custom domain: none; the Vercel alias is the canonical public URL for now
- Vercel SSO Deployment Protection: disabled so the public URL is reachable without a Vercel account

## Completed launch gate

- [x] Separate production Supabase project created and selected.
- [x] Anonymous sign-ins enabled in the production Supabase Auth configuration.
- [x] All six ordered migrations reviewed, applied, and verified against production.
- [x] Vercel Production variables configured: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, and `RATE_LIMIT_SALT`.
- [x] Main-branch Production deployment verified Ready.
- [x] Share metadata and the required privacy notice verified in the public page.
- [x] Structured room-lifecycle/API-failure runtime logging enabled.
- [x] Rollback and support steps recorded below.

## Migration and verification

Review the ordered files under `supabase/migrations/` before applying them. Always use the explicit production project ref:

```powershell
bunx supabase migration list --project-ref xrkwxaxsmnraygwsmdiq
bunx supabase db push --project-ref xrkwxaxsmnraygwsmdiq --yes
bunx supabase migration list --project-ref xrkwxaxsmnraygwsmdiq
```

Do not edit an applied migration. Add a new migration for every correction.

## Production smoke test

Use two independent browser contexts:

1. Open the public URL and confirm the catalogue, `GUEST SESSION READY`, share metadata, and privacy notice.
2. Create a room with a `TIK-` code; join it from the second browser.
3. Mark both players ready, start the game, make legal moves, and confirm both browsers converge.
4. Reload one browser and confirm the room snapshot, version, players, and moves recover.
5. Leave the room and confirm the host room is expired/cleaned up.

The production UAT performed on 2026-09-10 passed this flow with room `TIK-V89`.

## Monitoring and support

API routes emit structured JSON events to Vercel Runtime Logs:

- `playroom.room.lifecycle` for create/join/ready/start/move/report/leave.
- `playroom.api.failure` for route failures.

Guest IDs are hashed. Display names, report text, IP addresses, credentials, and raw guest IDs are not logged. Use the room code, approximate timestamp, browser, and visible error for support. Never request a guest password or secret.

See [OPERATIONS.md](OPERATIONS.md) for quotas, cost controls, webhook policy, and incident response.

## Rollback

1. Stop promotion and identify the last Ready Vercel deployment.
2. Roll Vercel traffic back or redeploy that known-good `main` commit.
3. Keep database changes forward-compatible; do not reset or edit an applied production migration.
4. Record affected room codes/timestamps, deployment ID, symptoms, and owner.
5. Test the corrective migration/code in development and Preview before re-promoting.
