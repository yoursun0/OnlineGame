import { connectFour, nextCpuMove as nextConnectFourMove, type ConnectFourState } from '@playroom/connect-four';
import { nextCpuMove, ticTacToe, type TicTacToeState } from '@playroom/tic-tac-toe';
import { logApiFailure } from './observability';
import { getAdminClient } from './supabase-admin';
import { applyTienGowCpuTurns, isTienGowState, pendingTienGowCpuSeat } from './tien-gow-room';

export type CpuRoom = { id: string; status: string; version: number; state: unknown; game_slug?: string };
export type CpuMember = { guest_id: string; seat: number; is_cpu?: boolean };

function pendingCpuMove(room: CpuRoom, members: CpuMember[]) {
  if (room.game_slug === 'downstairs') return null;
  if (room.game_slug === 'tien-gow') {
    if (!isTienGowState(room.state)) return null;
    return pendingTienGowCpuSeat(room.state, members) ? { type: 'tien-gow' as const } : null;
  }
  if (room.game_slug === 'connect-four') return nextConnectFourMove(room.state as ConnectFourState, members);
  return nextCpuMove(room.state as TicTacToeState, members);
}

export async function applyCpuTurnIfNeeded(room: CpuRoom, members: CpuMember[]) {
  if (room.status !== 'playing') return;
  if (room.game_slug === 'tien-gow') {
    await applyTienGowCpuTurns(room, members);
    return;
  }
  const cpu = members.find((member) => member.is_cpu);
  const move = pendingCpuMove(room, members);
  if (!cpu || !move) return;

  if (room.game_slug === 'connect-four' && 'column' in move) {
    const state = room.state as ConnectFourState;
    const nextState = connectFour.applyMove(state, move, { id: cpu.guest_id, seat: cpu.seat });
    const status = connectFour.getStatus(nextState);
    const { error } = await getAdminClient().rpc('append_game_event', {
      p_room_id: room.id,
      p_guest_id: cpu.guest_id,
      p_expected_version: room.version,
      p_state: nextState,
      p_status: status === 'playing' ? 'playing' : 'finished',
      p_event_type: 'move',
      p_payload: { column: move.column, color: state.nextColor },
    });
    if (error) throw error;
    return;
  }

  if (!('cell' in move)) return;
  const state = room.state as TicTacToeState;
  const nextState = ticTacToe.applyMove(state, move, { id: cpu.guest_id, seat: cpu.seat });
  const status = ticTacToe.getStatus(nextState);
  const { error } = await getAdminClient().rpc('append_game_event', {
    p_room_id: room.id,
    p_guest_id: cpu.guest_id,
    p_expected_version: room.version,
    p_state: nextState,
    p_status: status === 'playing' ? 'playing' : 'finished',
    p_event_type: 'move',
    p_payload: { cell: move.cell, mark: state.nextMark },
  });
  if (error) throw error;
}

export async function snapshotAfterCpuTurn<T extends { room: { id: string; status: string; version: number; state: unknown; game_slug?: string }; members: CpuMember[] }>(
  snapshot: T,
  reload: () => Promise<T>,
  apply: (room: CpuRoom, members: CpuMember[]) => Promise<void> = applyCpuTurnIfNeeded,
  roomCode?: string,
): Promise<T> {
  if (snapshot.room.status !== 'playing') return snapshot;
  const room = { ...snapshot.room };
  if (!pendingCpuMove(room, snapshot.members)) return snapshot;
  try {
    await apply(room, snapshot.members);
  } catch (error) {
    logApiFailure('/api/rooms/[code]#cpu', error, roomCode);
  }
  return reload();
}
