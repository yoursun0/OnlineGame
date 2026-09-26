# PLAYROOM operations runbook

This document is the day-two guide for maintaining the hosted development and production environments. It describes the controls implemented in the repository; provider quotas and dashboard labels can change, so verify them before a launch or capacity decision.

## Environments

| Environment | Supabase | Vercel target | Purpose |
| --- | --- | --- | --- |
| Development | Hosted development project | Local development and Preview | Feature work and integration tests |
| Production | Separate `playroom` project, Seoul (`ap-northeast-2`), free plan | `helic/online-game` Production | Public launch |

Never put production credentials in `.env.local`, Preview, a pull request, or a commit. Preview must use the development Supabase project. The production project is `xrkwxaxsmnraygwsmdiq`; record changes to this mapping in the handoff notes, not in secret-bearing files.

## Daily health check

1. Open the public Vercel URL and confirm the catalogue, guest-session status, and privacy notice.
2. Use two independent browser contexts to create/join a `TIK-` room, ready both players, start, make a move, and reload one browser.
3. In Vercel Runtime Logs, look for `playroom.api.failure` spikes and confirm lifecycle events are being emitted without personal data.
4. In Supabase, review database size, egress, Auth anonymous sign-in rate, Realtime messages/connections, and failed API requests.
5. Confirm the latest main deployment is Ready before announcing a release.

## Application guardrails

These limits are enforced in route handlers and the `room_action_rate_limits` table:

| Action | Limit | Window |
| --- | ---: | ---: |
| Create room | 5 per IP hash and 5 per guest | 1 hour, with 20 seconds between creates |
| Open rooms, site-wide | 40 non-expired (`open`, `playing`, `finished`) | Checked before insert |
| Start, replay, rematch, next hand | 10 per human member of that room | 1 hour, with 5 seconds between deals |
| Join room | 10 per guest + hashed IP | 60 seconds |
| Move | 12 per guest + hashed IP | 10 seconds |
| Report room | 3 per guest + hashed IP | 1 hour |

The create quota is enforced for the hashed IP and the guest id separately, so rotating anonymous sessions from one address does not reset it. Start and rematch use the human member, not the seat number, because 打天九 shuffles seats at start. Over-limit responses are HTTP 429 with `The server is busy. Please try again later.` The lobby and room show that as「伺服器忙，請稍後再試。」and do not retry the command on their own.

Additional bounds are an 8 KiB JSON body limit, a 1 KiB move body limit, 32-character display names, 280-character report reasons, and 100 events returned per snapshot. The API returns HTTP 413 for an oversized payload.

Idle rooms expire 15 minutes after the last join, ready change, move, start, replay, or visible-tab heartbeat. `expire_idle_rooms` runs inside those commands and inside the site-wide cap check, using `FOR UPDATE SKIP LOCKED`. A room snapshot does not sweep and does not write. The heartbeat marks that one room expired when it is already idle. Expired rows drop out of the cap of 40. If traffic is low, other idle rows wait for the next create or room command.

A visible room tab polls the snapshot every 5 seconds and subscribes to that room's Realtime changes. Hiding the tab stops the poll, unsubscribes that channel, and stops the heartbeat. An in-flight snapshot is allowed to finish. Coming back runs one refresh and resumes. A downstairs well that is already in progress keeps its presence channel so hiding the tab is not treated as leaving the well.

The route hashes the client address from `x-forwarded-for` (the value Vercel sets), then `x-real-ip`, then `cf-connecting-ip`. The hash is salted with `RATE_LIMIT_SALT`. Prefer `cf-connecting-ip` only after Cloudflare proxies the hostname; until then a client-supplied Cloudflare header must not override Vercel.

## Provider quota and cost controls

The following are planning baselines observed on 2026-09-10. They are not a guarantee; consult the linked provider pages and account dashboards before changing plans.

### Supabase Free

