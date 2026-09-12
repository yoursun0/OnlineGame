import { nextCpuMove, ticTacToe, type TicTacToeState } from '@playroom/tic-tac-toe';
import { logApiFailure } from './observability';
import { getAdminClient } from './supabase-admin';

export type CpuRoom = { id: string; status: string; version: number; state: TicTacToeState };
export type CpuMember = { guest_id: string; seat: number; is_cpu?: boolean };

function asState(state: TicTacToeState | unknown): TicTacToeState {
  return state as TicTacToeState;
}

export async function applyCpuTurnIfNeeded(room: CpuRoom, members: CpuMember[]) {
  if (room.status !== 'playing') return;
  const state = asState(room.state);
  const cpu = members.find((member) => member.is_cpu);
  const move = nextCpuMove(state, members);
  if (!cpu || !move) return;
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

export async function snapshotAfterCpuTurn<T extends { room: { id: string; status: string; version: number; state: unknown }; members: CpuMember[] }>(
  snapshot: T,
  reload: () => Promise<T>,
  apply: (room: CpuRoom, members: CpuMember[]) => Promise<void> = applyCpuTurnIfNeeded,
  roomCode?: string,
): Promise<T> {
  if (snapshot.room.status !== 'playing') return snapshot;
  const room = { ...snapshot.room, state: asState(snapshot.room.state) };
  if (!nextCpuMove(room.state, snapshot.members)) return snapshot;
  try {
    await apply(room, snapshot.members);
  } catch (error) {
    logApiFailure('/api/rooms/[code]#cpu', error, roomCode);
  }
  return reload();
}
