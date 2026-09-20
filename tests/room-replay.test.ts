import { expect, test } from 'bun:test';
import { createSharedStartState, createSoloStartState, finishedState } from '@playroom/downstairs';
import { canShowRoomReplay, downstairsReplayGuestIds } from '../app/room-replay';

test('TGW rematch is in-hand after 結, not finished-room Replay', () => {
  expect(canShowRoomReplay({
    status: 'finished',
    gameSlug: 'tien-gow',
    isMember: true,
    memberCount: 4,
    maxPlayers: 4,
    humanCount: 1,
    hostStillPresent: true,
  })).toBe(false);
  expect(canShowRoomReplay({
    status: 'playing',
    gameSlug: 'tien-gow',
    isMember: true,
    memberCount: 4,
    maxPlayers: 4,
    humanCount: 1,
    hostStillPresent: true,
  })).toBe(false);
});

test('Connect Four / Tic-tac-toe rematch shows only when every seat is filled', () => {
  expect(canShowRoomReplay({
    status: 'finished',
    gameSlug: 'connect-four',
    isMember: true,
    memberCount: 2,
    maxPlayers: 2,
    humanCount: 1,
    hostStillPresent: true,
  })).toBe(true);
  expect(canShowRoomReplay({
    status: 'finished',
    gameSlug: 'tic-tac-toe',
    isMember: true,
    memberCount: 1,
    maxPlayers: 2,
    humanCount: 1,
    hostStillPresent: true,
  })).toBe(false);
});

test('downstairs Solo rematch shows with one human even though max_players is 4', () => {
  expect(canShowRoomReplay({
    status: 'finished',
    gameSlug: 'downstairs',
    isMember: true,
    memberCount: 1,
    maxPlayers: 4,
    humanCount: 1,
    hostStillPresent: true,
  })).toBe(true);
});

test('downstairs Shared rematch shows for 2–4 humans without a full room', () => {
  expect(canShowRoomReplay({
    status: 'finished',
    gameSlug: 'downstairs',
    isMember: true,
    memberCount: 2,
    maxPlayers: 4,
    humanCount: 2,
    hostStillPresent: true,
  })).toBe(true);
  expect(canShowRoomReplay({
    status: 'finished',
    gameSlug: 'downstairs',
    isMember: true,
    memberCount: 3,
    maxPlayers: 4,
    humanCount: 3,
    hostStillPresent: true,
  })).toBe(true);
});

test('downstairs rematch hides when the host has left or the caller is not a member', () => {
  expect(canShowRoomReplay({
    status: 'finished',
    gameSlug: 'downstairs',
    isMember: true,
    memberCount: 2,
    maxPlayers: 4,
    humanCount: 2,
    hostStillPresent: false,
  })).toBe(false);
  expect(canShowRoomReplay({
    status: 'finished',
    gameSlug: 'downstairs',
    isMember: false,
    memberCount: 1,
    maxPlayers: 4,
    humanCount: 1,
    hostStillPresent: true,
  })).toBe(false);
  expect(canShowRoomReplay({
    status: 'playing',
    gameSlug: 'downstairs',
    isMember: true,
    memberCount: 1,
    maxPlayers: 4,
    humanCount: 1,
    hostStillPresent: true,
  })).toBe(false);
});

test('downstairsReplayGuestIds keeps host first and seat order for rematch', () => {
  expect(downstairsReplayGuestIds('host', [
    { guest_id: 'b', seat: 1 },
    { guest_id: 'host', seat: 0 },
    { guest_id: 'c', seat: 2 },
  ])).toEqual(['host', 'b', 'c']);
});

test('a downstairs rematch start state clears the previous Game Over result', () => {
  const prior = finishedState(createSoloStartState('host').checkpoint!, 'hp', null);
  expect(prior.phase).toBe('finished');
  expect(prior.result?.reason).toBe('hp');

  const solo = createSoloStartState('host');
  expect(solo.phase).toBe('playing');
  expect(solo.result).toBeUndefined();
  expect(solo.checkpoint!.seq).toBe(0);

  const shared = createSharedStartState(['host', 'guest-a', 'guest-b']);
  expect(shared.phase).toBe('playing');
  expect(shared.result).toBeUndefined();
  expect(shared.checkpoint!.well.kids).toHaveLength(3);
});
