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
