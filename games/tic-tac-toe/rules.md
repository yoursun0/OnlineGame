# Tic-tac-toe rules

This is the source of truth for the first complete game vertical slice.

## Initial rules

- Two players use `X` and `O`.
- The board is 3×3.
- `X` starts unless the room snapshot explicitly assigns another seat.
- A legal move selects one empty cell during the actor's turn.
- A player wins by occupying three cells in a row, column, or diagonal.
- The game is a draw when all cells are occupied without a winner.
- The server validates and persists every move; the client only renders state and requests moves.

## Open decisions

- Whether a rematch keeps the same seats.
- Whether a disconnected player receives a grace period before the room is finished.

