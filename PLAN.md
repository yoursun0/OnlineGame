# PLAYROOM — anonymous online game portal

> Working name: **PLAYROOM** / **玩房**  
> Current status: production Tic-tac-toe vertical slice deployed on Vercel with a separate Supabase production project. `prototype/` remains a disposable visual reference.

## 1. Product thesis

PLAYROOM is a frictionless lobby for short multiplayer games. A visitor should be able to reach a playable screen in under 30 seconds:

1. Pick a game.
2. Use the selected game's supported mode (`turn-based` for Tic-tac-toe; future games may support `real-time`).
3. Create a room or enter a room code.
4. Share the short room code/link when creating a room, then start.

No account, email, password, or profile setup is required. A temporary guest identity is generated in the browser and can be discarded when the session ends.

### Game mode definitions

- **Turn-based:** the game state changes in discrete turns. Player A makes a move, then player B, then player C, and the sequence continues.
- **Real-time:** multiple players can act at the same time. The game state updates continuously based on all players' actions, such as ping-pong or Tetris.

Tic-tac-toe is a **turn-based-only** game. Live synchronization between browsers does not make a game real-time; the gameplay rules determine the mode.

## 2. First release scope

### Must have

- Responsive public game catalogue.
- Anonymous create-room and join-room flows.
- Game-specific short room code, e.g. tic-tac-toe `TIK-7Q4` or 小朋友落樓梯 `LAD-3M8`.
- Game metadata: player count, estimated duration, mode support.
- Real-time room presence: host, guests, ready state, disconnect state.
- Turn-based state recovery after refresh/reconnect.
- Tic-tac-toe as the first complete game.
- Chinese game card for 小朋友落樓梯 as the next game placeholder.
- Report/leave room action and basic rate limiting.

### Explicitly out of scope for v1

- Accounts, social graph, permanent ratings, chat history.
- Voice/video chat.
- Money, prizes, gambling, or user-generated game code.
- Global matchmaking across every game.
- Moderation automation beyond room reporting and abuse throttles.

## 3. Suggested information architecture

```text
/                         Public game catalogue / lobby radar
/room/[code]              Waiting room + presence + game start
/room/[code]/play         Game shell (game-specific UI inside)
/how-it-works             Optional lightweight help page
```

The prototype in `prototype/index.html` is intentionally a single route so the flow can be reviewed quickly before wiring a framework.

## 4. Core user flows

### Create a room

Visitor selects a game → sees or selects one of that game's supported modes → enters a display name (optional, defaults to a playful guest name) → creates room → sees code + share button → waits for another guest → starts when both are ready. Tic-tac-toe always uses `turn-based` mode.

### Join a room

Visitor enters a room code → server validates that the room is open → temporary guest identity joins → visitor sees game, mode, host and current players → presses ready → host starts.

### Reconnect

The browser stores a short-lived `guest_session_id` in session storage. On reconnect, the client asks Supabase for the latest room snapshot and game event sequence. The server remains authoritative; clients never decide whether a move is valid.

## 5. Technical architecture

### Frontend

- Next.js App Router + TypeScript for the production app.
- Tailwind or CSS Modules only after the visual direction is approved.
- Zod schemas shared between client/server for room and move payload validation.
- URL share route: `/room/{code}`.

### Game-specific room codes

Each game owns a stable three-letter prefix so a code is recognizable before a player opens it:

| Game | Prefix | Example |
| --- | --- | --- |
| Tic-tac-toe / 井字過三關 | `TIK` | `TIK-7Q4` |
| 小朋友落樓梯 | `LAD` | `LAD-3M8` |
| Connect Four / 四子棋 | `CON` | `CON-K8P` |

The suffix should be a short uppercase, human-friendly random token that avoids ambiguous characters such as `0/O` and `1/I`. The server remains the authority for uniqueness and expiry; the prefix is a routing hint and recognition aid, not a security boundary.

### Backend / hosting

