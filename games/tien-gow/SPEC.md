# 打天九 implementation

Coding-agent contract. Play is `rules.md`. Terms are `CONTEXT.md`.

Implement with TDD. One slice at a time: write failing `bun test` files, then production code until green. Do not start slice N+1 while N is red. Do not add PLAYROOM rooms, migrations, or catalogue in slices 1–9.

## Outcome

`@playroom/tien-gow` reducer + CPU, playable at `/lab/tien-gow` as 1 human + 3 CPU, in memory, no Supabase. Same reducer later serves `TGW` rooms.

## Layout

```text
games/tien-gow/src/
  tiles.ts combinations.ts table.ts deal.ts
  examples.ts scoring.ts reducer.ts view.ts cpu.ts adapter.ts
  index.ts
games/tien-gow/tests/*.test.ts
app/lab/tien-gow/          slice 9 only
```

No nested Vite/HTML app.

## Types

```ts
type Table = {
  wenHonor: boolean;
  captureWenHonor: boolean;
  yaoSettle: boolean;
  yaoCapture: boolean;
  baoHonor: boolean;
  fourBless: boolean;
  slam: boolean;
  examples: boolean;
  baoHonorAlsoHe: boolean;
  extraExamples: boolean;
};

type Move =
  | { type: 'lead' | 'beat' | 'dump'; tiles: TileId[] }
  | { type: 'claimExample' }
  | { type: 'skipExample' };

createHand({ seed, table, bankerSeat, chips }): State
validateMove(state, move, actor): { ok: true } | { ok: false; reason: string }
applyMove(state, move, actor): State
listLegalMoves(state, seat): Move[]
projectView(state, seat): View   // own hand; dump counts not faces
nextCpuMove(state, seat): Move | null
```

Default `Table`: every option on except `baoHonorAlsoHe` and `extraExamples`.

`GameAdapter.createInitialState()` wraps `createHand` with a seed. Room status stays `playing` across hands; do not finish the room on 結.

Canonical state holds all hands. Lab and later GET snapshots send `projectView(actor)` only. Lab `?god=1` may show all hands; default off.

## CPU

Pick from `listLegalMoves` only, deterministic.

1. 例牌 claim if this seat wins the window
2. On lead: 武尊, then 文尊, then 四文武
3. 擒文尊 if current combo is 文尊 and seat holds 孖高腳
4. Beat to 結 when eligible
5. Cheapest legal beat
6. Dump junk

No search.

## Lab (slice 9)

`/lab/tien-gow` is not in the catalogue. No guest session.

- Human seat 0, CPU 1–3, first 莊 = 0, then 飛莊
- Table checkboxes; `captureWenHonor` disabled unless `wenHonor`
- CSS pip tiles (red 1/4)
- Combination picker from selected tiles
- Public log; 賀 toast; 結 recap
- After a human move, apply `nextCpuMove` in a loop until the human to play

Rematch: chips 100, same seats and Table.

## Slices

Each slice names the red tests. Fixtures come from `rules.md`.

### 1. Tiles and combinations

Red: `tests/tiles.test.ts`, `tests/combinations.test.ts`

- 32 identities, 文/武 rank, red-pip counts
- Enumerator emits 文對, 武對, 天九 family, 至尊
- 文尊 present only if `wenHonor`
- 地八 does not beat 雜九; 三文 does not beat 三武; equal rank does not beat

Green: `tiles.ts`, `combinations.ts`, `table.ts`

### 2. Tricks

Red: `tests/tricks.test.ts`

- lead / beat / dump; 墊 always legal
- 上家 must act before 下家
- 0 棟 after 7 tiles must dump a singleton last trick
- last trick of 2+ tiles allows a 0 棟 beat

Green: `deal.ts`, `reducer.ts` (no scoring yet)

### 3. Ordinary 結

Red: `tests/scoring.test.ts`

- 空棟 −5, par 4, 入一 / 入二
- 初任 ×2; losing 莊 入一 not doubled

Green: `scoring.ts` hooked from reducer

### 4. 賀尊, 賀四, 擒文尊

Red: `tests/honor.test.ts`

- mid-hand 至尊 pays immediately, collector leads
- 擒文尊 only if both options on
- `wenHonor` on + `captureWenHonor` off: led 文尊 unbeatable
- last-trick 至尊 is not 賀

### 5. 包尊, 四大包, 么結, 么雙擒四

Red: `tests/special-settle.test.ts`

- 包尊 ×2, no 賀錢 unless `baoHonorAlsoHe`
- 四大包 ×4
- 么雙擒四 coverage and 入一 still on 結

### 6. 七支 / 八支

Red: `tests/slam.test.ts`

- all 8 棟 required
- forced last singleton is 七支
- 莊 first lead 天 cannot be 八支
- empty 5 then slam multiplier

### 7. 例牌

Red: `tests/examples.test.ts`

- four default hands; 莊 priority; immediate 結 with slam
- `extraExamples` off: 四對子 is not 例牌

### 8. View and CPU

Red: `tests/view.test.ts`, `tests/cpu.test.ts`

- `projectView` omits other hands and dump faces
- CPU move ∈ `listLegalMoves`
- frozen hands for priorities 2–6

Green: `view.ts`, `cpu.ts`, `adapter.ts`

### 9. Lab UI

Red: `tests/lab-smoke.test.ts` if a cheap render test exists; otherwise manual: one full hand on defaults.

Green: `app/lab/tien-gow/*` importing the engine. Human cannot see CPU hands.

### 10. Rooms (separate issue)

`TGW` prefix, `max_players = 4`, multi-CPU fill, `projectView` on GET, Table checkboxes on start. Reuse lab board components. Not this issue.

## Done

`bun test` green for slices 1–8. `/lab/tien-gow` plays one hand 1H+3CPU. No `TGW` rooms.
