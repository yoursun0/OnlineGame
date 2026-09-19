import { expect, test } from 'bun:test';
import {
  createSharedStartState,
  createSoloStartState,
  finishedState,
  guestWellRefreshOutcome,
  isDownstairsRoomState,
  nonHostMayDeclareHostLeft,
  shouldPersistHostLeftOnUnload,
} from '@playroom/downstairs';
import { roomHeadline } from '../app/room-headline';

test('finishedState accepts host_left with no winner', () => {
  const start = createSharedStartState(['host-1', 'guest-2']);
  const finished = finishedState(start.checkpoint!, 'host_left', null);
  expect(isDownstairsRoomState(finished)).toBe(true);
  expect(finished.phase).toBe('finished');
  expect(finished.result?.reason).toBe('host_left');
  expect(finished.result?.winnerGuestId).toBeNull();
});

test('non-host may declare host_left only', () => {
  expect(nonHostMayDeclareHostLeft('host_left')).toBe(true);
  expect(nonHostMayDeclareHostLeft('quit')).toBe(false);
  expect(nonHostMayDeclareHostLeft('hp')).toBe(false);
});

test('Shared host unload should persist host_left; Solo refresh must not', () => {
  expect(shouldPersistHostLeftOnUnload({
    isHost: true,
    shared: true,
    phase: 'playing',
    alreadyFinished: false,
  })).toBe(true);
  expect(shouldPersistHostLeftOnUnload({
    isHost: true,
    shared: false,
    phase: 'playing',
    alreadyFinished: false,
  })).toBe(false);
  expect(shouldPersistHostLeftOnUnload({
    isHost: true,
    shared: true,
    phase: 'playing',
    alreadyFinished: true,
  })).toBe(false);
  expect(shouldPersistHostLeftOnUnload({
    isHost: false,
    shared: true,
    phase: 'playing',
    alreadyFinished: false,
  })).toBe(false);
});

test('guest refresh restores Checkpoint, is out without one, keeps finished result', () => {
  const start = createSharedStartState(['host-1', 'guest-2']);
  expect(guestWellRefreshOutcome('playing', start.checkpoint)).toBe('restore');
  expect(guestWellRefreshOutcome('playing', null)).toBe('out');
  const finished = finishedState(start.checkpoint!, 'host_left', null);
  expect(guestWellRefreshOutcome('finished', finished.checkpoint)).toBe('finished');
  expect(guestWellRefreshOutcome('finished', null)).toBe('finished');
  expect(guestWellRefreshOutcome('lobby', null)).toBe('lobby');
});

test('room headline names host left in EN and zh', () => {
  const start = createSoloStartState('host');
  const finished = finishedState(start.checkpoint!, 'host_left', null);
  const members = [{ seat: 0, display_name: 'Host', guest_id: 'host' }];
  expect(roomHeadline({
    status: 'finished',
    state: finished,
    members,
    language: 'en',
    gameSlug: 'downstairs',
  })).toBe('Game complete — host left');
  expect(roomHeadline({
    status: 'finished',
    state: finished,
    members,
    language: 'zh-Hant',
    gameSlug: 'downstairs',
  })).toBe('遊戲結束 — 房主已離開');
});

test('finished-after-refresh headline still shows host_left result', () => {
  const start = createSharedStartState(['host-1', 'guest-2']);
  const finished = finishedState(start.checkpoint!, 'host_left', null);
  // Simulate refresh: client reloads finished room state from server.
  expect(guestWellRefreshOutcome(finished.phase, finished.checkpoint)).toBe('finished');
  expect(roomHeadline({
    status: 'finished',
    state: finished,
    members: [
      { seat: 0, display_name: 'Host', guest_id: 'host-1' },
      { seat: 1, display_name: 'Guest', guest_id: 'guest-2' },
    ],
    language: 'en',
    gameSlug: 'downstairs',
  })).toBe('Game complete — host left');
});
