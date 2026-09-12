import type { GameAdapter, Guest } from '@playroom/game-core';

export const ROWS = 6;
export const COLS = 7;

export type Color = 'red' | 'yellow';
export type Cell = Color | null;
export type Board = Cell[][];
export type ConnectFourState = {
  board: Board;
  nextColor: Color;
  moveCount: number;
  lastDrop: { row: number; column: number } | null;
};
export type ConnectFourMove = { column: number };

const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;
const PREFERRED_COLUMNS = [3, 2, 4, 1, 5, 0, 6];
const CPU_DEPTH = 4;

export function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

export const connectFour: GameAdapter<ConnectFourState, ConnectFourMove> = {
  slug: 'connect-four',
  title: 'Connect Four',
  roomPrefix: 'CON',
  players: { min: 2, max: 2 },
  supports: ['turn_based'],
  createInitialState: () => ({
    board: createEmptyBoard(),
    nextColor: 'red',
    moveCount: 0,
    lastDrop: null,
  }),
  validateMove: (state, move, actor: Guest) => {
    if (connectFour.getStatus(state) !== 'playing') return { ok: false, reason: 'Game is over.' };
    if (!Number.isInteger(move.column) || move.column < 0 || move.column >= COLS) {
      return { ok: false, reason: 'Column must be between 0 and 6.' };
    }
    if (getOpenRow(state.board, move.column) < 0) return { ok: false, reason: 'That column is full.' };
    const expectedSeat = state.nextColor === 'red' ? 0 : 1;
    if (actor.seat !== expectedSeat) return { ok: false, reason: 'It is not this player’s turn.' };
    return { ok: true };
  },
  applyMove: (state, move) => {
    const board = state.board.map((row) => row.slice());
    const row = getOpenRow(board, move.column);
    board[row][move.column] = state.nextColor;
    return {
      board,
      nextColor: state.nextColor === 'red' ? 'yellow' : 'red',
      moveCount: state.moveCount + 1,
      lastDrop: { row, column: move.column },
    };
  },
  getStatus: (state) => (getWinner(state.board, state.lastDrop) ? 'won' : state.moveCount >= ROWS * COLS ? 'draw' : 'playing'),
};

export function getOpenRow(board: Board, column: number): number {
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (!board[row][column]) return row;
  }
  return -1;
}

export function getValidColumns(board: Board): number[] {
  return Array.from({ length: COLS }, (_, column) => column).filter((column) => !board[0][column]);
}

export function getWinner(board: Board, lastDrop?: ConnectFourState['lastDrop']): Color | null {
  const line = getWinningLine(board, lastDrop);
  if (!line) return null;
  return board[line[0][0]][line[0][1]];
}

export function getWinningLine(board: Board, lastDrop?: ConnectFourState['lastDrop']): Array<[number, number]> | null {
  if (lastDrop) {
    const color = board[lastDrop.row]?.[lastDrop.column];
    if (!color) return null;
    return findWinningLine(board, lastDrop.row, lastDrop.column, color);
  }
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLS; column += 1) {
      const color = board[row][column];
      if (!color) continue;
      const line = findWinningLine(board, row, column, color);
      if (line) return line;
    }
  }
  return null;
}

export function chooseCpuMove(state: ConnectFourState): number {
  const board = state.board.map((row) => row.slice());
  const validColumns = getValidColumns(board);
  if (validColumns.length === 0) throw new Error('No legal CPU move.');
  const cpuColor = state.nextColor;
  const humanColor: Color = cpuColor === 'red' ? 'yellow' : 'red';
  const tactical = findTacticalMove(board, cpuColor) ?? findTacticalMove(board, humanColor);
  if (tactical !== null) return tactical;

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestColumn = orderColumns(validColumns)[0];
  for (const column of orderColumns(validColumns)) {
    const row = getOpenRow(board, column);
    board[row][column] = cpuColor;
    const score = scoreCpuPosition(board, CPU_DEPTH - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, false, cpuColor, humanColor);
    board[row][column] = null;
    if (score > bestScore) {
      bestScore = score;
      bestColumn = column;
    }
  }
  return bestColumn;
}

