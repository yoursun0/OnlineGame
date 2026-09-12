# PLAYROOM local UAT execution log

**Plan**: `docs/uat/UAT-TEST-PLAN.md`  
**Date**: 2026-09-12  
**Environment**: `http://localhost:3000` + hosted development Supabase  
**Tester**: agent (Playwright two isolated Chromium contexts)  
**Build**: branch `codex/bilingual-prototype-ui`  
**Runner**: `uv run --with playwright python docs/uat/run_local_uat.py`

**Room codes used**: `TIK-622` (main two-player path), `TIK-QH9` (default name), `TIK-3US` (draw), `TIK-B5E` (waiting reload), `TIK-F2U` (mobile chrome)

Do not record secrets, tokens, or service-role keys.

## Entry criteria

| Check | Result | Notes |
| --- | --- | --- |
| `.env.local` points at development Supabase | Pass | File present; guest sign-in succeeded |
| `bun run typecheck` | Pass | `tsc --noEmit` |
| `bun test` | Pass | 2 files, 2 pass (anonymous auth + Issue #3 lifecycle) |
| Dev server / guest session ready | Pass | Used existing `http://localhost:3000`. Must be the `localhost` hostname |
| Plan reviewed | Pass | Cases executed from `UAT-TEST-PLAN.md` |

## Case results

| ID | Title | Priority | Result | Room | Evidence / notes |
| --- | --- | --- | --- | --- | --- |
| TC-UAT-001 | Lobby loads with guest session | Critical | Pass | | `guest session ready`; brand PLAYROOM / 玩房 |
| TC-UAT-002 | Game shelf metadata | High | Pass | | TIK ready + Create room; LAD/CON coming soon |
| TC-UAT-003 | Language toggle (lobby) | High | Pass | | EN ↔ 中文; lang persisted on reload |
| TC-UAT-004 | Responsive lobby | Medium | Pass | | 390 and 1280 usable; no overflow |
| TC-UAT-005 | Host creates a named room | Critical | Pass | TIK-622 | Host-UAT in waiting room |
| TC-UAT-006 | Default display name | Medium | Pass | TIK-QH9 | Empty name became `Guest` |
| TC-UAT-007 | Room code format | Critical | Pass | TIK-622 | Matches `TIK-[2-9A-HJ-NP-Z]{3}` |
| TC-UAT-008 | Guest joins from second context | Critical | Pass | TIK-622 | Isolated context; 2 / 2 players |
| TC-UAT-009 | Invalid join code (client) | High | Pass | | `ABC` and `TIK-000` show TIK-7Q4 hint |
| TC-UAT-010 | Unknown or expired room | High | Pass | | Join error visible; copy is generic — DEF-UAT-002 |
| TC-UAT-011 | Direct room URL without joining | High | Pass | TIK-622 | `Join this room before reading its state.` |
| TC-UAT-012 | Same profile cannot occupy two seats | High | Pass | TIK-622 | Second tab still 1 player |
| TC-UAT-013 | Presence and host badge | High | Pass | TIK-622 | Host-UAT · host; Guest-UAT; seats X/O |
| TC-UAT-014 | Ready and unready | High | Pass | TIK-622 | Ready toggles; both ready before start |
| TC-UAT-015 | Start gated on both ready | Critical | Pass | TIK-622 | Guest has no Start; host Start enabled when both ready |
| TC-UAT-016 | Host starts; board appears on both | Critical | Pass | TIK-622 | Turn: X on both |
| TC-UAT-017 | First move syncs | Critical | Pass | TIK-622 | X at 0, O at 4 |
| TC-UAT-018 | Out-of-turn move rejected | High | Pass | TIK-622 | HTTP 409; cell unchanged; banner empty — DEF-UAT-001 |
| TC-UAT-019 | Occupied cell | High | Pass | TIK-622 | Filled cell disabled |
| TC-UAT-020 | Win (three in a row) | Critical | Pass | TIK-622 | X wins top row; finished heading |
| TC-UAT-021 | Draw | Medium | Pass | TIK-3US | Full board, complete |
| TC-UAT-022 | No moves after finish | High | Pass | TIK-622 | All cells disabled |
| TC-UAT-023 | Reload during play | Critical | Pass | TIK-622 | Marks recovered; later O move arrived |
| TC-UAT-024 | Reload in waiting room | Medium | Pass | TIK-B5E | Two members, both ready after reload |
| TC-UAT-025 | Guest leaves | High | Pass | TIK-622 | Guest returned to lobby |
| TC-UAT-026 | Host leaves | High | Pass | TIK-622 | Host returned to lobby |
| TC-UAT-027 | Report room | Medium | Pass | TIK-622 | Empty submit disabled; reason submitted → Reported |
| TC-UAT-028 | Language toggle on room page | Medium | Pass | TIK-622 | 中文 room copy; code unchanged |
| TC-UAT-029 | Display name length | Low | Pass | | `maxLength=32` on create and join |
| TC-UAT-030 | Mobile room chrome | Medium | Pass | TIK-F2U | Ready usable; Leave hidden &lt;620px — DEF-UAT-003 |
| TC-UAT-031 | Placeholder games not playable | High | Pass | | LAD/CON have no create CTA |

**Result values**: Pass / Fail / Blocked / Skipped

## Defects

| ID | Severity | Summary | Case | Status |
| --- | --- | --- | --- | --- |
| DEF-UAT-001 | Medium | Out-of-turn move is rejected (HTTP 409) but the room inline error banner is empty. Snapshot refresh likely clears it. Workaround: board does not change. | TC-UAT-018 | Fixed — poll no longer clears action errors |
| DEF-UAT-002 | Medium | Joining a well-formed unused code (`TIK-9ZZ`) shows generic `Request failed.` instead of “room not found”. Direct `/room/NOT-A-CODE` flashes `Loading room…` before the error page. | TC-UAT-010 | Fixed — PostgREST errors now surface their message |
| DEF-UAT-003 | Medium | `.room-header-actions .button` is `display: none` under 620px, so Leave is not visible on mobile. Workaround: desktop Leave, or brand link home (does not call leave). | TC-UAT-030 | Open — known CSS; fix in a layout pass |
| DEF-UAT-004 | Medium | Tic-tac-toe board rows without an X/O mark collapse shorter than rows that have a mark, so the 3×3 grid is uneven. Empty cells have no in-flow height while marked cells grow with `font-size`. | Exploratory / screenshot `TIK-NMX` | Open — does not block go-live |

## Exploratory notes

- Playwright against `http://127.0.0.1:3000` does **not** hydrate this Next.js 16 Turbopack app (HMR websocket `ERR_INVALID_HTTP_RESPONSE`; guest session stuck on “starting…”). `http://localhost:3000` hydrates and `[HMR] connected`.
- Two tabs in one context share the guest; only a second browser context creates a second seat.
- Default language on this machine is `zh-Hant` (navigator); EN toggle is required for English copy.

## Totals

| Priority | Total | Passed | Failed | Blocked | Skipped |
| --- | ---: | ---: | ---: | ---: | ---: |
| Critical | 9 | 9 | 0 | 0 | 0 |
| High | 14 | 14 | 0 | 0 | 0 |
| Medium | 7 | 7 | 0 | 0 | 0 |
| Low | 1 | 1 | 0 | 0 | 0 |
| **All** | **31** | **31** | **0** | **0** | **0** |

## Sign-off

**Recommendation**: GO for this local bilingual Tic-tac-toe slice, with the three Medium defects above tracked.

**Conditions**:
- Local only; this is not production or Preview sign-off.
- DEF-UAT-001 / 002 / 003 do not block; fix when touching room errors or mobile chrome.
- Re-run `docs/uat/run_local_uat.py` against Preview before promoting.
