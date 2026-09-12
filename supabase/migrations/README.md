# Supabase migrations

Store ordered SQL migrations here. Once a migration has been applied to a shared environment, add a new migration for changes instead of editing the old file.

Current order:

1. `20260905000100_initial_playroom_foundation.sql` — enums, rooms, members, events, RLS, and base indexes.
2. `20260905000200_room_lifecycle.sql` — service-role room lifecycle RPCs and Realtime publication.
3. `20260905000300_recovery_abuse_controls.sql` — expiry, rate-limit counters, reports, and recovery-safe RPCs.
4. `20260905000301_fix_move_concurrency.sql` — row-lock move concurrency correction.
5. `20260905000302_nonblocking_room_expiry.sql` — `SKIP LOCKED` expiry cleanup.
6. `20260905000303_optimistic_event_append.sql` — atomic optimistic state/event append.
7. `20260912000100_room_replay.sql` — same-room rematch RPC after a finished game.
8. `20260912000200_tic_tac_toe_cpu_and_random_seats.sql` — solo start versus CPU and random X/O seats.

Apply and verify against an explicit target:

```powershell
bunx supabase migration list --project-ref <project-ref>
bunx supabase db push --project-ref <project-ref> --yes
bunx supabase migration list --project-ref <project-ref>
```

Review RLS and service-role grants after a schema change. Do not run production migrations from a shell with an ambiguous linked project.
