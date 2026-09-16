# 打天九 lab UAT test plan

**Project**: PLAYROOM / 玩房 — game 4 prototype  
**Build under test**: local Next.js app, `/lab/tien-gow` only  
**UAT type**: Hybrid — scripted browser cases on pinned deals, then a short exploratory pass  
**Primary persona**: one human (南 / seat 0) plus three CPU seats  
**Plan date**: 2026-09-16  
**Rules**: `games/tien-gow/rules.md`  
**Terms**: `games/tien-gow/CONTEXT.md`  
**Engine contract**: `games/tien-gow/SPEC.md`

This is the business-facing acceptance plan for the in-memory lab. It is not a substitute for `bun test` under `games/tien-gow/tests/`. Those tests are the scoring oracle and an entry criterion. Browser UAT proves the same rules are visible and playable.

Do not wait for a lucky shuffle. Every scripted case below names either a **seed** or a **fixture**. If neither is pinned, the case is not a UAT case.

---

## 1. Strategy

### Objective

Prove that a tester on localhost can open the lab, lock a Table, deal a known 32-tile layout, play (or watch) a legal hand, and see 賀 / 結 / 例牌 outcomes that match `rules.md` — without depending on the random draw.

### Why the draw cannot drive UAT

The engine shuffle is already deterministic given a seed (`dealHands` + mulberry32 in `games/tien-gow/src/deal.ts`). The live lab currently calls `nextSeed('lab')` (`lab:` + timestamp) on every 開牌, so two testers never see the same hands.

Even with a pinned seed, rare `rules.md` events are too sparse for a scripted session:

| Event | Why a random deal is the wrong UAT tool |
| --- | --- |
| 例牌 (一點紅 / 七武 / 全白 / 八武) | A few hands in 10⁴–10⁵ deals; 八武 on 莊 is rarer still |
| 賀尊 / 擒文尊 / 包尊 | Need a specific combo in a specific seat at a specific trick |
| 么結 / 么雙擒四 / 七支 / 八支 | Need a constructed last trick, not CPU’s cheapest legal beat |
| Ordinary 結 arithmetic | Need known 棟 counts; CPU will beat when it can, which changes 棟 |

UAT therefore **pins the deal**, then **controls who follows**. Probability of a pattern is out of scope. Uniqueness of the 32-tile deck and seed replay are in scope.

### Deal-control mechanism

Three layers. Use the cheapest layer that makes the expected result checkable.

| Layer | What is pinned | Use for | Browser control |
| --- | --- | --- | --- |
| A. Invariants | Nothing (any legal deal) | Always-true table facts | Any 開牌, preferably with `god=1` |
| B. Seeded shuffle | `seed` + `banker` + Table | Ordinary play, replay, 例牌 that a known seed already deals | `?seed=&banker=` |
| C. Frozen hands | Named 4×8 layout + Table + 莊 | Rare combos and scoring scripts | `?fixture=` |

**Layer B rule.** Same `seed` + same Table + same `bankerSeat` ⇒ same four hands. Record the seed in the execution log. A failed case is reproduced by opening the same URL, not by dealing again.

**Layer C rule.** Frozen hands are the same layouts already used in `games/tien-gow/tests/*.test.ts` (`createHand({ hands })` + `fillHands`). The browser must load them by fixture id. Do not reconstruct them from a search for a seed.

**Follow control.** CPU is deterministic, but it is not the unit-test script: it beats when it can (`nextCpuMove`). Unit tests force 墊 with `followersDump`. Browser rule scripts that need “everyone 墊” or a non-optimal beat must use one of:

| Mode | Query | Behaviour |
| --- | --- | --- |
| Live | (default) | Seat 0 human; seats 1–3 CPU auto-play. Product feel. |
| Dump-follow | `cpu=dump` | CPU may still lead/claim; on follow it always 墊. Matches `followersDump`. |
| All-seat | `play=all` | No CPU. The tester plays whichever seat is `toAct`. Exact unit-test sequences. |

Default for product cases: Live. Default for 賀 / 結 / slam / last-trick flags: `cpu=dump` if the human is the actor of interest, otherwise `play=all`.

### Lab URL contract

Harness the lab must honour before scripted Layer B/C cases can run. `god=1` already exists.

```
http://localhost:3000/lab/tien-gow?god=1&seed=<id>&banker=0
http://localhost:3000/lab/tien-gow?god=1&fixture=<id>&cpu=dump
http://localhost:3000/lab/tien-gow?god=1&fixture=<id>&play=all
```

