# Connect Four rules

This is the source of truth for PLAYROOM Connect Four / 四子棋.

## Initial rules

- Two occupants use red and yellow tokens. The second occupant may be another guest or a CPU.
- The board is 6 rows by 7 columns.
- A legal move selects one column with an empty slot. The token drops to the lowest open row in that column.
- Red starts unless the room snapshot explicitly assigns another seat.
- Seat 0 is red and seat 1 is yellow. When a room starts, the host and the other occupant are randomly assigned those seats.
- A host who is the only person in the room may start versus CPU without waiting for another guest.
- CPU uses a deterministic medium-strength search on the server. It takes an immediate win, blocks an immediate loss, and otherwise prefers central columns.
- A player wins by occupying four cells in a row, column, or diagonal.
- The game is a draw when all 42 cells are occupied without a winner.
- The server validates and persists every move; the client only renders state and requests moves.
- A rematch in the same room keeps the same seats, including a CPU occupant. Red starts again from the initial empty board.
- The playing heading names the seated guest whose color is next.
- A win names the winning guest and color. A draw is announced as a draw, not as a generic final board.

## Open decisions

- Whether a disconnected player receives a grace period before the room is finished.
- Whether hosts can choose CPU difficulty. The shipped CPU is the medium search from the Kinetic Grid prototype.
