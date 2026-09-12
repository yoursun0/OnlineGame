import { nextCpuMove, ticTacToe, type TicTacToeState } from '@playroom/tic-tac-toe';
import { getAdminClient } from './supabase-admin';

type CpuRoom = { id: string; status: string; version: number; state: TicTacToeState };
type CpuMember = { guest_id: string; seat: number; is_cpu?: boolean };

export async function applyCpuTurnIfNeeded(room: CpuRoom, members: CpuMember[]) {
  if (room.status !== 'playing') return;
  const cpu = members.find((member) => member.is_cpu);
  const move = nextCpuMove(room.state, members);
  if (!cpu || !move) return;
  const nextState = ticTacToe.applyMove(room.state, move, { id: cpu.guest_id, seat: cpu.seat });
  const status = ticTacToe.getStatus(nextState);
  const { error } = await getAdminClient().rpc('append_game_event', {
    p_room_id: room.id,
    p_guest_id: cpu.guest_id,
    p_expected_version: room.version,
    p_state: nextState,
    p_status: status === 'playing' ? 'playing' : 'finished',
    p_event_type: 'move',
    p_payload: { cell: move.cell, mark: room.state.nextMark },
  });
  if (error) throw error;
}