| Param | Default | Effect |
| --- | --- | --- |
| `god` | off | `1` shows all four hands. Default still hides CPU faces. |
| `seed` | none | Passed to `createHand({ seed })`. Ignored when `fixture` is set. |
| `banker` | seed’s `randomBankerSeat`, or `0` in today’s lab | Pins 莊 to `0`–`3`. |
| `fixture` | none | Loads the named frozen hands in §7. Overrides `seed`. |
| `cpu` | auto | `dump` = follow is always 墊. |
| `play` | live | `all` = tester plays every seat. |
| `examples` | Table default | `0` / `1` overrides `examples` before the first deal. |

Show **seed**, **fixture id**, **莊**, and **Table** in the lab chrome so a tester can copy them into the log.

**Harness (implemented).** `/lab/tien-gow` honours the query contract above. Chrome shows seed, fixture id, 莊, play/cpu mode, and Table. Fixtures live in `games/tien-gow/src/uat-fixtures.ts`. Next-hand seed is `seed + ':hand-' + n`, not `Date.now()`. Unpinned first 開牌 uses seed `lab`; unpinned 重開牌局 advances to `lab:hand-1`. Layer B/C cases are executable.

### Approach

| Layer | Method | Owner |
| --- | --- | --- |
| Scripted UAT | One browser on `/lab/tien-gow` with the URL contract | Agent / tester |
| Engine oracle | `bun test games/tien-gow` | CI / local gate |
| Exploratory | 15 minutes on Live mode after scripted cases | Agent / tester |
| Visual | Desktop 1280×800 and mobile 390×844 | Agent / tester |

One browser is enough. The lab is 1H+3CPU in memory; two guests and `TGW-` rooms are a later issue (`SPEC.md` slice 10).

### Environment

| Item | Value |
| --- | --- |
| App | `http://localhost:3000/lab/tien-gow` (hostname `localhost`, not `127.0.0.1`) |
| Command | `bun run dev` from repository root |
| Backend | None. Lab does not use Supabase or guest session. |
| Browsers | Chromium required |
| Viewports | Desktop 1280×800; mobile 390×844 |
| Seats | 南 0 (human), 東 1, 北 2, 西 3, counterclockwise |

Do not point this UAT at production or a Vercel preview. Do not use `prototype/index.html`.

### Test data

| Data | Rule |
| --- | --- |
| Starting chips | `[100, 100, 100, 100]` — sum **400** after every 賀 and 結 |
| Default Table | All options on except `baoHonorAlsoHe` and `extraExamples` |
| Tile ids | `wen:<name>:0\|1` and `wu:<a>-<b>` as in `games/tien-gow/src/tiles.ts` |
| Seeds | §6 catalog |
| Fixtures | §7 catalog |
| Ordinary 結 table | 0 棟 −5, 1 −3, 2 −2, 3 −1, 4 0, 5 +1, 6 +2. Par 4. 莊家倍數 = streak+1 (初任 ×2). |

### Roles

| Role | Seat | How they act |
| --- | --- | --- |
| Tester | 南 / 0, unless `play=all` | Clicks own tiles; leads / beats / 墊 / 例牌 |
| CPU | 東 北 西 | Live or `cpu=dump` |
| Observer | — | `god=1` to verify hidden 墊牌 and other hands |

---

## 2. Scope

### In scope

- `/lab/tien-gow` as 1 human + 3 CPU, in memory
- Table checkboxes, lock after 開牌, dependent options (`captureWenHonor` needs `wenHonor`; `yaoCapture` needs `yaoSettle`)
- Deal of 32 unique tiles, 8 per seat
- Seed replay and fixture load (once the URL contract exists)
- Lead / beat / 墊, 格食格, 上家 before 下家, 準拆
- 賀尊, 擒文尊, 賀四 (toast + chip change mid-hand)
- 結 recap: ordinary nets, 包尊, 四大包, 么結, 么雙擒四, 七支 / 八支, 例牌
- Default vs god visibility (`projectView`: own hand; 墊 shows count, not faces)
- CPU plays only legal moves; on lead prefers 武尊, then 文尊, then 四文武
- 飛莊 / 下一局 chips; 重開牌局 resets to 100
- Desktop and mobile lab layout
- 天 display paints two centre pips red; 例牌 red-count still ignores those sixes

### Out of scope

