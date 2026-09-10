# Production web app

The `app/` directory is the Next.js App Router entry point deployed by Vercel.

- `page.tsx` renders the public catalogue, create-room CTA, join form, privacy notice, and guest-session status.
- `room/[code]/` renders the waiting room and game client.
- `api/rooms/` exposes authenticated room lifecycle and move route handlers.
- `_lib/supabase-admin.ts` keeps service-role access server-only and centralizes request validation/rate limiting.
- `_lib/observability.ts` emits privacy-conscious structured runtime logs.

Keep platform responsibilities here. Game rules and adapters belong under `games/`; shared contracts belong under `packages/`; database changes belong under `supabase/migrations/`.
