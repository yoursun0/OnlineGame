# Can Playroom carry host-simulated well traffic

Type: research
Status: resolved
Blocked by:

## Question

What transport on the current PLAYROOM stack (Next.js on Vercel, Supabase `ap-northeast-2`, HK clients, existing `postgres_changes` + 5s poll + `POST /api/rooms/[code]/move` at 12/10s) can carry **guest Intents** and **host Snapshots** at about 10–15 Hz without writing Postgres every frame?

Report: (1) why the Tic-tac-toe move path cannot; (2) whether Supabase Realtime Broadcast/Presence can, with quota numbers from official docs; (3) what still must hit `game_events` / room snapshots for reconnect; (4) a recommended split (Broadcast vs checkpoint RPC) a later grilling ticket can lock.

## Answer

**Broadcast, not `POST /move`, not Presence.** Guest Intents and host Snapshots at 10–15 Hz belong on Supabase Realtime **Broadcast** (client WebSocket after `subscribe`). That path does not write `public.rooms` / `game_events`. Presence is capped at 5 `track()` / 30 s / client and is disqualified. The Tic-tac-toe move path cannot: 12/10s (~1.2 Hz), 1 KiB body, `append_game_event` WAL + version lock, and `postgres_changes` only triggers another HTTP GET.

Free-plan quotas (production): **100 msgs/s**, 200 connections, 256 KB Broadcast payload, 2 million messages/month. One 15 Hz 2-player well is ~60 msgs/s (1 send + 1 receive each way) — about one concurrent well on Free. Reconnect still needs sparse Postgres checkpoints (`rooms.state` + `game_events`); Broadcast Replay is max 25 and DB-originated only. Host sim stays in the host browser, not a Vercel function.

Full write-up: `.scratch/lad-realtime-spec/research/01-well-transport.md`