- `TGW-` rooms, catalogue, lobby, guest session, Supabase
- Production / Vercel Preview
- Accounts, chat, money
- Measuring shuffle frequencies or “how often 例牌 appears”
- Accessibility audits beyond keyboard/focus smoke
- `extraExamples` patterns other than proving 四對子 is off by default and on when checked
- Reload recovery (lab state is in-memory; refresh starts a new session — expected)

---

## 3. Traceability (`rules.md`)

| Rule | Cases | Deal layer |
| --- | --- | --- |
| 4 players, 32 tiles, 8 each, CPU fill | TC-TGW-003, TC-TGW-004 | A |
| Seeded shuffle; first 莊 seeded | TC-TGW-020, TC-TGW-021, TC-TGW-H01 | B |
| Table locked; option matrix | TC-TGW-002, TC-TGW-040 | A |
| Tile ranks, red 1/4, 天 paint | TC-TGW-012, TC-TGW-013 | A / C |
| Combinations, equal rank cannot beat, 文≠武 | TC-TGW-006, TC-TGW-030 | A / C |
| Trick: lead, beat, 墊 always legal | TC-TGW-007, TC-TGW-030 | A / C |
| 上家 before 下家 | TC-TGW-008 | A |
| 0 棟 last singleton must 墊 | TC-TGW-031 | C |
| Last trick 2+ tiles: 0 棟 may beat | TC-TGW-032 | C |
| Ordinary 結, par 4, 莊家倍數 | TC-TGW-033 | C |
| 賀尊 / 擒文尊 / unbeatable 文尊 | TC-TGW-034 … TC-TGW-036 | C (B fallback) |
| 包尊 not 賀; `baoHonorAlsoHe` | TC-TGW-037, TC-TGW-038 | C |
| 么結 / 么雙擒四 | TC-TGW-039 | C |
| 七支 / 八支 / 莊 first lead 天 | TC-TGW-041, TC-TGW-042 | C |
| 例牌 window, 莊 priority, slam | TC-TGW-050 … TC-TGW-054 | B / C |
| Hidden 墊牌 until recap | TC-TGW-005, TC-TGW-014 | A |
| CPU legal + lead priority | TC-TGW-060, TC-TGW-061 | B / C |
| 飛莊, rematch chips | TC-TGW-023, TC-TGW-024 | B |

---

## 4. Entry criteria

- [ ] `bun test games/tien-gow` green (engine oracle)
- [ ] `bun run dev` serves `/lab/tien-gow`
- [ ] This plan reviewed; cases below are the script
- [x] Lab URL contract implemented (`god`, `seed`, `banker`, `fixture`, `cpu`, `play`, `examples`)
- [x] Tester can copy seed / fixture from the lab chrome

## 5. Exit criteria

- [ ] All **Critical** and **High** cases passed, or Blocked with a named harness gap
- [ ] No open Critical or High product defects
- [ ] Medium / Low defects logged with workaround
- [ ] Execution log filled (§11)
- [ ] Go / No-Go recorded for the lab prototype (not production `TGW` rooms)

### Severity

| Severity | Meaning | Prototype gate |
| --- | --- | --- |
| Critical | Cannot deal, cannot play a legal trick, chips desync, wrong 結 player | Block |
| High | Named rule (賀尊, 例牌, slam, last-trick 墊) wrong on a pinned fixture | Block |
| Medium | Workaround exists (god mode to inspect, engine test still green) | Document |
| Low | Copy, layout, bilingual (lab is 中文-first) | Document |

---

## 6. Seed catalog (Layer B)

Verified against `dealHands` + `findExamples` + `randomBankerSeat` on this branch. Hands listed as 南 labels. Use `god=1` to confirm all four seats.

| Seed | 莊 | Why it exists | 南 hand (labels) |
| --- | --- | --- | --- |
| `uat-3` | 0 | No 例牌. Ordinary Live play. | 七 九 高腳七 九 天 和 高腳七 紅頭十 |
| `lab-smoke` | 1 | Engine smoke seed; full hand reaches 結 with `examples=0`. | 大頭六 板凳 高腳七 梅花 五 地 長三 和 |
| `uat-331` | 0 | 南 一點紅 | 梅花 天 板凳 八 梅花 長三 伶冧六 九 |
| `uat-32437` | 0 | 南 七武 | 九 九 七 天 五 八 么三 八 |
| `uat-814` | 0 | 南 全白 (includes 天 — display-red only) | 九 七 斧頭 梅花 八 板凳 五 梅花 |
| `uat-3775` | 1 | 南 八武. 莊 is 東; human is not 莊. | 大頭六 七 五 五 七 八 么三 九 |
| `uat-159` | 0 | 南 holds 至尊 (么三 + 大頭六) | 紅頭十 人 地 八 么三 伶冧六 大頭六 和 |
| `uat-995` | 0 | 南 孖伶冧; 東 孖高腳 — Live 擒文尊 | 梅花 伶冧六 人 伶冧六 五 九 地 斧頭 |

