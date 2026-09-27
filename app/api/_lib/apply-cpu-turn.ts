import type { SupabaseClient } from '@supabase/supabase-js';
import { connectFour, nextCpuMove as nextConnectFourMove, type ConnectFourState } from '@playroom/connect-four';
import { nextCpuMove, ticTacToe, type TicTacToeState } from '@playroom/tic-tac-toe';
import { applyMove, nextCpuMove as nextTienGowCpuMove, type State as TienGowState } from '@playroom/tien-gow';
import { logApiFailure } from './observability';
import { getAdminClient } from './supabase-admin';
import { isTienGowState, pendingTienGowCpuSeat, publicTienGowMovePayload, TGW_CPU_DRAIN_CAP } from './tien-gow-room';

export type CpuRoom = { id: string; status: string; version: number; state: unknown; game_slug?: string };
export type CpuMember = { guest_id: string; seat: number; is_cpu?: boolean };
export type StoredStep = {
  guestId: string;
  state: unknown;
  status: 'playing' | 'finished';
  eventType: string;
  payload: Record<string, unknown>;
};
type PlayedRoom = { state: unknown; version: number; status: string };

function pendingCpuMove(room: CpuRoom, members: CpuMember[]) {
  if (room.game_slug === 'connect-four') return nextConnectFourMove(room.state as ConnectFourState, members);
  if (room.game_slug === 'tic-tac-toe' || room.game_slug === undefined) return nextCpuMove(room.state as TicTacToeState, members);
  return null;
}

function finishedStatus(status: string): 'playing' | 'finished' {
  return status === 'playing' ? 'playing' : 'finished';
}

/** Computer replies that follow an already-applied state. Tic-tac-toe and Connect Four reply once. */
export function followUpSteps(gameSlug: string | undefined, state: unknown, members: CpuMember[]): StoredStep[] {
  if (gameSlug === 'downstairs') return [];
  if (gameSlug === 'tien-gow') {
    if (!isTienGowState(state)) return [];
    const steps: StoredStep[] = [];
    let current: TienGowState = state;
    for (let step = 0; step < TGW_CPU_DRAIN_CAP; step += 1) {
      const cpu = pendingTienGowCpuSeat(current, members);
      if (!cpu) break;
      const move = nextTienGowCpuMove(current, cpu.seat);
      if (!move) break;
      current = applyMove(current, move, { id: cpu.guest_id, seat: cpu.seat });
      steps.push({
        guestId: cpu.guest_id,
        state: current,
        status: 'playing',
        eventType: 'move',
        payload: publicTienGowMovePayload(move, cpu.seat),
      });
    }
    return steps;
  }

  const room: CpuRoom = { id: '', status: 'playing', version: 0, state, game_slug: gameSlug };
  const move = pendingCpuMove(room, members);
  const cpu = members.find((member) => member.is_cpu);
  if (!move || !cpu) return [];
  if (gameSlug === 'connect-four' && 'column' in move) {
    const board = state as ConnectFourState;
    const nextState = connectFour.applyMove(board, move, { id: cpu.guest_id, seat: cpu.seat });
    return [{
      guestId: cpu.guest_id,
      state: nextState,
      status: finishedStatus(connectFour.getStatus(nextState)),
      eventType: 'move',
      payload: { column: move.column, color: board.nextColor },
    }];
  }
  if (!('cell' in move)) return [];
  const board = state as TicTacToeState;
  const nextState = ticTacToe.applyMove(board, move, { id: cpu.guest_id, seat: cpu.seat });
  return [{
    guestId: cpu.guest_id,
    state: nextState,
    status: finishedStatus(ticTacToe.getStatus(nextState)),
    eventType: 'move',
    payload: { cell: move.cell, mark: board.nextMark },
  }];
}

export async function appendGameSteps(
  admin: SupabaseClient,
  roomId: string,
  actorGuestId: string,
  expectedVersion: number,
  steps: StoredStep[],
) {
  const { data, error } = await admin.rpc('append_game_events', {
    p_room_id: roomId,
    p_actor_guest_id: actorGuestId,
    p_expected_version: expectedVersion,
    p_steps: steps.map((step) => ({
      guest_id: step.guestId,
      state: step.state,
      status: step.status,
      event_type: step.eventType,
      payload: step.payload,
    })),
  });
  if (error) throw error;
  if (typeof data !== 'number') throw new Error('The room did not record the move.');
  return data;
}

export async function applyCpuTurnIfNeeded(room: CpuRoom, members: CpuMember[]): Promise<PlayedRoom | undefined> {
  if (room.status !== 'playing') return;
  const steps = followUpSteps(room.game_slug, room.state, members);
  if (steps.length === 0) return;
  const version = await appendGameSteps(getAdminClient(), room.id, steps[0].guestId, room.version, steps);
  const last = steps[steps.length - 1];
  return { state: last.state, version, status: last.status };
}

export async function snapshotAfterCpuTurn<T extends { room: CpuRoom; members: CpuMember[] }>(
  snapshot: T,
  reload: () => Promise<T>,
  apply: (room: CpuRoom, members: CpuMember[]) => Promise<PlayedRoom | void> = applyCpuTurnIfNeeded,
  roomCode?: string,
): Promise<T> {
  if (snapshot.room.status !== 'playing') return snapshot;
  if (followUpSteps(snapshot.room.game_slug, snapshot.room.state, snapshot.members).length === 0) return snapshot;
  try {
    const played = await apply(snapshot.room, snapshot.members);
    if (played) {
      return { ...snapshot, room: { ...snapshot.room, state: played.state, version: played.version, status: played.status } };
    }
  } catch (error) {
    logApiFailure('/api/rooms/[code]#cpu', error, roomCode);
  }
  return reload();
}
