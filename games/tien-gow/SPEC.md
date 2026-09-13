# 打天九 engineering spec

Spec only. No game code in this change. Later coding sessions implement this file and `rules.md`.

## Outcome

A `games/tien-gow` module that:

1. Implements the Helic table in `rules.md` behind `GameAdapter` from day one
2. Is playable locally as 1 human + 3 CPU without a network
3. Later wires into PLAYROOM rooms as `TGW-xxx` with mixed humans and CPU

## Non-goals

- Money, stakes, or gambling
- 推牌九
- 小天九 (4 tiles)
- 輪莊
- A throwaway HTML/Vite prototype
- Implementing 牌頭 as fairness mechanics
- Deep CPU search

## Adapter

Keep the shared `GameAdapter` shape. Extend the module with helpers the current 2-player games do not need. Do not require every PLAYROOM game to grow these helpers until 打天九 lands.

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

type TienGowMove =
  | { type: 'setTable'; table: Table }
  | { type: 'claimExample' }
  | { type: 'skipExample' }
  | { type: 'lead'; tiles: TileId[] }
  | { type: 'beat'; tiles: TileId[] }
  | { type: 'dump'; tiles: TileId[] };

createInitialState(input: { seed: string; table: Table; bankerSeat: 0|1|2|3 }): State
validateMove(state, move, actor)
applyMove(state, move, actor)
projectView(state, seat): PublicView  // never leak other hands or dump faces
getHandStatus(state): 'dealing' | 'examples' | 'trick' | 'settled'
nextCpuMove(state, seat): TienGowMove | null
```

`createInitialState()` on the shared adapter may take no args today. The module exports a seeded factory. Platform start-room later calls that factory with server RNG.

`getStatus(): playing | won | draw` is too small. Map a settled hand to `playing` while chips remain and the room is open; map only an explicit room-end to `finished`. Do not finish the room after one hand.

## Hidden information

Canonical state holds all hands and dump faces.

`projectView(seat)` returns:

- own hand
- own 棟 count and public 棟 counts
- current face-up combination
- dump counts, not dump faces
- whose turn
- Table, 莊, 莊 tenure, chips
- last public recap after 結, including revealed dumps

Online snapshots must send `projectView(actor)`, never the canonical state.

## CPU and seats

- `max_players = 4`
- Host may start with 1-4 humans. Remaining seats are CPU
- Several CPU occupants are allowed. Current `members.find(is_cpu)` is insufficient
- CPU uses the locked Table
- Local prototype: one human at a seat, three CPU, same reducer as online

## Platform gaps (later, not the first coding session)

- Catalog entry, `TGW` prefix, `PLAYROOM_ROOM_CODE`
- `create_room_for_guest` allows `tien-gow`, `max_players = 4`
- Start fills empty seats with CPU
- Move route uses this module, not tic-tac-toe/connect-four branches
- Private views on GET snapshot
- Table UI on create/start: checkboxes from `rules.md`

Playable prototype shape: `PROTOTYPE.md`.

## Implementation slices

Later issue breakdown, in this order. Each slice keeps the adapter types complete even if a move type is not yet accepted.

1. Tiles, ranks, combination enumerator, tests
2. Trick reducer: lead, beat, dump, eligibility, 格食格
3. Ordinary 結 scoring + 莊 multiplier + 入一/入二/空棟
4. 賀尊, 賀四, 擒文尊
5. 包尊, 四大包, 么結, 么雙擒四
6. 七支 / 八支 including 莊 頭牌 not 天/九/至尊
7. 例牌 window
8. CPU legal player on the locked Table
9. Local 1H+3CPU UI using the same reducer
10. PLAYROOM wiring

## Acceptance for the spec itself

- `games/tien-gow/rules.md` can answer a rules question without Wikipedia
- Helic 今次牌例 is the default Table
- 文尊 and 擒文尊 are independent options
- 「不可頓牌」is documented as 莊 八支 頭牌不可用天/九/至尊, not a second rule
