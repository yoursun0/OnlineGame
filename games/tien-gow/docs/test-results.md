# 打天九 lab UAT results

**Date**: 2026-09-16  
**Plan**: `games/tien-gow/docs/test-plan.md`  
**Build**: local `bun run dev` @ `b0eabe8`  
**App**: `http://localhost:3000/lab/tien-gow`  
**Tester**: agent (Playwright Chromium / Chrome; desktop 1280×800, mobile 390×844 for TC-TGW-011)  
**Engine oracle**: `bun test games/tien-gow` — 60 pass  
**Harness**: URL contract yes (`seed` / `fixture` / `cpu` / `play` / `god`)  
**Runner**: `games/tien-gow/docs/run-uat.py` plus focused re-checks for 032 / 035 / 040 / 054

Do not record secrets.

## Entry criteria

| Check | Result |
| --- | --- |
| `bun test games/tien-gow` | Pass (60) |
| `bun run dev` serves `/lab/tien-gow` | Pass |
| URL contract in lab chrome | Pass |
| Plan reviewed | Pass |

## Case results

| ID | Title | Layer | Priority | Pin | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-TGW-001 | Lab loads without guest session | A | Critical | — | Pass | kicker lab / not in catalogue; 南東北西; 開牌 |
| TC-TGW-002 | Table defaults and lock | A | High | — | Fail | Defaults and 文尊→擒文尊 disable OK. **么雙擒四 stays enabled after 么結 off** (DEF-TGW-001) |
| TC-TGW-003 | 32 unique tiles, 8 each | A | Critical | `god=1&seed=uat-3&banker=0` | Pass | 8×4; two of each 文子 |
| TC-TGW-004 | CPU hands hidden by default | A | High | `seed=uat-3&examples=0` | Pass | 東北西 backs; 墊 face-down |
| TC-TGW-005 | God mode shows all hands | A | High | `god=1&seed=uat-3` | Pass | four face-up hands; 墊 still backs |
| TC-TGW-006 | Combination picker rejects mixed class | A | High | `seed=uat-3` | Pass | 天+七 no 出; 孖高腳 → 出 文對 高腳七 |
| TC-TGW-007 | 墊 is always offered on follow | A | High | `lab-smoke banker=1` | Pass | 墊 button while following |
| TC-TGW-008 | Counterclockwise 上家 before 下家 | A | High | `must-dump cpu=dump` | Pass | 東 then 北 then 西 `to-act` |
| TC-TGW-009 | Chip conservation | A | Critical | `he-supreme` | Pass | after 賀尊 `[112, 96, 96, 96]` sum 400 |
| TC-TGW-011 | Mobile layout | A | Medium | 390×844 | Pass | 開牌 visible; 南 hand / picker after scroll |
| TC-TGW-012 | 天 paint vs 例牌 red count | A/C | Medium | `example-quan-bai` | Pass | 天 has 4 display-red pips; 全白 still claims. Slam label is English `eight` (DEF-TGW-002) |
| TC-TGW-013 | Red pips are 1 and 4 only | A | Low | `uat-3` | Pass | 地:2 人:8 和:1 紅頭十:4 高腳七:1 伶冧六:1 |
| TC-TGW-014 | Recap reveals 墊牌 | A | Medium | `must-dump` | Fail | Recap is 棟 / 籌碼 / flags / payments only. `revealedHidden` never rendered (DEF-TGW-003) |
| TC-TGW-020 | Same seed, same deal | B | Critical | `uat-3 banker=0` | Pass | 南 matches catalog; reload + 重開牌局 identical |
| TC-TGW-021 | Different seed, different deal | B | High | `uat-3` / `lab-smoke` | Pass | |
| TC-TGW-022 | Full Live hand on a known seed | B | Critical | `lab-smoke banker=1 examples=0` | Pass | recap; chips `[95, 94, 112, 99]` sum 400 |
| TC-TGW-023 | 下一局 飛莊 | B | High | same | Pass | seed `lab-smoke` → `lab-smoke:hand-1`; chips carried; 莊 seat 2 |
| TC-TGW-024 | 重開牌局 resets chips | B | Medium | same | Pass | chips `[100,100,100,100]`; pinned `banker=1` kept |
| TC-TGW-H01 | Harness chrome | B | High | `he-supreme` / `uat-331` | Pass | seed, fixture, 莊, play, cpu, Table shown |
| TC-TGW-030 | Lead, beat, 墊 on a frozen deal | C | Critical | `must-dump cpu=dump` | Pass | 南 1 棟 after 板凳 + dumps |
| TC-TGW-031 | 0 棟 must 墊 the last singleton | C | High | `must-dump cpu=dump` | Pass | 東 held 天 and 墊; 南 結 8 棟 |
| TC-TGW-032 | Last trick of 2+ tiles, 0 棟 may beat | C | High | `pair-last play=all` | Pass | Recheck: six dumps then 南 板凳對, 東 天對 結 with 2 棟. First Live run failed because CPU beat early tricks (script, not product) |
| TC-TGW-033 | Ordinary 結 pays into chips | C | High | `forced-seven cpu=dump` | Pass | 棟 `[8,0,0,0]`; chips `[160,80,80,80]`; 七支×莊 |
| TC-TGW-034 | Mid-hand 賀尊 | C | High | `he-supreme cpu=dump` | Pass | toast 賀尊; chips `[112,96,96,96]`; 南 still to lead |
| TC-TGW-035 | 擒文尊 | C | High | `capture-on` Live | Fail | 南 led 文尊. 東 played 孖高腳 as **文對**, 北 then beat with **紅頭十對**, won the trick, collected **賀尊**, and led. Capturer did not collect and did not lead. See DEF-TGW-004 |
| TC-TGW-036 | Led 文尊 unbeatable when 擒文尊 off | C | High | `unbeatable-wen` | Pass | no 擒文尊; 東 墊 |
| TC-TGW-037 | Last-trick 至尊 is 包尊, not 賀 | C | High | `bao-last cpu=dump` | Pass | recap 包尊; no last-trick 賀尊 toast |
| TC-TGW-038 | 包尊亦賀 | C | Medium | `bao-he cpu=dump` | Pass | 賀尊 toast and 包尊 recap |
| TC-TGW-039 | 么結 / 么雙擒四 | C | High | — | Blocked | No `yao-jie` / `yao-capture` fixture. Oracle: `tests/special-settle.test.ts` |
| TC-TGW-040 | Option off removes the rule | C | Medium | `examples=0` / 包尊 off | Pass | Recheck: 一點紅 + `examples=0` → 你出, no 例牌開. Last-trick 至尊 with 包尊 off → recap has no 包尊 (八支 empty 40×3) |
| TC-TGW-041 | Forced last singleton is 七支 | C | High | `forced-seven` | Pass | slam `seven` (English label DEF-TGW-002) |
| TC-TGW-042 | 莊 first lead 天 cannot be 八支 | C | High | `banker-tian` | Pass | slam `seven` not `eight` |
| TC-TGW-050 | 一點紅, 莊 priority | C | High | `example-yi-dian-hong` | Pass | 南 例牌開 → 一點紅 |
| TC-TGW-051 | 七武 | C | High | `example-qi-wu` | Pass | |
| TC-TGW-052 | 全白 | C | High | `example-quan-bai` | Pass | |
| TC-TGW-053 | 八武 | C | High | `example-ba-wu` | Pass | |
| TC-TGW-054 | 額外例牌 off: 四對子 is not 例牌 | C | Medium | `extra-si-dui-zi` | Fail | 南 is 四對子 (no 例牌開). **西 leftover is 八武**, so the window still opens (DEF-TGW-005) |
| TC-TGW-055 | Skip 例牌 continues the hand | C | Medium | `example-yi-dian-hong` | Pass | 南 跳過; 東 claimed 一點紅 |
| TC-TGW-060 | CPU move is always legal | B | High | `uat-3 examples=0` | Pass | CPU finished a trick without stall |
| TC-TGW-061 | CPU lead priority 武尊 then 文尊 | C | Medium | — | Blocked | No fixture with 至尊 on 東 and 莊=1 |
| TC-TGW-E01 | Exploratory 準拆 + keyboard | E | Low | `uat-3` | Pass | led 雜九; two 高腳七 remained in 南 |

