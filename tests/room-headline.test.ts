import { expect, test } from 'bun:test';
import { connectFour } from '@playroom/connect-four';
import { ticTacToe } from '@playroom/tic-tac-toe';
import { roomHeadline } from '../app/room-headline';

const members = [
  { seat: 0, display_name: 'aa' },
  { seat: 1, display_name: 'gg' },
];

test('a playing room names the guest whose mark is next', () => {
  const state = ticTacToe.createInitialState();
  expect(roomHeadline({ status: 'playing', state, members, language: 'en' })).toBe('Turn: X · aa');
  expect(roomHeadline({ status: 'playing', state, members, language: 'zh-Hant' })).toBe('輪到: X · aa');
});

test('a draw uses the draw heading instead of final board', () => {
  const state = {
    board: ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'] as Array<'X' | 'O' | null>,
    nextMark: 'O' as const,
    moveCount: 9,
  };
  expect(ticTacToe.getStatus(state)).toBe('draw');
  expect(roomHeadline({ status: 'finished', state, members, language: 'en' })).toBe('Game complete — draw');
  expect(roomHeadline({ status: 'finished', state, members, language: 'zh-Hant' })).toBe('遊戲結束 — 和局');
});

test('a win names the winning guest and mark', () => {
  const state = {
    board: ['X', 'X', 'X', 'O', 'O', null, null, null, null] as Array<'X' | 'O' | null>,
    nextMark: 'O' as const,
    moveCount: 5,
  };
  expect(ticTacToe.getStatus(state)).toBe('won');
  expect(roomHeadline({ status: 'finished', state, members, language: 'en' })).toBe('Game complete — X · aa wins');
  expect(roomHeadline({ status: 'finished', state, members, language: 'zh-Hant' })).toBe('遊戲結束 — X · aa 獲勝');
});

test('a playing Connect Four room names the guest whose color is next', () => {
  const state = connectFour.createInitialState();
  expect(roomHeadline({ status: 'playing', state, members, language: 'en', gameSlug: 'connect-four' })).toBe('Turn: Red · aa');
  expect(roomHeadline({ status: 'playing', state, members, language: 'zh-Hant', gameSlug: 'connect-four' })).toBe('輪到: 紅 · aa');
});

test('a Connect Four win names the winning guest and color', () => {
  let state = connectFour.createInitialState();
  for (const column of [0, 0, 1, 1, 2, 2, 3]) {
    const seat = state.nextColor === 'red' ? 0 : 1;
    state = connectFour.applyMove(state, { column }, { id: 'p', seat });
  }
  expect(connectFour.getStatus(state)).toBe('won');
  expect(roomHeadline({ status: 'finished', state, members, language: 'en', gameSlug: 'connect-four' })).toBe('Game complete — Red · aa wins');
  expect(roomHeadline({ status: 'finished', state, members, language: 'zh-Hant', gameSlug: 'connect-four' })).toBe('遊戲結束 — 紅 · aa 獲勝');
});
