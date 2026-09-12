# PLAYROOM local UAT test plan

**Project**: PLAYROOM / 玩房  
**Build under test**: local Next.js app (`bun run dev` → `http://localhost:3000`) + hosted **development** Supabase  
**UAT type**: Hybrid — scripted two-browser acceptance cases, then exploratory  
**Primary persona**: anonymous guest, no account  
**Plan date**: 2026-09-12  
**Related docs**: `PLAN.md`, `docs/PRODUCTION-HANDOFF.md`, `docs/OPERATIONS.md`, `games/tic-tac-toe/rules.md`

This is the business-facing acceptance plan. It is not a substitute for `bun test` (API lifecycle / abuse controls). Those checks are entry criteria, not UAT.

---

## 1. Strategy

### Objective

Prove that two independent guests can pick Tic-tac-toe, create and join a room with a `TIK-` code, start, play a legal game across two browsers, recover after reload, leave, and do that in both English and Traditional Chinese — without accounts.

### Approach

| Layer | Method | Owner |
| --- | --- | --- |
| Scripted UAT | Two isolated browser contexts (Playwright or Chrome + Incognito) | Agent / tester |
| Exploratory | 15 minutes on lobby, waiting room, and board after scripted cases | Agent / tester |
| API regression | `bun test` (already covers rate limits, expiry, 409/413) | CI / local gate |
| Visual | Desktop 1280×800 and mobile 390×844 | Agent / tester |

Two tabs in the **same** browser profile are invalid for two-player cases. Guest identity lives in session storage.

### Environment

| Item | Value |
| --- | --- |
| App | `http://localhost:3000` (use the `localhost` hostname, not `127.0.0.1`; Next.js HMR/hydration fails on the IP) |
| Command | `bun run dev` from repository root |
| Backend | Hosted development Supabase only |
| Secrets | `.env.local` from `.env.example`; never production |
| Browsers | Chromium (required); second engine optional |
| Languages | `en` and `zh-Hant` via the EN / 中文 toggle |
| Viewports | Desktop 1280×800; mobile 390×844 |

Do not point local UAT at production (`online-game-helic.vercel.app`) or the production Supabase project.

### Test data

| Data | Rule |
| --- | --- |
| Guest identity | Anonymous Supabase session created by the app |
| Display names | `Host-UAT`, `Guest-UAT`; also empty (defaults to `Guest` / `訪客`) |
| Room codes | Generated `TIK-[2-9A-HJ-NP-Z]{3}` |
| Invalid codes | `ABC`, `TIK-000`, `TIK-III`, `tik-7q4` (UI normalizes case), `TIK-ZZZ` (likely unused) |
| Report text | `UAT report — automated local check` |
| Moves | Cell indices 0–8, row-major (top-left = 0) |

Temporary rooms expire after six hours of idle activity. Manual UAT rooms are left to expire; `bun test` deletes its own rows.

### Roles

| Role | Seat | Browser |
| --- | --- | --- |
| Host | Seat 0 / `X` | Context A |
| Guest | Seat 1 / `O` | Context B (isolated storage) |

`X` starts unless a snapshot says otherwise (`games/tic-tac-toe/rules.md`).

---

## 2. Scope

### In scope

- Public catalogue / lobby radar
- Guest session status
- Language toggle on lobby and room
- Create-room and join-room for **Tic-tac-toe / 井字過三關** (`TIK-`)
- Waiting room: presence, ready/unready, host-only start
- Turn-based play, illegal-move rejection, win and draw
- Reload / reconnect recovery
- Leave and report
- Responsive layout (desktop + mobile)
- Placeholder cards for 小朋友落樓梯 (`LAD`) and Connect Four / 四子棋 (`CON`) — catalogue only

### Out of scope (this UAT)

- Production and Vercel Preview URLs (separate smoke in `docs/PRODUCTION-HANDOFF.md` / `docs/VERCEL-PREVIEW.md`)
- Accounts, chat, matchmaking, money
- Playing 小朋友落樓梯 or Connect Four (not available)
- Rate-limit / payload-size API abuse (covered by `tests/issue3-room-lifecycle.test.ts`)
- Local Docker / local Supabase
- Static `prototype/index.html`
- Performance, load, and accessibility audits beyond keyboard/focus smoke

---

## 3. Traceability (PLAN.md must-haves)

