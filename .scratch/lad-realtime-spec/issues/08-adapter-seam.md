# GameAdapter seam for a well

Type: grilling
Status: open
Blocked by: 07

## Question

Does realtime `LAD` extend `GameAdapter` (intents, checkpoints, status) so the portal stays game-agnostic, or keep `validateMove` for room lifecycle only and put the well on a side channel?

Consequence: either a shared-contract change in `packages/game-core` or a game-specific Realtime channel the lobby barely knows about. Pick one.
