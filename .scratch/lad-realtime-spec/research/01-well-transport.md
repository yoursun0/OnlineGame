# Can PLAYROOM carry host-simulated well traffic

Date: 2026-09-13
Ticket: `.scratch/lad-realtime-spec/issues/01-well-transport.md`
Scope: transport only. No game implementation.

## Verdict

Yes, on **Supabase Realtime Broadcast** (client WebSocket after `subscribe`), not on the Tic-tac-toe move path, and not on Presence.

The current PLAYROOM stack already has a browser Supabase client and a per-room channel. That channel today only listens for `postgres_changes` and then HTTP-refreshes. It does **not** send Broadcast. Adding Broadcast on a room channel can carry guest Intents and host Snapshots at 10–15 Hz **without writing `public.rooms` / `public.game_events` every frame**.

Hard constraints from official Free-plan limits (production is Free, Seoul):

| Limit | Free | Why it matters for a 2-player well |
| --- | ---: | --- |
| Messages per second (project) | 100 | One 15 Hz Intent + 15 Hz Snapshot room is ~60 msgs/s |
| Presence messages per second | 20 | Presence cannot carry 10–15 Hz |
| Presence `track()` per client / 30 s | 5 | ~0.17 Hz max; channel closes if abused |
| Concurrent connections | 200 | Not the 10–15 Hz bottleneck |
| Broadcast payload | 256 KB | Fine for a well snapshot |
| Monthly Realtime messages | 2 million | ~9 hours of one 15 Hz 2-player well |
| Peak connections (billing quota) | 200 | Same as concurrent connections on Free |

Host simulation must live in a **connected browser** (the room host). Next.js on Vercel is request-scoped HTTP today; even Vercel’s Fluid WebSocket support pins one client to one function instance and drops at max duration, so it cannot be the shared well bus.

## 1. What the current stack actually does

### Move path (authoritative, durable, turn-based)

`POST /api/rooms/[code]/move` (`app/api/rooms/[code]/move/route.ts`):

1. Auth guest, parse JSON with a **1 KiB** body cap.
2. `enforceRateLimit(..., 'move', ..., 12, 10)` → **12 moves / 10 seconds / guest+IP**.
3. Load room snapshot from Postgres.
4. Validate/apply via the game adapter (Tic-tac-toe or Connect Four only).
5. `admin.rpc('append_game_event', { p_state, p_status, p_event_type: 'move', ... })`.
6. Return the full room snapshot JSON.

`append_game_event` (`supabase/migrations/20260905000303_optimistic_event_append.sql`) is a Postgres write every call:

- `UPDATE public.rooms SET state, version = version + 1, status, last_activity_at, expires_at` with optimistic lock on `version`.
- `INSERT public.game_events (room_id, version, guest_id, event_type, payload)`.
- Unique `(room_id, version)` (`supabase/migrations/20260905000100_initial_playroom_foundation.sql`).
- Execute granted to `service_role` only; the browser cannot call it.

So every “move” is: Vercel function invocation → Seoul Postgres WAL (row update + event insert) → HTTP response. That is the opposite of “no Postgres every frame”.

### Client sync path (not a 10–15 Hz bus)

`app/room/[code]/room-client.tsx`:

- Initial and incremental load: `GET /api/rooms/${code}?since=version` (`cache: 'no-store'`).
- Fallback poll: `setInterval(..., supabase ? 5000 : 1500)`.
- Channel: `supabase.channel(`room:${snapshot.room.id}`)` with **only** `postgres_changes` on `rooms`, `room_members`, and `game_events` INSERT. The handler does `refresh()`, not apply-payload.
- Moves: `fetch('/api/rooms/${code}/move', { method: 'POST', ... })`.
- No `.on('broadcast' | 'presence')`, no `channel.send`, no `track()`.

`GET /api/rooms/[code]` rebuilds `{ room, members, events }` from Postgres, with `game_events` **limited to 100 rows** (`app/api/rooms/[code]/route.ts`). OPERATIONS.md documents the same 100-event cap.

Publication: `alter publication supabase_realtime add table public.rooms, public.room_members, public.game_events` (`supabase/migrations/20260905000200_room_lifecycle.sql`). No `REPLICA IDENTITY FULL` in migrations (Postgres default: primary key only).

### Product intent vs shipped Realtime

`PLAN.md`:

- Database owns durable room row, members, snapshot, event log, expiry.
- Realtime is for presence, ready/unready, optimistic hints, low-latency move notifications.
- “On every accepted move, persist a canonical event/snapshot first, then broadcast it.”
- “Realtime Broadcast/Presence remains an optional future optimization, never the source of truth.”
- Reconnect: client asks for the latest **room snapshot and game event sequence**.