| Product requirement | Cases |
| --- | --- |
| Responsive public catalogue | TC-UAT-001, TC-UAT-002, TC-UAT-004 |
| Anonymous create / join | TC-UAT-005 … TC-UAT-011 |
| Game-specific short code `TIK-xxx` | TC-UAT-007 |
| Metadata: players, duration, mode | TC-UAT-002 |
| Real-time presence, ready, disconnect | TC-UAT-013 … TC-UAT-016, TC-UAT-023 |
| Turn-based recovery after refresh | TC-UAT-023, TC-UAT-024 |
| Tic-tac-toe complete game | TC-UAT-017 … TC-UAT-022 |
| Chinese card for 小朋友落樓梯 | TC-UAT-002, TC-UAT-031 |
| Report / leave | TC-UAT-025 … TC-UAT-027 |
| No account / guest session | TC-UAT-001, TC-UAT-012 |

---

## 4. Entry criteria

- [ ] `.env.local` present and pointed at **development** Supabase
- [ ] `bun run typecheck` passes
- [ ] `bun test` passes (starts local Next.js if `PLAYROOM_TEST_URL` is unset)
- [ ] `bun run dev` serves `/` and footer shows guest session ready (EN) / 訪客工作階段已就緒 (中文)
- [ ] This plan reviewed; cases below are the script

## 5. Exit criteria

- [ ] All **Critical** and **High** cases passed
- [ ] No open Critical or High defects
- [ ] Medium/Low defects logged with workaround
- [ ] Execution log filled (`docs/uat/UAT-EXECUTION-LOG.md`)
- [ ] Go / No-Go recorded

### Severity

| Severity | Meaning | Go-live |
| --- | --- | --- |
| Critical | Two players cannot create, join, start, or see each other's moves | Block |
| High | Core room/play/reconnect broken; no workaround | Block |
| Medium | Workaround exists (e.g. leave hidden on narrow viewport) | Document |
| Low | Copy, polish, bilingual inconsistency | Document |

---

## 6. Test cases

Use two isolated contexts unless the case says otherwise. Record **room code**, **Actual result**, and **Pass/Fail** in the execution log.

### 6.1 Lobby and catalogue

#### TC-UAT-001 — Lobby loads with guest session