`lab` (no suffix) deals 一點紅 to **北**, 莊 = 東. Useful only after the lab stops appending timestamps.

Do not hunt new seeds during a UAT run. If a needed pattern is not in this table, use a Layer C fixture.

---

## 7. Fixture catalog (Layer C)

Remainder tiles follow `fillHands` in `games/tien-gow/tests/helpers.ts` (unused `DECK` order). Testers check the listed seats in god mode; other seats must still total 8 tiles and the full deck must be unique.

Table unless noted: `PLAY_TABLE` from tests (`examples` **off**, other defaults on, `baoHonorAlsoHe` off).

### `he-supreme` — 賀尊

莊 0. 南: 么三, 大頭六, 板凳, 梅花, 斧頭, 長三, 和, 人.

Lead 至尊; others can only 墊. Toast `賀尊`. Chips `[112, 96, 96, 96]` (collector is 莊, 初任 ×2, base 2). Collector leads next.

### `capture-on` — 擒文尊

莊 0. 南: 孖伶冧 + 板凳, 梅花, 斧頭, 長三, 和, 人. 東: 孖高腳, 孖地, 孖天, 兩九.

Lead 文尊. 東 beats with 孖高腳. Toast `擒文尊`. 東 leads next.

### `unbeatable-wen` — same hands as `capture-on`

Table: `captureWenHonor` off. After 南 leads 文尊, 東 has no beat (only 墊), even with 孖高腳.

### `bao-last` — last-trick 至尊 is 包尊, not 賀

Same 南 hand as `he-supreme`. Play six singleton leads from the fillers, then 至尊 last. No 賀 toast. Recap `flags.baoHonor`.

### `bao-he` — `baoHonorAlsoHe` on

Same script as `bao-last` with `baoHonorAlsoHe` on. 賀尊 toast **and** 包尊 recap.

### `must-dump` — 0 棟 last singleton

南: 板凳, 梅花, 斧頭, 長三, 和, 人, 地, 伶冧六. 東: 天, 伶冧六, 高腳七, 紅頭十, 么三, 大頭六, 五, 五.

南 wins seven singleton tricks (`cpu=dump` or `play=all`). Last lead 伶冧六. 東 must 墊 despite holding 天.

### `pair-last` — 0 棟 may beat a last pair

南: 孖板凳 + 梅花, 斧頭, 長三, 和, 人, 地. 東: 孖天 + 伶冧六, 高腳七, 紅頭十, 么三, 大頭六, 五.

Six singleton dumps, then 南 leads 板凳對. 東 may (and in Live will) beat with 天對 and 結 with 2 棟.

### `forced-seven` — 七支

南: 板凳, 梅花, 斧頭, 長三, 和, 人, 地, 天. Win seven dumps then last 天 against forced 墊. Recap slam `seven`, 棟 `[8,0,0,0]`.

### `banker-tian` — 莊 first lead 天 cannot be 八支

南: 天, 梅花, 斧頭, 長三, 和, 人, 孖板凳. First lead 天, then fillers, last 板凳對. Recap slam `seven` (not `eight`).

### `example-yi-dian-hong`

Table `examples` on. 南: 伶冧六 + 天, 天, 梅花, 梅花, 長三, 長三, 板凳. Phase `example`, 南 to act. Claim → recap 一點紅, slam `seven`. 東 also qualifies 一點紅; 莊 still wins the window.

### `example-qi-wu`

南: 兩九, 兩八, 兩七, 大頭六, 天. Claim → 七武, slam `seven`.

### `example-quan-bai`

南: 孖天, 孖梅花, 孖長三, 孖板凳. Claim → 全白, slam `eight`. Confirm 天 centre pips look red and the hand still counts as 全白.

### `example-ba-wu`

南: 兩九, 兩八, 兩七, 大頭六, 五(2-3). Claim → 八武, slam `eight`.

### `extra-si-dui-zi`

南: 孖天, 孖地, 孖梅花, 孖板凳. `extraExamples` off: no 例牌 window. On: 四對子, slam `eight`.

