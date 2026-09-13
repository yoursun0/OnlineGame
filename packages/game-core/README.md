# game-core

Shared game adapter contract and server-authoritative state types belong here.

The package should stay independent of the lobby UI and should not contain game-specific rules.

Turn-based games implement `GameAdapter` and apply board moves through `validateMove` / `applyMove`.

Realtime well traffic is a separate contract: `WellIntent` (`left` / `right` / `none`), host `WellSnapshot`, and sparse `WellCheckpoint`. Those payloads are not board moves and must not go through the per-turn move path.

