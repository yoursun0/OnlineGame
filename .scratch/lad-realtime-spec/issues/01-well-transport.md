# Can Playroom carry host-simulated well traffic

Type: research
Status: open
Blocked by:

## Question

What transport on the current PLAYROOM stack (Next.js on Vercel, Supabase `ap-northeast-2`, HK clients, existing `postgres_changes` + 5s poll + `POST /api/rooms/[code]/move` at 12/10s) can carry **guest Intents** and **host Snapshots** at about 10–15 Hz without writing Postgres every frame?

Report: (1) why the Tic-tac-toe move path cannot; (2) whether Supabase Realtime Broadcast/Presence can, with quota numbers from official docs; (3) what still must hit `game_events` / room snapshots for reconnect; (4) a recommended split (Broadcast vs checkpoint RPC) a later grilling ticket can lock.