---

## 8. Test cases

Record **URL**, **seed or fixture**, **Actual result**, and **Pass/Fail** in §11. Use `god=1` unless the case tests hidden hands.

### 8.1 Lab chrome and invariants (Layer A)

#### TC-TGW-001 — Lab loads without guest session

**Feature**: Lab shell  
**Priority**: Critical  
**Prerequisite**: Dev server up  
**Deal**: none

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Open `http://localhost:3000/lab/tien-gow` | Title 打天九; kicker says lab / not in catalogue; no guest-session footer required |
| 2 | Confirm seats | 南位 你, 東, 北, 西; 開牌 enabled |

#### TC-TGW-002 — Table defaults and lock

**Feature**: Table  
**Priority**: High  
**Deal**: any

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Read checkboxes before 開牌 | On: 文尊, 擒文尊, 么結, 么雙擒四, 包尊, 賀四 / 四大包, 七支 / 八支, 例牌. Off: 包尊亦賀, 額外例牌 |
| 2 | Uncheck 文尊 | 擒文尊 unchecks and disables |
| 3 | Recheck 文尊, uncheck 么結 | 么雙擒四 unchecks and disables |
| 4 | 開牌 | All Table checkboxes disabled until 結 recap |

#### TC-TGW-003 — 32 unique tiles, 8 each

**Feature**: Deal  
**Priority**: Critical  
**Deal**: any, `god=1`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 開牌 | Each seat shows 8 bones |
| 2 | Inventory all faces | 32 distinct tiles; two of each 文子; 10 武子 identities |

#### TC-TGW-004 — CPU hands hidden by default

**Feature**: View  
**Priority**: High  
**Deal**: any, **no** `god`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 開牌 | 南 faces up; 東北西 face-down backs, count 8 |
| 2 | Play until someone 墊 | 墊 bones stay face down in the trick |

#### TC-TGW-005 — God mode shows all hands

**Feature**: View  
**Priority**: High  
**Deal**: same as 004, `?god=1`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Reload with `god=1`, 開牌 | All four hands face up |
| 2 | Someone 墊 | Trick still shows 墊 face down (god does not flip 墊牌) |

#### TC-TGW-006 — Combination picker rejects mixed class

**Feature**: Combinations  
**Priority**: High  
**Deal**: any Live deal where 南 has both a 文子 and a 武子

| Step | Action | Expected |
| --- | --- | --- |
| 1 | On lead, select one 文 and one 武 | No 出 button; hint that 文武不同門 if on follow |
| 2 | Select two identical 文子 | 出 文對 (or 文尊 if 孖伶冧) enabled |

#### TC-TGW-007 — 墊 is always offered on follow

**Feature**: Trick  
**Priority**: High  
**Deal**: any; wait until 南 follows

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Opponent leads; select the matching number of 南 tiles | 墊 enabled even if a beat exists |

#### TC-TGW-008 — Counterclockwise 上家 before 下家

**Feature**: Trick  
**Priority**: High  
**Deal**: any; 南 is 莊 or has just won

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 南 leads | 東 to-act, then 北, then 西, then 南 leads or 結 |
| 2 | Watch CPU | Only one seat highlighted `to-act` at a time |

#### TC-TGW-009 — Chip conservation

**Feature**: Scoring  
**Priority**: Critical  
**Deal**: any full hand to recap

| Step | Action | Expected |
| --- | --- | --- |
| 1 | After every 賀 toast and after 結 | Four chip values sum to 400 |

#### TC-TGW-011 — Mobile layout

**Feature**: Layout  
**Priority**: Medium  
**Deal**: none then one 開牌  
**Viewport**: 390×844

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Open lab | Table options, felt, 南 hand, 出/打/墊 reachable without clipping the felt |
| 2 | 開牌 and select two tiles | Picker buttons remain tappable |

#### TC-TGW-012 — 天 paint vs 例牌 red count

**Feature**: Tiles  
**Priority**: Medium  
**Deal**: fixture `example-quan-bai` or seed `uat-814`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Inspect 天 | Two centre pips on each six painted red |
| 2 | If 例牌 window | 全白 still offered / claimed (those sixes are display-only) |

#### TC-TGW-013 — Red pips are 1 and 4 only

**Feature**: Tiles  
**Priority**: Low  
**Deal**: `god=1`, any

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Scan 地 (1-1), 人 (4-4), 和 (1-3), 紅頭十 (4-6), 高腳七 (1-6), 伶冧六 (1-5), 五 (1-4) | Those faces show red 1/4 pips; other pips white |