## Summary

| Result | Count |
| --- | ---: |
| Planned | 41 |
| Passed | 35 |
| Failed | 4 |
| Blocked | 2 |

| Priority | Passed | Failed | Blocked |
| --- | ---: | ---: | ---: |
| Critical | 5 | 0 | 0 |
| High | 21 | 2 | 1 |
| Medium | 7 | 2 | 1 |
| Low | 2 | 0 | 0 |

## Defects

| ID | Severity | Summary | Case | Pin |
| --- | --- | --- | --- | --- |
| DEF-TGW-001 | Medium | Unchecking 么結 unchecks 么雙擒四 but does **not** disable the box. It can be checked again while 么結 is off. `mergeTable` would clear it on deal; the Table UI still lies. 擒文尊 is correctly disabled when 文尊 is off. | TC-TGW-002 | `/lab/tien-gow` |
| DEF-TGW-002 | Low | 結 recap prints slam as English `seven` / `eight` instead of 七支 / 八支 (`state.recap.flags.slam` dumped raw). | TC-TGW-012, 041 | `example-quan-bai`, `forced-seven` |
| DEF-TGW-003 | Medium | 結 recap never shows 墊牌 faces. Engine stores `recap.revealedHidden`; the lab table only shows 棟, 籌碼, flags, and payments. | TC-TGW-014 | `must-dump` |
| DEF-TGW-004 | High | **擒文尊 does not close the trick.** After 南 led 文尊, 東’s 孖高腳 was logged as `beat 文對 高腳七`. 北 then `beat 文對 紅頭十`, won (2 棟), collected **賀尊**, and led 斧頭. Rules: 孖高腳 that 擒文尊 collects as 賀尊 and **leads next**. Engine unit test only `dump`s after the capture, so this path was untested. Fixture `capture-on` leaves 孖紅頭十 on 北, which is enough to expose it in Live CPU. | TC-TGW-035 | `god=1&fixture=capture-on` |
| DEF-TGW-005 | Medium | Fixture `extra-si-dui-zi` uses `fillHands` remainder; 西 is eight 武子 (**八武**). With 例牌 on and 額外例牌 off, 南 has no 例牌 but the window still opens for 西. TC-TGW-054 cannot prove “四對子 is not 例牌” until the leftover hand is not 例牌. | TC-TGW-054 | `extra-si-dui-zi` |

