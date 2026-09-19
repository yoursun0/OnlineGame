# 小朋友落樓梯 rules

This is the source of truth for PLAYROOM 小朋友落樓梯 (Downstairs). v1 is a realtime arcade well, not a dice board.

## Initial rules

- One well per `LAD` room. Every occupant falls in that same well at the same time.
- Occupants: 1–4 human guests. There is no CPU. A host alone may start a Solo well immediately.
- Mode is realtime. Kids move left or right at the same time; there are no turns.
- The host guest’s browser is the host simulator. Other guests send Intents (left, right, or none). The server does not step physics.
- Live Intents and host Snapshots travel on Broadcast at about 10–15 Hz. Postgres stores start, sparse Checkpoints, deaths, and finish only.
- Physics and traps follow the vendored downstairs prototype: rising platforms, life gauge, land a new platform heals, spikes damage, conveyors, springs, fragile floors, player-push, and standing on another kid’s head.
- A kid dies at 0 life or by falling off the well.
- Solo well: play until that kid dies. Shared well (2–4): last kid standing wins.
- After the host starts, further joins are rejected. No late spawn.
- If the host simulator leaves mid-fall, the well ends for everyone with finish reason `host_left`. v1 does not pass the simulator to another guest. Detection: explicit Leave (server finishes then host exits), Shared host `pagehide` keepalive, or guest Presence drop of the host after grace.
- A non-host who refreshes resumes from the last Checkpoint if one exists; otherwise they are out. Finished wells still show the result after refresh. A Solo host refresh restores the Checkpoint or the finished result (does not write `host_left`).
- v1 trusts the host simulator for positions and deaths. The server checks membership, payload size, and Checkpoint shape.
- Clients must not use WebRTC or the turn-based move endpoint for this game.
- A rematch in the same room (Replay / 重玩一次) keeps the same room code, seats, and host. Any remaining member may request it after `status = finished`, matching Connect Four: the server writes a fresh Solo or Shared start Checkpoint (no prior Game Over `result`) and sets `status` back to `playing`. Occupancy may be 1–4; the host must still be present. Leave still exits the room; Replay does not.

## Open decisions

- Checkpoint interval (seconds versus death-only).
- Whether a floors-descended score is shown beside last-alive (NS-SHAFT scoring versus prototype last-alive).
- Bilingual catalogue copy and screenshot set.