#### TC-TGW-014 — Recap reveals 墊牌

**Feature**: 結  
**Priority**: Medium  
**Deal**: any hand that had 墊, to recap

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Reach 結 | Recap / log can account for hidden tiles; 墊 faces were not public mid-hand |

---

### 8.2 Seeded shuffle (Layer B)

#### TC-TGW-020 — Same seed, same deal

**Feature**: Deal  
**Priority**: Critical  
**Deal**: `?god=1&seed=uat-3&banker=0`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 開牌 (must use URL seed, not `lab:<time>`) | 南 matches §6 `uat-3`; 莊 is 南 |
| 2 | Copy URL, new tab, 開牌 | Identical four hands |
| 3 | 重開牌局 with the same seed | Identical four hands again |

#### TC-TGW-021 — Different seed, different deal

**Feature**: Deal  
**Priority**: High  
**Deal**: `uat-3` then `lab-smoke`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Deal both seeds | Hands differ; both still 8×4 unique tiles |

#### TC-TGW-022 — Full Live hand on a known seed

**Feature**: Ordinary play  
**Priority**: Critical  
**Deal**: `?seed=lab-smoke&banker=1&examples=0` (Live)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Play until 結, CPU legal | Recap appears; 結 seat is 莊 next; chips sum 400 |
| 2 | Illegal click (wrong seat / mixed class) | Move ignored; state unchanged |

#### TC-TGW-023 — 下一局 飛莊

**Feature**: 飛莊  
**Priority**: High  
**Deal**: finish TC-TGW-022

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 下一局 | New deal; 莊 = previous 結 seat; chips carry; if same 莊, 莊家倍數 steps up |
| 2 | Record next-hand seed | Derived from previous seed, not wall clock |

#### TC-TGW-024 — 重開牌局 resets chips

**Feature**: Rematch  
**Priority**: Medium  
**Deal**: after a scored hand

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 重開牌局 | Chips `[100,100,100,100]`; 莊 0 in current lab; same Table |

#### TC-TGW-H01 — Harness chrome

**Feature**: Deal control  
**Priority**: High  
**Deal**: any pinned URL

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Open a seed or fixture URL | Chrome shows seed or fixture id, 莊, Table, play/cpu mode |
| 2 | Change a query param and reload | Deal matches the new pin |

---

### 8.3 Trick and last-trick rules (Layer C)

Use `god=1` and `cpu=dump` unless noted.

#### TC-TGW-030 — Lead, beat, 墊 on a frozen deal

**Feature**: Trick  
**Priority**: Critical  
**Deal**: fixture `must-dump` is enough for lead/墊; or `pair-last` for a beat  
**Mode**: `play=all` or Live

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 南 leads 板凳 | Face-up; 東 to-act |
| 2 | 東 墊 | Face-down one bone; 北 then 西 |
| 3 | Trick eaten by 南 | 南 1 棟; 南 leads again |

#### TC-TGW-031 — 0 棟 must 墊 the last singleton

**Feature**: 結 eligibility  
**Priority**: High  
**Deal**: `must-dump`  
**Mode**: `cpu=dump` for the first seven tricks, Live or `play=all` on the last

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 南 leads the seven fillers; others 墊 | 南 7 棟, 東 0 棟 |
| 2 | 南 leads 伶冧六 | 東 cannot 出 天; only 墊 |
| 3 | Complete dumps | 南 結 with 8 棟 |

#### TC-TGW-032 — Last trick of 2+ tiles, 0 棟 may beat

**Feature**: 結 eligibility  
**Priority**: High  
**Deal**: `pair-last`  
**Mode**: Live (東 CPU will beat to 結) or `play=all`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Six singleton 墊 tricks | 東 still 0 棟 |
| 2 | 南 leads 板凳對 | 東 打 天對 is legal |
| 3 | Complete trick | 東 結, 2 棟 |

---

### 8.4 Ordinary 結 and 賀 (Layer C)

#### TC-TGW-033 — Ordinary 結 pays into chips

**Feature**: Ordinary scoring  
**Priority**: High  
**Deal**: `forced-seven`  
**Mode**: `cpu=dump`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 南 takes all 8 棟 | Recap; all payments `to` 南; 南 chips > 100; sum 400 |
| 2 | Empty seats paid 空棟 −5 before slam | With slam on, empty base becomes 10 (七支) then 莊 ×2 → 20 from 東/北/西 if 南 is 莊 初任 — match recap, do not re-derive mid-run if unsure; engine test is the oracle |

