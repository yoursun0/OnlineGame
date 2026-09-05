---
name: playroom-implement-game
description: Implement or extend one PLAYROOM game module while preserving the shared game contract. Use when adding a game, changing game rules, or changing a game-specific UI.
---

# Implement a PLAYROOM game

1. Read the repository `AGENTS.md` and the target game's nearest `AGENTS.md`.
2. Read the target game's `rules.md` and identify accepted rules versus open decisions.
3. Keep lobby and shared protocol changes separate unless the requested task explicitly includes them.
4. Implement deterministic server-side move validation and focused tests before broad UI work.
5. Use the game's registered room prefix and preserve the common adapter shape.
6. Run the narrowest relevant test, then the repository check before reporting completion.

Completion means the game-specific files, rules, tests, and any contract changes are clearly listed and the relevant check has passed.

