# 小朋友落樓梯 local instructions

- Keep the room prefix as `LAD`.
- Read `rules.md` before changing game behavior. That file is the accepted v1 ruleset.
- Mode is realtime only. Do not reintroduce a turn-based or dice-board variant.
- Treat `prototype/` as feel and physics reference (vendored from https://github.com/yoursun0/downstairs `main` @ `ae5e206`). Do not copy its WebRTC, Grok auth, or PGlite scaffolding into PLAYROOM.
- The host guest’s browser simulates the well. The server stores start, sparse checkpoints, deaths, and finish — never per-frame positions.
- Live Intents and Snapshots go over Broadcast. Do not send physics through the turn-based move path.
- No CPU occupant. A 1-player room is a Solo well.
- Do not change lobby, Supabase schema, or shared protocol files as part of a game-only change unless the task explicitly includes that boundary.
- Add or update focused game tests with every rules change.