#### TC-TGW-034 — Mid-hand 賀尊

**Feature**: 賀尊  
**Priority**: High  
**Deal**: `he-supreme`  
**Mode**: Live or `cpu=dump` (followers have no beat)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 南 selects 么三 + 大頭六, 出 至尊 | Three 墊 |
| 2 | Trick resolves | Toast 賀尊; chips `112 / 96 / 96 / 96`; 南 to lead; not recap |

#### TC-TGW-035 — 擒文尊

**Feature**: 擒文尊  
**Priority**: High  
**Deal**: `capture-on` (Live) or seed `uat-995`  
**Mode**: Live — 東 CPU captures

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 南 出 孖伶冧 | 東 打 孖高腳; 北西 墊 |
| 2 | Resolve | Toast 擒文尊; 東 leads next |

Seed fallback: `?seed=uat-995&banker=0&god=1`.

#### TC-TGW-036 — Led 文尊 unbeatable when 擒文尊 off

**Feature**: 文尊  
**Priority**: High  
**Deal**: `unbeatable-wen`  
**Mode**: Live

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Uncheck 擒文尊, load fixture, 南 出 文尊 | 東 only 墊 despite 孖高腳 |

#### TC-TGW-037 — Last-trick 至尊 is 包尊, not 賀

**Feature**: 包尊  
**Priority**: High  
**Deal**: `bao-last`  
**Mode**: `cpu=dump`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Six filler singleton tricks, then 至尊 | No 賀 toast; recap 包尊 |

#### TC-TGW-038 — 包尊亦賀

**Feature**: `baoHonorAlsoHe`  
**Priority**: Medium  
**Deal**: `bao-he`  
**Mode**: `cpu=dump`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Same as TC-TGW-037 with option on | 賀尊 toast and 包尊 recap |

#### TC-TGW-039 — 么結 / 么雙擒四

**Feature**: Special 結  
**Priority**: High  
**Deal**: construct with `play=all` (no catalog seed is reliable — CPU would beat 么三)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Arrange last singleton 么三 as 結, others 墊 | Recap 么結 ×2 on what 結 wins from below par |
| 2 | Separate run: 南 leads last 么三, 東 打 大頭六 and 結 | 么雙擒四: captured seat covers below-par losses then ×4; 入一 / 入二 still paid **by** 結, not ×4 |

If the fixture loader does not yet ship a `yao-jie` / `yao-capture` id, keep this case Blocked in the browser and cite `tests/special-settle.test.ts` as the oracle.

#### TC-TGW-040 — Option off removes the rule

**Feature**: Table  
**Priority**: Medium  
**Deal**: `example-yi-dian-hong` with `examples` off; `he-supreme` with `baoHonor` off as a second run

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 例牌 off, load 一點紅 hand | Phase is lead, not example |
| 2 | 包尊 off, last-trick 至尊 | Recap without 包尊 flag |

---

### 8.5 七支 / 八支 (Layer C)

#### TC-TGW-041 — Forced last singleton is 七支

**Feature**: Slam  
**Priority**: High  
**Deal**: `forced-seven`  
**Mode**: `cpu=dump`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 南 8 棟 via forced last 天 | Recap slam `seven` (七支), not 八支 |

#### TC-TGW-042 — 莊 first lead 天 cannot be 八支

**Feature**: Slam  
**Priority**: High  
**Deal**: `banker-tian`  
**Mode**: `cpu=dump`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | First lead 天, later 結 with a pair last trick | Recap slam `seven` |

---

### 8.6 例牌 (Layer B or C)

#### TC-TGW-050 — 一點紅, 莊 priority

**Feature**: 例牌  
**Priority**: High  
**Deal**: `example-yi-dian-hong` or seed `uat-331`  
**Mode**: Live

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 開牌 | Status 例牌窗口; 南 to act; 例牌開 enabled |
| 2 | 例牌開 | Immediate recap; 一點紅; 七支; no tricks |
| 3 | (fixture only) 東 also 一點紅 | 東 never acts; 莊 won the window |

#### TC-TGW-051 — 七武

**Priority**: High  
**Deal**: `example-qi-wu` or seed `uat-32437`  
Claim → 七武, 七支.

#### TC-TGW-052 — 全白

**Priority**: High  
**Deal**: `example-quan-bai` or seed `uat-814`  
Claim → 全白, 八支. Pair with TC-TGW-012.

