# ADR 0001: Keep games in the PLAYROOM monorepo

## Status

Accepted for the first public release cycle.

## Context

PLAYROOM will host multiple anonymous multiplayer games. Each game should have independent rules, tests, and UI, while all games share room creation, guest sessions, Supabase persistence, Realtime transport, and Vercel deployment.

## Decision

Use one Git repository. Model games as independent modules under `games/` and expose a stable shared contract from `packages/game-core/`. Keep the platform shell and all games versioned together until an independent release boundary is proven.

## Consequences

- Cross-cutting changes are easier to review and test atomically.
- Local development and Vercel deployment have one entry point.
- A future game can still be extracted with its history when an independent repository becomes worthwhile.
- A game must respect the platform boundary and should not reach into unrelated games.

