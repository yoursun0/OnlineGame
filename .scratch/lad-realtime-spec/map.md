# 小朋友落樓梯 real-time PLAYROOM spec

## Destination

A locked spec, ready for `playroom-implement-game`, for 小朋友落樓梯 (`little-stairs`, `LAD`) as a **real-time arcade** falling-stairs game: 1-player `LAD` rooms or 2–4 player **shared well** race/survival; lobby/guest/create-join unchanged; **host simulator** runs the well during play; server stores seed, checkpoints, deaths, and finish — not per-frame positions. This effort does not implement the production game.

## Notes

- Domain: PLAYROOM platform + `games/little-stairs`. Consult `grilling`, `domain-modeling`, `playroom-implement-game`, `research`.
- Tracker and all wayfinder/research notes live only under `D:\My-AI-Portfolio\Projects\OnlineGame\.scratch\` (this effort: `D:\My-AI-Portfolio\Projects\OnlineGame\.scratch\lad-realtime-spec\`). Never write these files to `docs/`, a Codex worktree, or a path named `OnlineGame.scratch`.
- Plan, don't ship game code. Override `games/little-stairs/AGENTS.md` (turn-based placeholder) only in the finished spec, not mid-map.
- Game 1/2 remain server-authoritative **turns**. Game 3 play is **A-host**: host browser simulates; server is still the room/checkpoint authority (ADR 0002 for membership and saves, not for 60 fps).
- Solo well = 1-player `LAD` room, no CPU. Prototype path is still unknown; treat attached prototype as feel/rules source once [Attach the local-browser prototype](issues/02-attach-prototype.md) lands.
- Refer to tickets by title. Do not reuse Tic-tac-toe `POST /move` for physics.

## Decisions so far

- [Can Playroom carry host-simulated well traffic](issues/01-well-transport.md) — Broadcast Intents/Snapshots at 10–15 Hz; Postgres only for start/checkpoints/outcomes. Detail: [research/01-well-transport.md](research/01-well-transport.md).
- [Classic arcade 小朋友落樓梯 rules](issues/03-arcade-rules.md) — NS-SHAFT canon: life gauge, moving shaft, score = floors, local 2P same well. Detail: [research/03-arcade-rules.md](research/03-arcade-rules.md).

## Not yet specified

- Physics constants, stair RNG, camera, controls, and art — hang on the prototype.
- Whether PLAYROOM copies NS-SHAFT scoring (floors + lives) or a race-to-bottom; locked in [What counts as winning a shared well](issues/04-shared-well-outcome.md).
- Whether a late joiner can drop into a live well (spawn, spectate, or reject) beyond the start-ritual ticket.
- How host simulation would migrate if host-leave chooses “pass the well”.
- Bilingual catalogue copy and screenshot set.
- Checkpoint interval numbers (seconds vs death-only).

## Out of scope

- Dedicated tick server (option D).
- WebRTC / true P2P (option B).
- CPU opponent (Connect Four’s solo pattern).
- Turn-based dice-board 小朋友落樓梯.
- Production implementation, Vercel deploy, and catalogue wiring beyond what the spec must name.
- Accounts, ratings, chat, spectators as a product mode (unless a reconnect ticket forces a spectate *state*).
