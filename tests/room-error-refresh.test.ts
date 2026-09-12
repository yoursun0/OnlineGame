import { expect, test } from 'bun:test';
import { errorAfterSuccessfulRefresh } from '../app/room-error-state';

test('a later snapshot refresh keeps an out-of-turn move error visible', () => {
  expect(errorAfterSuccessfulRefresh("It is not this player’s turn.", true)).toBe("It is not this player’s turn.");
});

test('the first successful snapshot load clears a previous load error', () => {
  expect(errorAfterSuccessfulRefresh('Could not load room.', false)).toBe('');
});
