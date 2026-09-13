# Little Stairs

Real-time arcade 小朋友落樓梯 inside a PLAYROOM `LAD` room. One well per room. The host’s browser simulates play; the server owns the room and checkpoints.

## Language

**Well**:
The single falling-stairs playfield shared by everyone in one `LAD` room.
_Avoid_: Board, map, instance, world

**Host simulator**:
The host guest’s browser, which runs the well during play.
_Avoid_: Dedicated server, peer, referee server, P2P host

**Intent**:
A player’s control for a short interval: left, right, or none. Not a position and not a turn.
_Avoid_: Move, turn, click

**Snapshot**:
The host simulator’s current well (kid positions, stairs, clock) sent to other guests.
_Avoid_: Room snapshot (that word already means the Postgres room row)

**Checkpoint**:
A server-stored well save used after refresh or reconnect. Rare. Not a per-frame Snapshot.
_Avoid_: Event log frame, move row

**Solo well**:
A 1-player `LAD` room. The only kid is the host. No CPU.
_Avoid_: CPU mode, practice board

**Shared well**:
A 2–4 player `LAD` room. Every kid falls in the same well at the same time.
_Avoid_: Split-screen, separate races, hot-seat