export function nextCpuMove(state: ConnectFourState, members: Array<{ seat: number; is_cpu?: boolean }>): ConnectFourMove | null {
  if (connectFour.getStatus(state) !== 'playing') return null;
  const cpu = members.find((member) => member.is_cpu);
  if (!cpu) return null;
  const expectedSeat = state.nextColor === 'red' ? 0 : 1;
  if (cpu.seat !== expectedSeat) return null;
  return { column: chooseCpuMove(state) };
}

function findWinningLine(board: Board, row: number, column: number, color: Color): Array<[number, number]> | null {
  for (const [deltaRow, deltaCol] of DIRECTIONS) {
    const line: Array<[number, number]> = [[row, column]];
    for (const sign of [-1, 1] as const) {
      let nextRow = row + deltaRow * sign;
      let nextCol = column + deltaCol * sign;
      while (nextRow >= 0 && nextRow < ROWS && nextCol >= 0 && nextCol < COLS && board[nextRow][nextCol] === color) {
        line.push([nextRow, nextCol]);
        nextRow += deltaRow * sign;
        nextCol += deltaCol * sign;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

function findTacticalMove(board: Board, color: Color): number | null {
  for (const column of orderColumns(getValidColumns(board))) {
    const row = getOpenRow(board, column);
    board[row][column] = color;
    const wins = Boolean(findWinningLine(board, row, column, color));
    board[row][column] = null;
    if (wins) return column;
  }
  return null;
}

function orderColumns(columns: number[]): number[] {
  return [...columns].sort((left, right) => PREFERRED_COLUMNS.indexOf(left) - PREFERRED_COLUMNS.indexOf(right));
}

function scoreCpuPosition(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  cpuColor: Color,
  humanColor: Color,
): number {
  const terminal = terminalScore(board, cpuColor, humanColor);
  const validColumns = getValidColumns(board);
  if (terminal !== null || depth === 0 || validColumns.length === 0) {
    return terminal ?? scoreBoard(board, cpuColor, humanColor);
  }

  if (maximizing) {
    let value = Number.NEGATIVE_INFINITY;
    for (const column of orderColumns(validColumns)) {
      const row = getOpenRow(board, column);
      board[row][column] = cpuColor;
      value = Math.max(value, scoreCpuPosition(board, depth - 1, alpha, beta, false, cpuColor, humanColor));
      board[row][column] = null;
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  let value = Number.POSITIVE_INFINITY;
  for (const column of orderColumns(validColumns)) {
    const row = getOpenRow(board, column);
    board[row][column] = humanColor;
    value = Math.min(value, scoreCpuPosition(board, depth - 1, alpha, beta, true, cpuColor, humanColor));
    board[row][column] = null;
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

function terminalScore(board: Board, cpuColor: Color, humanColor: Color): number | null {
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLS; column += 1) {
      const color = board[row][column];
      if (!color) continue;
      if (findWinningLine(board, row, column, color)) return color === cpuColor ? 100000 : -100000;
    }
  }
  return null;
}

function scoreBoard(board: Board, cpuColor: Color, humanColor: Color): number {
  let score = 0;
  for (let row = 0; row < ROWS; row += 1) {
    if (board[row][3] === cpuColor) score += 6;
    if (board[row][3] === humanColor) score -= 6;
  }
  return score + scoreWindows(board, cpuColor, humanColor) - scoreWindows(board, humanColor, cpuColor);
}

function scoreWindows(board: Board, color: Color, opponent: Color): number {
  let score = 0;
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLS; column += 1) {
      for (const [deltaRow, deltaCol] of DIRECTIONS) {
        const window: Cell[] = [];
        for (let index = 0; index < 4; index += 1) {
          const nextRow = row + deltaRow * index;
          const nextCol = column + deltaCol * index;
          if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) break;
          window.push(board[nextRow][nextCol]);
        }
        if (window.length !== 4 || window.includes(opponent)) continue;
        const count = window.filter((cell) => cell === color).length;
        const open = window.filter((cell) => cell === null).length;
        if (count === 4) score += 120;
        else if (count === 3 && open === 1) score += 18;
        else if (count === 2 && open === 2) score += 4;
        else if (count === 1 && open === 3) score += 1;
      }
    }
  }
  return score;
}
