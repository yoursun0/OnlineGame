import { expect, test } from 'bun:test';
import { snapshotAfterCpuTurn, type CpuMember, type CpuRoom } from '../app/api/_lib/apply-cpu-turn';
import { ticTacToe, type TicTacToeState } from '@playroom/tic-tac-toe';

const cpu: CpuMember = { guest_id: 'cpu', seat: 0, is_cpu: true };
const host: CpuMember = { guest_id: 'host', seat: 1, is_cpu: false };
const pending: { room: CpuRoom; members: CpuMember[] } = {
  room: { id: 'room', status: 'playing', version: 0, state: ticTacToe.createInitialState() },
  members: [cpu, host],
};

test('a snapshot with no pending CPU move is returned as-is', async () => {
  const snapshot = {
    room: pending.room,
    members: [{ ...host, seat: 0 }, { ...cpu, seat: 1 }],
  };
  const result = await snapshotAfterCpuTurn(snapshot, async () => {
    throw new Error('reload should not run.');
  }, async () => {
    throw new Error('CPU apply should not run.');
  });
  expect(result).toBe(snapshot);
});

test('a failed CPU append still returns the reloaded human snapshot', async () => {
  const reloaded = { ...pending, room: { ...pending.room, version: 0 } };
  const result = await snapshotAfterCpuTurn(pending, async () => reloaded, async () => {
    throw new Error('CPU append failed.');
  });
  expect(result).toBe(reloaded);
});

test('a successful CPU append returns the reloaded snapshot', async () => {
  const reloaded = {
    ...pending,
    room: { ...pending.room, version: 1, state: ticTacToe.applyMove(pending.room.state as TicTacToeState, { cell: 0 }, { id: 'cpu' }) },
  };
  let applied = false;
  const result = await snapshotAfterCpuTurn(pending, async () => reloaded, async () => {
    applied = true;
  });
  expect(applied).toBe(true);
  expect(result).toBe(reloaded);
});