- Database read-only threshold: 500 MB PostgreSQL database size.
- Egress allowance: 5 GB uncached plus 5 GB cached, pooled across database, Auth, Storage, Edge Functions, Realtime, and log drains.
- Storage: 1 GB.
- Realtime: 2 million messages and 200 peak connections.
- Edge Functions: 500,000 invocations.
- Auth: 50,000 monthly active users for the standard MAU category; anonymous sign-ins are separately rate-limited by Auth.

References: [database size](https://supabase.com/docs/guides/platform/database-size), [egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), and [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase).

Operational response:

| Signal | First response | Escalation |
| --- | --- | --- |
| Database >70% of threshold | Inspect `rooms`/`game_events`, confirm expiry, remove only reviewed disposable data | Plan retention/archive or paid capacity before 90% |
| Egress >70% | Check snapshot polling and oversized responses; reduce polling or event history | Add caching/transport changes before limit |
| Realtime connections/messages high | Check reconnect loops and duplicate tabs | Add client backoff or raise plan |
| Auth anonymous sign-ins high | Inspect abuse and IP patterns; do not disable guest play blindly | Add CAPTCHA/edge protection or adjust product flow |

Do not delete production room data as an emergency shortcut without recording the query, scope, and approval. `room_reports` may be needed for support and abuse review.

### Vercel Hobby

The current Hobby documentation lists 1 million function invocations/month, 4 active CPU-hours, 360 GB-hours of provisioned memory, 100 GB-hours of function duration, 100 deployments/day, one concurrent build, and a 45-minute build limit. See [Vercel Hobby](https://vercel.com/docs/plans/hobby) and [Vercel Function limits](https://vercel.com/docs/functions/limitations).

Operational response:

- Keep route handlers short and avoid adding polling or background loops without a budget.
- Treat repeated 5xx responses, long durations, and invocation spikes as an incident.
- Pause noisy deployments and roll back to the last Ready deployment while investigating.
- Review Vercel usage before adding analytics, webhook consumers, or scheduled jobs.

## Webhooks and scheduled work

PLAYROOM currently has no application webhook endpoint, payment integration, inbound event receiver, or scheduled function. This is intentional: it avoids an unbounded retry/cost path while the portal is small.

If a webhook is added, require all of the following before merging:

1. A documented owner and provider event list.
2. Signature verification using a server-only secret.
3. A small payload limit and strict schema validation.
4. An idempotency key stored with a unique constraint.
5. Bounded retries with exponential backoff and a dead-letter/manual replay path.
6. A per-source rate limit and a monthly invocation/cost budget.
7. Structured success/failure logging that excludes payload secrets and personal data.
8. A test fixture and a replay-safe integration test.

Do not use a webhook as a substitute for room expiry. Room cleanup belongs in the database function path unless a separately approved scheduler is needed.

## Secrets and access

- Browser variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and metadata URL. These are not secret, but still must point to the intended environment.
- Server-only variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `RATE_LIMIT_SALT`.
- Store values in Vercel environment targets and the local ignored `.env.local` file.
- Never ask for or record passwords, API keys, OAuth tokens, or service-role keys in chat or Markdown.
- Rotate a key if it appears in a log, screenshot, shell transcript, or commit.

## Release and rollback

Before release:

```powershell
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
```

Review migrations, verify the target project ref, and apply with an explicit `--project-ref`. After deployment, run the two-browser smoke test described in [PRODUCTION-HANDOFF.md](PRODUCTION-HANDOFF.md).

Rollback sequence:

1. Identify the last Ready Vercel deployment and stop promotion.
2. Roll traffic back or redeploy the known-good main commit.
3. Keep database migrations forward-only; never reset or edit an applied migration.
4. Record the deployment ID, room codes/timestamps affected, symptoms, and owner.
5. Add a corrective migration or code fix, test it in development/Preview, then promote again.

## Support checklist

Ask for the room code, approximate time, browser/device, and visible error text. Do not ask users for credentials or tokens. A room code identifies a room for support; it is not a secret and must not be treated as authorization.
