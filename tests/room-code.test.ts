import { expect, test } from 'bun:test';
import { isPlayroomRoomCode } from '../app/room-code';

test('accepts Tic-tac-toe, Connect Four, and LAD room codes', () => {
  expect(isPlayroomRoomCode('TIK-7Q4')).toBe(true);
  expect(isPlayroomRoomCode('CON-K8P')).toBe(true);
  expect(isPlayroomRoomCode('LAD-ZHW')).toBe(true);
});

test('rejects malformed or other-game codes', () => {
  expect(isPlayroomRoomCode('TIK-7Q')).toBe(false);
  expect(isPlayroomRoomCode('CON-IO1')).toBe(false);
  expect(isPlayroomRoomCode('XYZ-ABC')).toBe(false);
});