Shipped code did the persist half (`append_game_event`) and the `postgres_changes` notify-then-HTTP-refresh half. It never implemented Broadcast/Presence.

### Region, plan, quotas in-repo

- Production Supabase: project `playroom`, ref `xrkwxaxsmnraygwsmdiq`, region **`ap-northeast-2` (Seoul)**, **Free** (`docs/PRODUCTION-HANDOFF.md`).
- OPERATIONS.md (observed 2026-09-10): Free Realtime **2 million messages** and **200 peak connections**; Move **12 / 10 seconds**; 1 KiB move body; 100 events per snapshot; 6-hour room expiry.
- Those monthly numbers match official billing: Free Realtime message quota 2 million, peak connections 200 ([billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Realtime messages usage](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages)).

## 2. Why the Tic-tac-toe move path cannot carry 10–15 Hz

| Constraint | Source | 10–15 Hz impact |
| --- | --- | --- |
| 12 moves / 10 s per guest+IP | `move/route.ts` + OPERATIONS.md | Cap is **1.2 Hz**. 10–15 Hz is 8–12× over; HTTP 429. |
| 1 KiB move body | `readJson(request, 1024)` | Snapshots will not fit if they grow past a tiny intent. |
| Every POST writes `rooms` + `game_events` | `append_game_event` | Violates “no Postgres every frame”; WAL + jsonb rewrite of `rooms.state` at 10–15 Hz. |
| Optimistic `version` lock | `append_game_event` | Host snapshots and guest intents would serialize on one version counter; any overlap → `40001` “room changed”. |
| `postgres_changes` is CDC, not a game bus | room-client + [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) | A write must exist before a notification. Notification only triggers another HTTP GET. |
| Event log cap 100 | GET snapshot `.limit(100)` | 15 Hz × 7 s fills 100 events; reconnect cannot replay a well from `game_events` if every frame is an event. |
| `postgres_changes` scaling | [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [subscribing guide](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes) | Official recommendation: Broadcast for scale. CDC authorizes every event per subscriber, single-threaded, tied to Seoul WAL. |
| Vercel invocation | OPERATIONS.md Hobby 1M invocations; each POST is a function | 15 Hz from one client ≈ 54k invocations/hour. Also extra HK → Vercel → Seoul RTT vs a WebSocket. |
| Game adapter | `move/route.ts` | Only Connect Four / Tic-tac-toe; no well Intent/Snapshot type. |

`postgres_changes` also cannot be “Broadcast in disguise”: official docs say it reads the WAL, and Broadcast from Database still **inserts into `realtime.messages`** (a Postgres write). Client-library Broadcast after `subscribe` does not.

## 3. Can Broadcast / Presence carry it?

### Broadcast — yes, for the hot path

Official positioning ([Realtime](https://supabase.com/docs/guides/realtime), [Broadcast](https://supabase.com/docs/guides/realtime/broadcast)):

- “Send low-latency messages between clients.”
- Use cases explicitly include **game events**, **cursor tracking**, **multiplayer games**.
- Client path after `subscribe`: **WebSocket to Realtime → WebSocket to other clients**. No `public.rooms` / `game_events` write.
- Before `subscribe`, `channel.send` uses **HTTP** to Realtime (not Vercel). Do not use that for 10–15 Hz; subscribe first.
- Default: sender does **not** receive own message unless `broadcast: { self: true }`.
- Payload cap Free: **256 KB** ([limits](https://supabase.com/docs/guides/realtime/limits)).
- Ack is optional; without `ack: true`, `send()` resolves immediately (no delivery guarantee).

Architecture ([Realtime architecture](https://supabase.com/docs/guides/realtime/architecture)):

- Global Elixir cluster. Clients connect to any node.
- If both HK clients land on a nearby Realtime node, Broadcast “only needs to go to that Realtime node … and back down” — **not** through Seoul Postgres.
- `postgres_changes` **does** connect to the database region (Seoul). That is the wrong pipe for 10–15 Hz from HK.

**Broadcast is not durable.** Replay ([Broadcast replay](https://supabase.com/docs/guides/realtime/broadcast#broadcast-replay)):

- Private channels only.
- **Only messages published via Broadcast From the Database**.
- Max **25** messages per request, **72 hours** retention ([limits](https://supabase.com/docs/guides/realtime/limits)).
- Client-to-client Intent/Snapshot frames are **not** replayable. Refresh/reconnect cannot be solved by Broadcast Replay.

Database-originated Broadcast (`realtime.send` / `realtime.broadcast_changes`) **does** insert into `realtime.messages` and is the wrong tool for every frame.

### Presence — no, for Intents/Snapshots

Official Presence ([Presence](https://supabase.com/docs/guides/realtime/presence), [limits](https://supabase.com/docs/guides/realtime/limits), [error codes](https://supabase.com/docs/guides/realtime/error_codes)):

- In-memory CRDT of per-client blobs. Good for “who is here”, ready, host-alive.
- Free: **20 presence messages/s** project-wide.
- **5 Presence calls per client per 30 seconds** on every plan (including Enterprise default).
- `ClientPresenceRateLimitReached`: “Presence is being used for high-frequency updates it is not designed for. Reserve Presence for slow-changing state and **use Broadcast for high-frequency updates such as live cursors**.” Channel is closed.

5 calls / 30 s ≈ 0.17 Hz. A well needs ~10–15 Hz. Presence is disqualified.

### Message accounting (the real Free-plan risk)

Official counting ([Realtime messages usage](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages), [limits](https://supabase.com/docs/guides/realtime/limits)):

- Broadcast: **1 sent + 1 per subscribed client that receives it**. Example: 1 broadcast + 4 listeners = 5 messages.
- Exceeding msgs/s disconnects with `tenant_events` / “Too many messages per second”; `supabase-js` reconnects when load drops.
- Settings: one broadcast to 100 subscribers counts as 100 events toward max events/s.

Worked example, 2-player well, `self: false` (default):

| Stream | Rate | Messages/s |
| --- | ---: | ---: |
| Guest Intent (1 send + 1 host receive) | 15 Hz | 30 |
| Host Snapshot (1 send + 1 guest receive) | 15 Hz | 30 |
| **One room total** | | **~60** |

Free project cap is **100 msgs/s**. One 15 Hz well already uses ~60% of the **entire project**, before lobby `postgres_changes`, heartbeats, or a second room. Two concurrent 15 Hz wells exceed Free.

At 10 Hz the same room is ~40 msgs/s. Still one-busy-room territory on Free.

Monthly 2 million messages: 60 msgs/s × 3600 ≈ 216k/hour → **~9.3 hours** of one 15 Hz 2-player well per month. At 10 Hz ≈ 13.9 hours. Extra lobby CDC and duplicate tabs eat that further. OPERATIONS.md already flags “Realtime connections/messages high → check reconnect loops and duplicate tabs”.

Payload: a compact well snapshot (grid, floors, player x, intent bits, seq) is far under 256 KB. Keep it small: billing is message **count**, egress is separate (5 GB uncached pooled).

### Authorization gap

Repo has **no** `realtime.messages` RLS and never opens `{ config: { private: true } }`. Public channels: any client who knows the topic can send/receive ([concepts](https://supabase.com/docs/guides/realtime/concepts)). Official Broadcast-from-DB and private channels require RLS on `realtime.messages`. A later grilling ticket should lock private topics scoped to room membership, not public `room:<uuid>` Broadcast.

## 4. What still must hit `game_events` / room snapshots

PLAN.md reconnect contract is still the source of truth: **Postgres snapshot + event sequence**, not Realtime packets.

Broadcast Replay cannot replace this (client Broadcast is not stored; replay max 25 and DB-originated only).

GET snapshot today returns `rooms` row + members + ≤100 `game_events`. On refresh, `room-client` already loads this before (re)subscribing.

**Must persist (low Hz, via existing or new checkpoint RPC):**

| Event | Why Postgres |
| --- | --- |
| Room create/join/ready/start/leave/expire | Lobby already durable; host identity, seats, status. |
| Match start (seed, seats, well config) | Reconnect mid-game must know the run. |
| Periodic host checkpoint of canonical well state | Refresh mid-fall (ticket 06) needs `rooms.state`, not the last Broadcast frame. |
| Significant outcomes: floor landed, death, win/lose, finish | Shared outcome + replay/report; unique `game_events.version`. |
| Host-gone / forfeit if that becomes a rule | Durable status change. |

**Must not persist every frame:** Intent bits, interpolating x, falling y, per-tick snapshots.

Checkpoint rate is a grilling item. Bounds from this stack:

- Reuse `append_game_event` and you inherit **12/10s** if it goes through `POST /move`, plus version lock, plus 100-event GET window.
- A dedicated checkpoint RPC can be slower (e.g. 1 Hz, or on floor/death only) and should still bump `rooms.version` / `rooms.state` so GET is canonical.
- 100-event window means checkpoints + outcomes together must stay well under 100 per match, or GET must change (out of this ticket).

`postgres_changes` + 5 s poll can stay as the **lobby/recovery hint** (“a checkpoint landed, HTTP-refresh”), not as the well pipe.

## 5. Recommended split (for a later grilling ticket)

```
Guest browser                    Host browser                      Postgres (Seoul)
     |                                |                                   |
     |  Broadcast intent 10–15 Hz     |                                   |
     |------------------------------->|  simulate well                    |
     |  Broadcast snapshot 10–15 Hz   |                                   |
     |<-------------------------------|                                   |
     |                                |  checkpoint RPC (start /          |
     |                                |  floor / death / finish /         |
     |                                |  periodic)                        |
     |                                |---------------------------------->|
     |  GET snapshot on join/refresh  |                                   |
     |<-------------------------------------------------------------------|
     |  postgres_changes = “refresh”  |                                   |
```

1. **Hot path — Realtime Broadcast**, same room topic or `room:<id>:well`, after `SUBSCRIBED`, WebSocket only.
   - Guest → host: Intent `{ seq, bits, t }`.
   - Host → guests: Snapshot `{ seq, ack, state }`.
   - `self: false`. Do not ack every frame.
   - Do not write Postgres.
2. **Presence — occupancy only** (optional). Ready/host-alive at human Hz. Never well traffic.
3. **Cold path — checkpoint RPC** writing `rooms.state` + `game_events` (start, sparse checkpoints, outcomes). Then existing GET snapshot is reconnect. Optionally Broadcast a “checkpoint” event after persist (PLAN: persist first, then notify).
4. **Keep** Tic-tac-toe/Connect Four on `POST /move` + `postgres_changes` + 5 s poll. Do not retarget that route to 15 Hz.
5. **Do not** put the simulator in a Vercel Route Handler.
6. **Plan quota:** Free 100 msgs/s ≈ **one** active 15 Hz well. Treat Pro (500 msgs/s, 5 million messages) as a launch gate if more than one concurrent well is in scope. OPERATIONS.md already says verify dashboards before a capacity decision.

## 6. HK clients, Seoul DB, Vercel

- Production DB/Realtime project region: **Seoul**. HK → Seoul is extra RTT on **Postgres and HTTP**.
- Client Broadcast can stay on a nearby Realtime node; official architecture says that path is “the time it takes to ping the cluster”, not a DB round trip.
- `postgres_changes` always involves the DB region (WAL). Wrong for 10–15 Hz.
- Vercel Functions: current move route is short HTTP. OPERATIONS.md: keep handlers short; no polling/background loops. Fluid WebSockets (if enabled) pin one connection to one instance and die at max duration; two players can land on different instances. Supabase Realtime is the pub/sub; Vercel is not.

No official HK–Seoul millisecond figure is in-repo or in the cited Supabase pages. Do not treat a guessed RTT as a requirement; treat “avoid Seoul WAL on the hot path” as the requirement.

## Sources

### Repo

- `app/api/rooms/[code]/move/route.ts` — POST move, 1 KiB, 12/10s, `append_game_event`
- `app/room/[code]/room-client.tsx` — 5 s poll, `postgres_changes` refresh, POST move
- `app/api/rooms/[code]/route.ts` — GET snapshot, `game_events` limit 100
- `app/lib/supabase-browser.ts` — anon `createClient`; Realtime available, unused for Broadcast
- `supabase/migrations/20260905000100_initial_playroom_foundation.sql` — `rooms`, `game_events`, unique version
- `supabase/migrations/20260905000200_room_lifecycle.sql` — publication + original `append_game_event`
- `supabase/migrations/20260905000300_recovery_abuse_controls.sql` — `check_room_action_rate_limit`
- `supabase/migrations/20260905000303_optimistic_event_append.sql` — current `append_game_event`
- `PLAN.md` — DB vs Realtime split; Broadcast never source of truth; reconnect via snapshot
- `docs/PRODUCTION-HANDOFF.md` — `ap-northeast-2`, Free
- `docs/OPERATIONS.md` — 12/10s, 1 KiB, 100 events, 2M messages, 200 connections

### Official

- https://supabase.com/docs/guides/realtime
- https://supabase.com/docs/guides/realtime/broadcast
- https://supabase.com/docs/guides/realtime/presence
- https://supabase.com/docs/guides/realtime/limits
- https://supabase.com/docs/guides/realtime/architecture
- https://supabase.com/docs/guides/realtime/postgres-changes
- https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
- https://supabase.com/docs/guides/realtime/error_codes
- https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages
- https://supabase.com/docs/guides/platform/billing-on-supabase