**Feature**: Catalogue  
**Priority**: Critical  
**Prerequisite**: Dev server up; `.env.local` valid  
**Viewports**: Desktop and mobile

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/` in a clean context | Title/brand `PLAYROOM` / `玩房`; hero and catalogue visible |
| 2 | Wait for footer session chip | `guest session ready` (EN) or `訪客工作階段已就緒` (中文) |
| 3 | Confirm privacy copy | Footer states anonymous / temporary guest sessions |
| 4 | Confirm no login form | No email, password, or OAuth |

#### TC-UAT-002 — Game shelf metadata

**Feature**: Catalogue  
**Priority**: High

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Inspect Tic-tac-toe card | Prefix `TIK`, 2 players, ~5 min, turn-based, status Ready / 可以開局, Create room CTA |
| 2 | Inspect 小朋友落樓梯 card | Prefix `LAD`, 2–4 players, Coming soon / 即將推出, **no** create button, `aria-disabled` |
| 3 | Inspect Connect Four card | Prefix `CON`, 2 players, Coming soon, **no** create button |

#### TC-UAT-003 — Language toggle (lobby)

**Feature**: Bilingual UI  
**Priority**: High

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click **中文** | Hero, catalogue, join, how-it-works, footer switch to zh-Hant; `document.documentElement.lang` is `zh-Hant` |
| 2 | Reload | Language stays 中文 (`playroom-language` in localStorage) |
| 3 | Click **EN** | Copy returns to English; `lang=en` |

#### TC-UAT-004 — Responsive lobby

**Feature**: Layout  
**Priority**: Medium  
**Viewports**: 1280×800 and 390×844

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Desktop | Hero + radar side by side; game grid shows featured + two placeholders |
| 2 | Mobile | Single column; join fields stack; no horizontal overflow; Create / Join still usable |

### 6.2 Create and join

#### TC-UAT-005 — Host creates a named room

**Feature**: Create room  
**Priority**: Critical  
**Contexts**: A only

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | On Tic-tac-toe card, click Create room / 建立房間 | Display name + disabled Turn-based mode appear |
| 2 | Enter `Host-UAT`, submit | Redirect to `/room/TIK-xxx` |
| 3 | Read waiting room | Code badge matches URL; one player `Host-UAT · host`; status waiting |

#### TC-UAT-006 — Default display name

**Feature**: Create room  
**Priority**: Medium

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Create room with empty name | EN uses `Guest`; 中文 uses `訪客` |

#### TC-UAT-007 — Room code format

**Feature**: Room codes  
**Priority**: Critical

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Capture code from TC-UAT-005 | Matches `TIK-[2-9A-HJ-NP-Z]{3}` (no `0`,`1`,`I`,`O`) |
| 2 | Confirm header badge equals path | `/room/TIK-…` case-insensitive; UI shows uppercase |

#### TC-UAT-008 — Guest joins from a second context

**Feature**: Join room  
**Priority**: Critical  
**Contexts**: A = host room from TC-UAT-005; B = clean context

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | B: open `/`, guest session ready | Independent guest (different session) |
| 2 | B: enter A's code + name `Guest-UAT`, Join | Redirect to `/room/{code}` |
| 3 | A and B | Both lists show 2 / 2 players; seats X and O |

#### TC-UAT-009 — Invalid join code (client)

**Feature**: Join validation  
**Priority**: High  
**Context**: B

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Join `ABC` | Error: use a code like `TIK-7Q4` / 請輸入類似 TIK-7Q4 的房號 |
| 2 | Join `TIK-000` | Same client validation (0 not in alphabet) |
| 3 | Join `tik-7q4` format-valid lowercase | Client uppercases; if room missing, server error not format error |

#### TC-UAT-010 — Unknown or expired room

**Feature**: Join errors  
**Priority**: High

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Join a well-formed unused code e.g. `TIK-ZZZ` (if unused) | Visible error, stay on lobby; no crash |
| 2 | Open `/room/NOT-A-CODE` | Room error page with Back to lobby |

#### TC-UAT-011 — Direct room URL without joining

**Feature**: Authorization  
**Priority**: High  
**Context**: C (third clean context) or B before join

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Visit `/room/{liveCode}` without using Join | Error: join this room before reading its state (or translated). Not a playable waiting room |

#### TC-UAT-012 — Same profile cannot occupy two seats

**Feature**: Guest identity  
**Priority**: High

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Host room in Context A | One member |
| 2 | Open same URL in a **second tab of A** (shared session) | Same guest; still one member, not two players |
| 3 | Contrast with isolated Context B | Second member appears only in B |

### 6.3 Waiting room

#### TC-UAT-013 — Presence and host badge

**Feature**: Presence  
**Priority**: High  
**Prerequisite**: TC-UAT-008

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Compare A and B sidebars | Host has `host` / `房主`; names match; seats X then O |

#### TC-UAT-014 — Ready and unready

**Feature**: Ready state  
**Priority**: High

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | A clicks I’m ready / 我準備好了 | A shows Ready; B sees A's Ready within a few seconds |
| 2 | A clicks Unready / 取消準備 | Both show Waiting again |
| 3 | Both click ready | Both Ready |

#### TC-UAT-015 — Start gated on both ready

**Feature**: Start  
**Priority**: Critical

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Only host ready | Host Start button disabled; label Waiting for both players / 等待兩位玩家準備 |
| 2 | Guest is not host | Guest has no Start control |
| 3 | Both ready | Host Start enabled: Start game → / 開始遊戲 → |

#### TC-UAT-016 — Host starts; board appears on both

**Feature**: Start  
**Priority**: Critical

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Host starts | Both show 3×3 board; heading Turn: X / 輪到: X; status playing |

### 6.4 Play (Tic-tac-toe)

Cell map:

```text
0 1 2
3 4 5
6 7 8
```

#### TC-UAT-017 — First move syncs

**Feature**: Moves  
**Priority**: Critical

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Host (X) plays cell 0 | Cell 0 shows X on **both** boards; turn becomes O |
| 2 | Guest (O) plays cell 4 | Cell 4 shows O on both; turn X |

#### TC-UAT-018 — Out-of-turn move rejected

**Feature**: Rules  
**Priority**: High

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | After X just moved, X immediately plays another empty cell | Error: not this player's turn / 還未輪到這位玩家; board unchanged |

#### TC-UAT-019 — Occupied cell

**Feature**: Rules  
**Priority**: High

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click a filled cell | Button disabled; no extra mark |

#### TC-UAT-020 — Win (three in a row)

**Feature**: Rules  
**Priority**: Critical  
**Setup**: New room; play X:0, O:3, X:1, O:4, X:2

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Complete the sequence | Status finished; heading Game complete — final board / 遊戲結束 — 最終棋局 |
| 2 | Both browsers | Same X X X top row; cells not playable |

#### TC-UAT-021 — Draw

**Feature**: Rules  
**Priority**: Medium  
**Setup**: New room; fill board with no three-in-a-row (any legal draw sequence)

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Last empty cell filled, no winner | Finished / complete; board full; no further moves |

#### TC-UAT-022 — No moves after finish

**Feature**: Rules  
**Priority**: High  
**Prerequisite**: TC-UAT-020

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click any cell | Disabled; no version bump |

### 6.5 Recovery

#### TC-UAT-023 — Reload during play

**Feature**: Reconnect  
**Priority**: Critical

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Mid-game (after at least one move), reload Context A | Same code, members, marks, turn, version |
| 2 | Other player moves | Reloaded browser still receives the move |

#### TC-UAT-024 — Reload in waiting room

**Feature**: Reconnect  
**Priority**: Medium

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Both ready, not started; reload guest | Still two members, ready flags preserved |

### 6.6 Leave, report, placeholders

#### TC-UAT-025 — Guest leaves

**Feature**: Leave  
**Priority**: High  
**Viewport**: Desktop (Leave is in the header)

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Guest clicks Leave room / 離開房間 | Guest returns to lobby |
| 2 | Host | Guest no longer listed (or room expires per server rules) |

#### TC-UAT-026 — Host leaves

**Feature**: Leave  
**Priority**: High

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Host leaves an open or finished room | Host returns to lobby; room is not joinable as a live waiting room |

#### TC-UAT-027 — Report room

**Feature**: Report  
**Priority**: Medium

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Enter reason `UAT report — automated local check`, submit | Button shows Reported / 已舉報; play continues |
| 2 | Empty reason | Submit stays disabled |

#### TC-UAT-028 — Language toggle on room page

**Feature**: Bilingual UI  
**Priority**: Medium

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | In a live room, switch EN ↔ 中文 | Room, players, ready, start, leave, report, board aria labels switch; code unchanged |

#### TC-UAT-029 — Display name length

**Feature**: Validation  
**Priority**: Low

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Type >32 characters in create/join name | Input `maxLength=32`; cannot submit longer |

#### TC-UAT-030 — Mobile room chrome

**Feature**: Layout  
**Priority**: Medium  
**Viewport**: 390×844  
**Known product behavior**: CSS hides `.room-header-actions .button` under 620px, so **Leave is not visible on mobile**.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open waiting room on mobile | Code badge wraps; board/sidebar stack; no overflow |
| 2 | Look for Leave | Document whether Leave is hidden; if hidden, Medium defect (workaround: desktop or Back to lobby via brand) |
| 3 | Ready / Start / board | Still usable |

#### TC-UAT-031 — Placeholder games are not playable

**Feature**: Catalogue  
**Priority**: High

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click 小朋友落樓梯 / Connect Four cards | No create/join for `LAD` / `CON`; no room created |

---

## 7. Exploratory charter (15 minutes)

After scripted cases, spend 15 minutes hunting:

- Double-click Create / Ready / Start
- Paste room code with spaces
- Share code then join before host finishes loading
- Switch language mid-create form
- `prefers-reduced-motion`
- Brand link home from room
- Two guests trying to join a full room (3rd context)

Log anything not covered by a case as a defect or a new case.

---

## 8. Execution notes

1. Run `bun run typecheck` and `bun test` first (entry).
2. Use an already-running `bun run dev` at `http://localhost:3000`. Do not use `http://127.0.0.1:3000` — Next.js Turbopack HMR does not hydrate against the IP, so guest session stays on “starting…”.
3. Execute the scripted cases:

```powershell
uv run --with playwright python docs/uat/run_local_uat.py
```

4. Repeat language-sensitive cases once in `zh-Hant` (the runner already toggles both).
5. Repeat layout cases at 390×844 (included in the runner).
6. Record results in `docs/uat/UAT-EXECUTION-LOG.md`.
7. Do not use production credentials or paste secrets into the log. Room codes are identifiers, not secrets.

### Automation mapping

| Skill / tool | Use |
| --- | --- |
| `uat-planning` | This document's structure |
| `webapp-testing` | Playwright scripts, two contexts, screenshots |
| `playroom-localhost-test` | Localhost catalogue / create / join / prefix smoke |
| `bun test` | API lifecycle, not UI |

---

## 9. Sign-off template

Fill after execution.

```markdown
# UAT Sign-off — PLAYROOM local

**Period**:
**Environment**: http://localhost:3000 + development Supabase
**Recommendation**: GO / NO-GO

## Summary
| Priority | Total | Passed | Failed | Blocked | Skipped |
| --- | ---: | ---: | ---: | ---: | ---: |
| Critical |  |  |  |  |  |
| High |  |  |  |  |  |
| Medium |  |  |  |  |  |
| Low |  |  |  |  |  |

## Open defects
| ID | Severity | Summary | Decision |

## Conditions
```
