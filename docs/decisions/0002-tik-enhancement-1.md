# 0002 — Tic-tac-toe post-game and turn headlines

## Status

Accepted.

## Context

Local UAT of the bilingual Tic-tac-toe room (`TIK-`) showed three gaps after a game is in progress or finished:

1. The heading `輪到: X` / `Turn: X` does not name the seated guest, so players forget who is X or O.
2. A finished game always says `遊戲結束 — 最終棋局` / `Game complete — final board`, including draws and wins.
3. There is no way for the same two guests to start another board without leaving and creating a new room.

This decision is a product requirement for the Tic-tac-toe vertical slice. It closes the open rematch question in `games/tic-tac-toe/rules.md`.

## Decision

### 1. Turn heading includes the display name

While `status = playing`, the room heading is:

| Language | Pattern | Example |
| --- | --- | --- |
| English | `Turn: {mark} · {displayName}` | `Turn: X · aa` |
| 中文 | `輪到: {mark} · {displayName}` | `輪到: X · aa` |

`{mark}` is `X` (seat 0) or `O` (seat 1). `{displayName}` is that seat’s current room display name. If a name is missing, show the mark only.

### 2. Draw heading

When the adapter status is `draw` (full board, no three-in-a-row):

| Language | Heading |
| --- | --- |
| English | `Game complete — draw` |
| 中文 | `遊戲結束 — 和局` |

Do not use `最終棋局` / `final board` for a draw.

### 3. Win heading names the winner

When the adapter status is `won`, name the winning guest and mark. Do not use `最終棋局` / `final board`.

| Language | Pattern | Example |
| --- | --- | --- |
| English | `Game complete — {mark} · {displayName} wins` | `Game complete — X · aa wins` |
| 中文 | `遊戲結束 — {mark} · {displayName} 獲勝` | `遊戲結束 — X · aa 獲勝` |

The loser is implied. Do not add a separate lose line.

### 4. Replay in the same room

When `status = finished` and both original seats are still members, either member may press **Replay** / **重玩一次**.

Replay must:

- keep the same room code, guests, seats, and host;
- reset the board to the Tic-tac-toe initial state (`X` to move, `moveCount` 0);
- set room `status` back to `playing`;
- append a server-authoritative `replay` event and bump `version`;
- reject replay if the room is not finished, a member is missing, or the caller is not a member.

The server remains authoritative. Clients only request `action: "replay"`.

## Consequences

- `games/tic-tac-toe/rules.md` records rematch-keeps-seats as an accepted rule.
- A new Supabase migration adds `replay_room_for_guest`. Do not edit an applied migration.
- Lobby catalogue copy is unchanged.
- Preview/production need the new migration before Replay works there.