#### TC-TGW-053 — 八武

**Priority**: High  
**Deal**: `example-ba-wu` or seed `uat-3775` (`banker=1` on that seed)  
Claim → 八武, 八支. On `uat-3775`, 南 is not 莊; if 南 still qualifies, window starts at 莊 then counterclockwise — follow `toAct`, do not assume 南 claims first.

#### TC-TGW-054 — 額外例牌 off: 四對子 is not 例牌

**Priority**: Medium  
**Deal**: `extra-si-dui-zi`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Default Table | Lead phase, no 例牌開 |
| 2 | Check 額外例牌, re-deal fixture | 例牌 window, 四對子, 八支 |

#### TC-TGW-055 — Skip 例牌 continues the hand

**Priority**: Medium  
**Deal**: `example-yi-dian-hong`

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 跳過例牌 | Window passes counterclockwise; if all skip, 莊 leads a normal first trick |

---

### 8.7 CPU (Layer B / C)

#### TC-TGW-060 — CPU move is always legal

**Feature**: CPU  
**Priority**: High  
**Deal**: `uat-3`, Live, `examples=0` if needed

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Watch 東北西 | Every CPU play is a highlighted legal class or 墊 of the led count; no stall |

#### TC-TGW-061 — CPU lead priority 武尊 then 文尊

**Feature**: CPU  
**Priority**: Medium  
**Deal**: give 至尊 to 東, `banker=1`, Live; or observe `uat-159` only tests **human** lead

| Step | Action | Expected |
| --- | --- | --- |
| 1 | 東 to lead with 至尊 in hand | 東 leads 至尊, not a singleton junk tile |

---

## 9. Exploratory (15 minutes, Live)

After scripted cases, one unpinned deal is allowed **only** for this section. Still record the seed from chrome.

1. 準拆: lead two of a 三文/四文武 you hold; confirm the rest stay in hand.
2. Equal-rank 武子: if 九 vs the other 九 appears, the second cannot beat.
3. Negative chips: play extra hands until someone drops below 0; hand still continues.
4. Toggle Table between hands only (never mid-hand).
5. Keyboard: tab to 開牌 / 出 / 墊.

Stop if a Critical/High defect appears; file it with seed + god screenshot of all hands.

---

## 10. Defects

| Severity | Definition |
| --- | --- |
| Critical | Lab unusable; chips do not sum to 400; deal duplicates a tile |
| High | Pinned fixture disagrees with `rules.md` / engine test |
| Medium | Workaround (god mode, reload) |
| Low | Copy, spacing, 中文 polish |

Reproduction must include: URL (seed/fixture/banker/table/cpu/play), viewport, and whether `god=1`.

---

## 11. Execution log template

```markdown
# 打天九 lab UAT log — YYYY-MM-DD

Build: local `bun run dev` @ commit ________
Harness: URL contract yes / no
Tester:

| ID | Layer | Seed / fixture | Result | Notes |
| --- | --- | --- | --- | --- |
| TC-TGW-001 | A | — |  |  |
| TC-TGW-020 | B | uat-3 | Pass / Fail / Blocked |  |

## Summary
- Planned:
- Executed:
- Passed:
- Failed:
- Blocked (harness):

## Defects
| ID | Severity | Summary | Seed / fixture |

## Go / No-Go (lab prototype)
```

---

## 12. Sign-off

**UAT for**: 打天九 lab prototype (`/lab/tien-gow`), not `TGW` rooms.

| Category | Result |
| --- | --- |
| Invariants (A) |  |
| Seeded shuffle (B) |  |
| Fixtures / rules (C) |  |
| **Total** |  |

| Name | Role | Date |
| --- | --- | --- |
|  | UAT tester |  |
|  | Game owner |  |

**Conditions**: none beyond open defects in the log.

---

## 13. Harness map

Engine tests stay the oracle. Browser cases in this plan are acceptance that the lab shows the same facts.

| Contract | Where |
| --- | --- |
| Query parse / deal | `games/tien-gow/src/lab-query.ts` |
| Fixtures | `games/tien-gow/src/uat-fixtures.ts` |
| Next-hand seed | `nextHandSeed` in `deal.ts` |
| `cpu=dump` | `dumpFollowMove` / `nextLabCpuMove` |
| Lab UI | `app/lab/tien-gow/lab-client.tsx` |
| Browser smoke | `uv run --with playwright python games/tien-gow/docs/lab-harness-check.py` (needs `bun run dev`) |