- Vercel for the Next.js web app and server actions/API routes.
- Supabase Postgres for room/game state.
- Supabase client plus canonical snapshot recovery for the current release. Realtime Broadcast/Presence remains an optional future optimization, never the source of truth.
- Supabase Edge Functions or Vercel Route Handlers for authoritative commands, rate limiting and cleanup jobs.
- Keep `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables; never expose the service role key to the browser.

### Recommended split between database and Realtime

- **Database:** durable room row, members, game snapshot, event log, expiry timestamp.
- **Realtime:** presence, ready/unready, optimistic UI hints, low-latency move notifications.
- On every accepted move, persist a canonical event/snapshot first, then broadcast it. This makes turn-based recovery reliable even if a browser misses a Realtime packet.

## 6. Initial Supabase schema

```sql
create type room_mode as enum ('realtime', 'turn_based');
create type room_status as enum ('open', 'playing', 'finished', 'expired');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  game_slug text not null,
  mode room_mode not null,
  status room_status not null default 'open',
  host_guest_id uuid not null,
  state jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  max_players smallint not null default 2,
  expires_at timestamptz not null default now() + interval '6 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid references public.rooms(id) on delete cascade,
  guest_id uuid not null,
  display_name text not null,
  seat smallint,
  is_ready boolean not null default false,
  last_seen_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (room_id, guest_id)
);

create table public.game_events (
  id bigint generated always as identity primary key,
  room_id uuid references public.rooms(id) on delete cascade,
  version integer not null,
  guest_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (room_id, version)
);
```

For the anonymous model, never treat a client-provided display name as identity. `guest_id` is generated server-side or as a random UUID and is scoped to a room/session. Add RLS policies that allow a guest to read the room snapshot only when they possess a short-lived room capability; write moves through a server-authoritative function/route rather than direct arbitrary table updates.

## 7. Game contract

Every game implements the same small adapter so the portal can add games without changing lobby code:

```ts
type GameAdapter = {
  slug: string;
  title: string;
  players: { min: number; max: number };
  supports: ('realtime' | 'turn_based')[];
  createInitialState(): unknown;
  validateMove(state: unknown, move: unknown, actor: Guest): Result;
  applyMove(state: unknown, move: unknown): unknown;
  getStatus(state: unknown): 'playing' | 'won' | 'draw';
};
```

Tic-tac-toe is the vertical slice: 2 players, 3×3 board, atomic move validation, turn counter, win/draw check, and replayable event log. 小朋友落樓梯 should follow after the shell proves out: define the board size, dice/randomness authority, collision rules, and whether a turn can be resumed after a browser closes.

## 8. Anonymous safety / abuse controls

- Rate-limit room creation and join attempts by IP + guest session.
- Expire idle rooms automatically (suggested: 6 hours; playing rooms can have a shorter idle grace period).
- Do not expose raw email/account concepts in the UI.
- Allow “report room” and “leave room” without login.
- Reject oversized display names, room codes, payloads and event frequency.
- Log server-side room lifecycle metrics without storing unnecessary personal data.
- Add a simple privacy notice: anonymous does not mean invisible; operational logs and IP-level anti-abuse controls may still exist.

## 9. Delivery phases

### Phase 0 — experience decision (this prototype)

- Validate visual language, vocabulary, create/join flow and mobile layout.
- Define the mode vocabulary and make each game advertise its supported modes accurately.

### Phase 1 — vertical slice

- Next.js shell, Supabase project, room creation/join, tic-tac-toe, Realtime presence.
- Playwright smoke tests for create → join → ready → move → reconnect.

### Phase 2 — game platform

- Game adapter registry, event-sourced move endpoint, room expiry, abuse throttles.
- Add 小朋友落樓梯 and one additional quick game (Connect Four or Battleship-lite).

### Phase 3 — launch hardening

- Vercel preview/production environments, migrations, error tracking, product analytics that avoid identity profiling.
- Load test room bursts and reconnect behavior.
- Add OG preview cards for shareable room links.

## 10. Open product decisions for the next iteration

1. Should the landing page default to a game catalogue or a “join with code” action?
2. Is 小朋友落樓梯 a branded house game with a fixed ruleset, or should players be able to choose house rules?
3. For turn-based rooms, should a room stay open for hours/days or expire after a shorter window?
4. Should guest names be auto-generated only, or editable before entering a room?
5. Do you want an optional spectator mode for public rooms?
