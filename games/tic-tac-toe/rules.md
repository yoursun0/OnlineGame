# Tic-tac-toe rules

This is the source of truth for the first complete game vertical slice.

## Initial rules

- Two occupants use `X` and `O`. The second occupant may be another guest or a CPU.
- The board is 3×3.
- `X` starts unless the room snapshot explicitly assigns another seat.
- Seat 0 is `X` and seat 1 is `O`. When a room starts, the host and the other occupant are randomly assigned those seats.
- A host who is the only person in the room may start versus CPU without waiting for another guest.
- CPU uses unbeatable perfect play and the server applies its moves.
- A legal move selects one empty cell during the actor's turn.
- A player wins by occupying three cells in a row, column, or diagonal.
- The game is a draw when all cells are occupied without a winner.
- The server validates and persists every move; the client only renders state and requests moves.
- A rematch in the same room keeps the same seats, including a CPU occupant. `X` starts again from the initial empty board.
- The playing heading names the seated guest whose mark is next.
- A win names the winning guest and mark. A draw is announced as a draw, not as a generic final board.

## Open decisions

- Whether a disconnected player receives a grace period before the room is finished.
