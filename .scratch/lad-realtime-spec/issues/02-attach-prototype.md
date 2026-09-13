# Attach the local-browser prototype

Type: task
Status: resolved
Blocked by:

## Question

Where is the existing local-browser multiplayer prototype for 小朋友落樓梯, and what should this spec treat as the feel and rules source of truth?

The file is not in this repo (`games/little-stairs` is a turn-based placeholder; `prototype/index.html` is lobby-only). Owner must point at a path, zip, or repo. Record: player count, controls, win/lose, whether multiple kids share one well, and anything the arcade-rules research should not override.

## Answer

Vendored at `D:\My-AI-Portfolio\Projects\OnlineGame\games\downstairs\prototype` from https://github.com/yoursun0/downstairs `main` @ `ae5e206`. Pointer: `games/downstairs/prototype/SOURCE.md`.

Treat that tree as feel/rules source of truth for PLAYROOM, **except** Grok auth, PGlite, and `src/lib/multiplayer/p2p.ts` (WebRTC) — those are scaffolding, not the Playroom contract.

- Players: 1 or 2–4 in one shared well (same machine, not online).
- Controls: P1 arrows; P2 Z/X or A/D; P3 V/B; P4 comma/period.
- Win/lose: life gauge (land new platform +1, spikes −5); death at 0 life or falling off; **multiplayer last alive wins**.
- Extra vs NS-SHAFT research: fragile/flip floors, player-push, stand on another kid’s head. Keep these unless a later grilling ticket drops them.
