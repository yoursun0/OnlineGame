import { expect, test } from 'bun:test';
import { canHostStartRoom } from '../app/room-start';

test('a solo host can start without a second player', () => {
  expect(canHostStartRoom({
    status: 'open',
    hostGuestId: 'host',
    guestId: 'host',
    members: [{ is_ready: false }],
    maxPlayers: 2,
  })).toBe(true);
});

test('a two-player room cannot start until both players are ready', () => {
  expect(canHostStartRoom({
    status: 'open',
    hostGuestId: 'host',
    guestId: 'host',
    members: [{ is_ready: true }, { is_ready: false }],
    maxPlayers: 2,
  })).toBe(false);
});

test('a two-player room can start when both players are ready', () => {
  expect(canHostStartRoom({
    status: 'open',
    hostGuestId: 'host',
    guestId: 'host',
    members: [{ is_ready: true }, { is_ready: true }],
    maxPlayers: 2,
  })).toBe(true);
});

test('only the host can start the room', () => {
  expect(canHostStartRoom({
    status: 'open',
    hostGuestId: 'host',
    guestId: 'guest',
    members: [{ is_ready: true }, { is_ready: true }],
    maxPlayers: 2,
  })).toBe(false);
});

test('a downstairs Shared well can start with 2 ready humans before the room is full', () => {
  expect(canHostStartRoom({
    status: 'open',
    hostGuestId: 'host',
    guestId: 'host',
    members: [{ is_ready: true }, { is_ready: true }],
    maxPlayers: 4,
    gameSlug: 'downstairs',
  })).toBe(true);
});

test('a downstairs Shared well can start with 3 ready humans', () => {
  expect(canHostStartRoom({
    status: 'open',
    hostGuestId: 'host',
    guestId: 'host',
    members: [{ is_ready: true }, { is_ready: true }, { is_ready: true }],
    maxPlayers: 4,
    gameSlug: 'downstairs',
  })).toBe(true);
});

test('a downstairs Shared well can start with 4 ready humans', () => {
  expect(canHostStartRoom({
    status: 'open',
    hostGuestId: 'host',
    guestId: 'host',
    members: [{ is_ready: true }, { is_ready: true }, { is_ready: true }, { is_ready: true }],
    maxPlayers: 4,
    gameSlug: 'downstairs',
  })).toBe(true);
});

test('a downstairs room with 3 humans cannot start until every human is ready', () => {
  expect(canHostStartRoom({
    status: 'open',
    hostGuestId: 'host',
    guestId: 'host',
    members: [{ is_ready: true }, { is_ready: true }, { is_ready: false }],
    maxPlayers: 4,
    gameSlug: 'downstairs',
  })).toBe(false);
});
