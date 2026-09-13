# 打天九 prototype technical design

Proposal for the offline prototype. Playable 1 human + 3 CPU, same reducer as the future `TGW` room. No Supabase in this slice.

Read `rules.md` for play. Read `SPEC.md` for adapter and later platform gaps.

## Decision

Build the prototype as a **lab page inside the Next.js app**, not a second Vite/HTML stack.

```text
/lab/tien-gow    in-memory Helic table, 1H+3CPU, no room code
/room/TGW-xxx    later; same board + engine, server-authoritative
```

`games/tien-gow/src` owns rules, state, CPU, and view projection. `app/lab/tien-gow` and later `app` room UI only render `projectView(seat)` and POST moves into the reducer.

## Why not a disposable prototype

Downstairs needed a vendored physics feel-reference. 打天九 does not. A second app would duplicate combination math and dump-privacy bugs.

Connect Four is the pattern: engine module + CPU + UI that already lives in PLAYROOM.

## Module layout

```text
games/tien-gow/
  rules.md
  SPEC.md
  CONTEXT.md
  PROTOTYPE.md          this file
  package.json          @playroom/tien-gow
  src/
    index.ts            public exports
    tiles.ts            32-tile identity, ranks, red-pip counts
    combinations.ts     enumerate / rank / class
    table.ts            Helic defaults + option guards
    deal.ts             seeded shuffle, 8 each
    examples.ts         例牌 detectors
    scoring.ts          棟 nets, 莊 multiplier, 賀, 結, slam
    reducer.ts          validateMove / applyMove
    view.ts             projectView(seat)
    cpu.ts              nextCpuMove
    adapter.ts          GameAdapter wrapper
  tests/
    tiles.test.ts
    combinations.test.ts
    tricks.test.ts
    scoring.test.ts
    examples.test.ts
    cpu.test.ts
    view.test.ts
app/lab/tien-gow/
  page.tsx              client lab shell
  table-form.tsx        checkboxes
  board.tsx             four seats, tricks, dumps
  hand.tsx              own tiles + legal-combination picker
```

Do not add `games/tien-gow/prototype/` as a nested app.

## State machine

```text
setup
  host edits Table (Helic defaults on)
  start -> seeded deal
examples? (if table.examples)
  claim / skip clockwise from 莊
  claim -> settled (例牌 slam)
  all skip -> trick
trick
  leader: lead
  others: beat | dump
  trick complete -> next lead or last-trick 結
settled
  chips updated, 飛莊
  next hand | rematch (chips 100, same seats + Table)
```

Canonical state never leaves the engine. The lab page holds one in-memory state in a React reducer that calls `applyMove`. CPU moves apply in the same tick after a human move, looping while `nextCpuMove` returns a move for the current seat.

## Engine API (prototype)

The lab imports only:

```ts
createHand({ seed, table, bankerSeat, chips })
validateMove(state, move, actor)
applyMove(state, move, actor)
projectView(state, seat)
nextCpuMove(state, seat)
HELIC_TABLE
```

`createHand` is the seeded factory from `SPEC.md`. The shared `GameAdapter.createInitialState()` wrapper can call `createHand` with a fixed lab seed until rooms exist.

Move types: `setTable | claimExample | skipExample | lead | beat | dump`.

Illegal moves throw or return `{ ok: false, reason }` from `validateMove`. The lab disables illegal clicks by asking the engine for legal moves for the acting seat:

```ts
listLegalMoves(state, seat): TienGowMove[]
```

Export this for UI and CPU. CPU picks among legal moves; it must not construct a move the enumerator would omit.

## View privacy

Even in the lab, the human sees `projectView(humanSeat)` only.

- Own 8 tiles
- Face-up current combination
- Each seat: name, 棟 count, chip total, dump count
- CPU dump faces hidden until hand recap
- After 結, recap may reveal dumps

This is the same contract online must keep. If the lab cheats and shows CPU hands, that leak will ship.

Debug toggle `?god=1` may show all hands locally. Default off. Never wire god mode to a room snapshot.

## UI

Four seats around a table, human at bottom. Match PLAYROOM lobby type: bilingual labels, no gambling chrome.

Required on first playable lab:

1. Table checkboxes (文尊, 擒文尊 disabled unless 文尊, 么結, 么雙擒四, 包尊, 賀四, 七支/八支, 例牌). Extra options collapsed.
2. Tile faces as CSS pips (red 1/4, white otherwise). No asset pack required.
3. Combination picker: selected tiles preview class + rank, or illegal.
4. 墊牌: select exact count, confirm; faces hidden from the table.
5. Public log: "南 打 地八" / "西 墊 2".
6. Immediate 賀錢 toast, then 結 recap with 棟 nets and multipliers.

Non-goals for lab UI: 牌頭 animation, dice 選莊, chip physics.

## CPU

`nextCpuMove` is deterministic given `(state, seat, table)`.

Priority, first match:

1. 例牌 claim if the seat qualifies and 莊-priority says this seat wins the window
2. On lead: 武尊, then 文尊 if enabled, then 四文武
3. 擒文尊 if the current combo is 文尊 and seat holds 孖高腳
4. Beat if this seat is 結-eligible and beating wins the trick with last tiles
5. Beat with the cheapest higher combo (lowest rank that still beats)
6. Dump lowest-value junk, keep 至尊 / 天九 family / 么牌 according to Table

No search tree in the prototype. Tests freeze a handful of hands and assert the chosen move.

## Tests before UI

Bun tests in `games/tien-gow/tests`. Do not open the lab page until 1–3 pass.

1. Every tile identity, civil/military rank, red-pip counts for 一點紅 / 全白
2. Enumerator: 文對, 雜子, 天九 family, 至尊, 文尊 gated by Table
3. 格食格: 地八 does not beat 雜九; 三文 does not beat 三武
4. Early-death: 0 棟 after 7 tiles must dump a singleton
5. Scoring fixtures from `rules.md` (空棟 -5, 初任 x2, 莊 入一 not doubled)
6. 賀尊 immediate vs 包尊 no 賀錢
7. 擒文尊 only when both options on
8. 莊 slam first lead 天 is 七支 not 八支
9. `projectView` omits other hands and dump faces

## Lab wiring in the app

- Route is not in `GAME_CATALOG`. No create-room button.
- No guest session required.
- Human is seat 0. CPU seats 1–3. First 莊 is seat 0 for the first lab hand so the human leads; later 飛莊 follows rules.
- `bun run dev` then open `/lab/tien-gow`.

When rooms land, move `board.tsx` / `hand.tsx` next to the room client. Delete only the in-memory store, not the engine.

## Mapping to platform (out of this prototype)

| Prototype | Later room |
| --- | --- |
| React memory | Postgres snapshot + `append_game_event` |
| `projectView` in the browser | `projectView` on GET, per guest |
| 3 CPU in process | `is_cpu` on seats 1–3, possibly fewer |
| Seed from `Date.now()` | Server seed |
| `/lab/tien-gow` | `TGW-xxx` |

Do not implement catalog, room codes, or migrations in the prototype slice.

## Implementation order

Same as `SPEC.md` slices 1–9. Slice 9 is this lab page. Slice 10 is the PR that should not mix with 1–9.

## Acceptance

Prototype is done when:

- `bun test` covers enumerator, tricks, scoring, views, CPU legal moves
- `/lab/tien-gow` plays a full hand 1H+3CPU on Helic defaults
- Turning 文尊 off makes 孖伶冧 a normal 寶子
- Turning 擒文尊 off makes led 文尊 unbeatable
- Human cannot see CPU hands or dump faces
- No `TGW` rooms, no migration, no catalogue card
