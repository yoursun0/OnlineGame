# PLAYROOM production handoff

This checklist is the controlled launch gate for the production Supabase and
Vercel environments. The development project remains the target for local work
and Preview deployments.

## Account-scoped items

These steps require the authorized Supabase/Vercel account owner and must be
completed with the final production project and domain choices:

- [ ] Create a separate Supabase production project; record its project ref,
  region, and plan without putting credentials in this repository.
- [ ] Configure the production Vercel environment with
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, and `RATE_LIMIT_SALT`.
  The two `NEXT_PUBLIC_*` values are browser-visible; the service-role key and
  salt are server-only.
- [ ] Choose and attach the production custom domain in Vercel, then verify
  HTTPS and the canonical share URL.

## Migration and verification

Review the ordered files under `supabase/migrations/` before applying them to
the production project. Use a separate checkout or an explicit `--project-ref`
target so the linked development project is not changed accidentally:

```powershell
bun x supabase migration list --project-ref <production-project-ref>
bun x supabase db push --project-ref <production-project-ref>
bun x supabase migration list --project-ref <production-project-ref>
```

Verify RLS is enabled for `rooms`, `room_members`, `game_events`,
`room_action_rate_limits`, and `room_reports`, and verify the API can create,
join, start, move, reconnect, report, and leave a room. Do not edit an applied
migration; add a new migration for any correction.

## Deployment and smoke test

- [ ] Confirm the Vercel Production target uses the `main` branch.
- [ ] Run `bun install --frozen-lockfile`, `bun run typecheck`, `bun run build`,
  and the room lifecycle test before promotion.
- [ ] Verify the production deployment from `main` with two independent browser
  contexts: catalogue/privacy notice, create/join, ready/start, synchronized
  move, and refresh/reconnect.
- [ ] Check the page source contains no service-role key.
- [ ] Verify the home page and room URL expose the PLAYROOM title, description,
  Open Graph metadata, and Twitter summary metadata. The privacy notice remains
  visible in the footer: operational logs and abuse controls may apply.

## Monitoring and support

API routes emit structured JSON events to the hosting runtime logs:
`playroom.room.lifecycle` for create/join/ready/start/leave/report/move and
`playroom.api.failure` for route failures. Guest IDs are hashed and display
names, report text, IP addresses, and credentials are not logged. Use Vercel
Runtime Logs as the baseline error monitor; add a dedicated provider only after
an explicit provider/retention decision.

For support, capture the room code, approximate timestamp, browser, and the
visible error. Never request a guest password or secret. Room state is
server-authoritative and migrations are forward-only.

## Rollback

1. Pause promotion and keep the last known-good Vercel deployment identified.
2. Roll Vercel traffic back to that deployment (or redeploy the last known-good
   `main` commit).
3. Keep database changes forward-compatible; do not reset or edit an applied
   production migration. Ship a corrective migration after review.
4. Record the incident, affected room codes/timestamps, and the support owner.