### DEF-TGW-004 evidence (lab public log)

```
莊 南位
南位 lead 文尊
東位 beat 文對 高腳七
北位 beat 文對 紅頭十
西位 墊 2
北位 wins trick (2 棟)
賀尊
北位 lead 單文 斧頭
```

Expected: 東 擒文尊, toast 擒文尊, 東 leads next. 北 must 墊, not beat.

## Exploratory

- 準拆 雜九 on `uat-3` left the rest of 南 (including 孖高腳七) in hand.
- Keyboard Tab reaches 開牌.
- Slam empty-base arithmetic on 莊 八支 (`040` 包尊 off, 8 棟): 40 from each other seat, chips `220 / 60 / 60 / 60`, sum 400.

## Go / No-Go (lab prototype)

**NO-GO** until DEF-TGW-004 is fixed. Core 擒文尊 scoring/lead is wrong in Live 1H+3CPU on a documented fixture. Other High scripted cases passed.

Not a production `TGW` room release.

## Follow-ups

1. After 擒文尊, keep the trick as unbeatable capture (or force remaining seats to 墊) and pay 擒文尊 to the 孖高腳 seat; add a test where 北 holds a higher 文對.
2. Disable 么雙擒四 when 么結 is off (same pattern as 擒文尊 / 文尊).
3. Render 墊牌 faces on 結 recap; print 七支 / 八支.
4. Rebuild `extra-si-dui-zi` so no other seat is 例牌.
5. Add `yao-jie` / `yao-capture` fixtures and a 東-holds-至尊 fixture to unblock TC-TGW-039 and TC-TGW-061.
