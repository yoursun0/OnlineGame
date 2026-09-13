import { expect, test } from 'bun:test';
import {
  GAME_CATALOG,
  WELL_INTENT_DIRECTIONS,
  createWellCheckpoint,
  createWellIntent,
  createWellSnapshot,
  isWellCheckpoint,
  isWellIntent,
  isWellPlayPayload,
  isWellSnapshot,
  type WellState,
} from '@playroom/game-core';
import { connectFour } from '@playroom/connect-four';
import { ticTacToe } from '@playroom/tic-tac-toe';

const well: WellState = {
  clock: 1.25,
  kids: [
    { guestId: 'host', x: 40, y: 80, life: 12, alive: true },
    { guestId: 'guest', x: 90, y: 80, life: 8, alive: true },
  ],
  stairs: [{ id: 1, x: 18, y: 168, w: 108, kind: 'normal' }],
};

test('the catalogue still exposes only the two turn-based games', () => {
  expect(GAME_CATALOG.map((game) => [game.slug, game.supports, game.available])).toEqual([
    ['tic-tac-toe', ['turn_based'], true],
    ['connect-four', ['turn_based'], true],
  ]);
});

test('an Intent is left, right, or none and is not a board move', () => {
  expect(WELL_INTENT_DIRECTIONS).toEqual(['left', 'right', 'none']);
  for (const direction of WELL_INTENT_DIRECTIONS) {
    const intent = createWellIntent('guest', direction, 3, 120);
    expect(isWellIntent(intent)).toBe(true);
    expect(isWellPlayPayload(intent)).toBe(true);
    expect(isWellSnapshot(intent)).toBe(false);
    expect(isWellCheckpoint(intent)).toBe(false);
  }
  expect(isWellIntent({ cell: 0 })).toBe(false);
  expect(isWellIntent({ column: 3 })).toBe(false);
  expect(isWellIntent(createWellIntent('guest', 'up' as 'left', 0, 0))).toBe(false);
});

test('a host Snapshot and a Checkpoint share well state but are not board moves', () => {
  const snapshot = createWellSnapshot(10, 3, well);
  const checkpoint = createWellCheckpoint(2, well);
  expect(isWellSnapshot(snapshot)).toBe(true);
  expect(isWellCheckpoint(checkpoint)).toBe(true);
  expect(isWellPlayPayload(snapshot)).toBe(true);
  expect(isWellPlayPayload(checkpoint)).toBe(true);
  expect(isWellIntent(snapshot)).toBe(false);
  expect(isWellSnapshot(checkpoint)).toBe(false);
  expect(isWellPlayPayload({ cell: 4, expectedVersion: 1 })).toBe(false);
  expect(isWellPlayPayload({ column: 3, expectedVersion: 1 })).toBe(false);
});

test('a well payload that also has a board field is still well traffic', () => {
  const disguised = { ...createWellIntent('guest', 'left', 1, 0), cell: 0, column: 3 };
  expect(isWellPlayPayload(disguised)).toBe(true);
});

test('Checkpoint shape rejects empty wells and duplicate occupants', () => {
  expect(isWellCheckpoint(createWellCheckpoint(0, { ...well, kids: [] }))).toBe(false);
  expect(isWellCheckpoint(createWellCheckpoint(0, { ...well, stairs: [] }))).toBe(false);
  expect(isWellCheckpoint(createWellCheckpoint(0, {
    ...well,
    kids: [
      { guestId: 'same', x: 1, y: 1, life: 1, alive: true },
      { guestId: 'same', x: 2, y: 2, life: 1, alive: true },
    ],
  }))).toBe(false);
});

test('tic-tac-toe still plays a full game on board moves and does not accept an Intent', () => {
  const x = { id: 'x', seat: 0 };
  const o = { id: 'o', seat: 1 };
  let state = ticTacToe.createInitialState();
  for (const [actor, cell] of [[x, 0], [o, 3], [x, 1], [o, 4], [x, 2]] as const) {
    const move = { cell };
    expect(ticTacToe.validateMove(state, move, actor)).toEqual({ ok: true });
    state = ticTacToe.applyMove(state, move, actor);
  }
  expect(ticTacToe.getStatus(state)).toBe('won');
  expect(ticTacToe.validateMove(ticTacToe.createInitialState(), createWellIntent(x.id, 'left', 0, 0) as never, x).ok).toBe(false);
});

test('Connect Four still finishes on column drops and does not accept a Snapshot', () => {
  const red = { id: 'red', seat: 0 };
  const yellow = { id: 'yellow', seat: 1 };
  let state = connectFour.createInitialState();
  for (const [actor, column] of [[red, 0], [yellow, 0], [red, 1], [yellow, 1], [red, 2], [yellow, 2], [red, 3]] as const) {
    const move = { column };
    expect(connectFour.validateMove(state, move, actor)).toEqual({ ok: true });
    state = connectFour.applyMove(state, move, actor);
  }
  expect(connectFour.getStatus(state)).toBe('won');
  expect(connectFour.validateMove(connectFour.createInitialState(), createWellSnapshot(0, 0, well) as never, red).ok).toBe(false);
});
