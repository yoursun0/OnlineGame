import { NextRequest } from 'next/server';
import { connectFour, type ConnectFourState } from '@playroom/connect-four';
import { DOWNSTAIRS_SLUG } from '@playroom/downstairs';
import { isWellPlayPayload } from '@playroom/game-core';
import { ticTacToe, type TicTacToeState } from '@playroom/tic-tac-toe';
import { applyMove, validateMove, type State as TienGowState } from '@playroom/tien-gow';
import { ApiError, enforceRateLimit, errorResponse, getAdminClient, getAuthenticatedGuest, getClientIpHash, readJson } from '../../../_lib/supabase-admin';
import { logApiFailure, logRoomLifecycle } from '../../../_lib/observability';
import { snapshotAfterCpuTurn } from '../../../_lib/apply-cpu-turn';
import { isTienGowState, parseTienGowMove, projectTienGowSnapshot, publicTienGowMovePayload } from '../../../_lib/tien-gow-room';
import { getRoomSnapshot } from '../route';

type Params = { params: Promise<{ code: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const admin = getAdminClient();
    const guest = await getAuthenticatedGuest(request, admin);
    const body = await readJson(request, 1024) as { cell?: number; column?: number; expectedVersion?: number };
    if (isWellPlayPayload(body)) throw new ApiError('Realtime well traffic does not use the turn-based move path.', 400);
    await enforceRateLimit(admin, guest.id, 'move', getClientIpHash(request), 12, 10);
    const { room, members } = await getRoomSnapshot(code.toUpperCase(), guest.id);
    if (room.game_slug === DOWNSTAIRS_SLUG) throw new ApiError('Realtime well traffic does not use the turn-based move path.', 400);
    const expectedVersion = body.expectedVersion ?? room.version;
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new ApiError('Invalid room version.', 400);
    if (room.status !== 'playing') throw new Error('The game has not started or is already finished.');
    const member = members.find((candidate) => candidate.guest_id === guest.id);
    if (!member) throw new Error('You are not a member of this room.');
    const actor = { id: guest.id, seat: member.seat ?? undefined };

    let nextState: ConnectFourState | TicTacToeState | TienGowState;
    let status: 'playing' | 'won' | 'draw';
    let payload: Record<string, unknown>;

    if (room.game_slug === 'tien-gow') {
      if (!isTienGowState(room.state)) throw new ApiError('打天九 state is missing.', 409);
      const parsed = parseTienGowMove(body);
      if (!parsed.ok) throw new ApiError(parsed.reason, 400);
      const validation = validateMove(room.state, parsed.move, actor);
      if (!validation.ok) throw new Error(validation.reason);
      const applied = applyMove(room.state, parsed.move, actor);
      nextState = applied;
      status = 'playing';
      payload = publicTienGowMovePayload(parsed.move, member.seat);
    } else if (room.game_slug === 'connect-four') {
      const column = body.column;
      if (typeof column !== 'number' || !Number.isInteger(column) || column < 0 || column > 6) throw new ApiError('Choose a valid column.', 400);
      const state = room.state as ConnectFourState;
      const move = { column };
      const validation = connectFour.validateMove(state, move, actor);
      if (!validation.ok) throw new Error(validation.reason);
      const applied = connectFour.applyMove(state, move, actor);
      nextState = applied;
      status = connectFour.getStatus(applied);
      payload = { column: move.column, color: state.nextColor };
    } else {
      const cell = body.cell;
      if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell > 8) throw new ApiError('Choose a valid board cell.', 400);
      const state = room.state as TicTacToeState;
      const move = { cell };
      const validation = ticTacToe.validateMove(state, move, actor);
      if (!validation.ok) throw new Error(validation.reason);
      const applied = ticTacToe.applyMove(state, move, actor);
      nextState = applied;
      status = ticTacToe.getStatus(applied);
      payload = { cell: move.cell, mark: state.nextMark };
    }

    const { error } = await admin.rpc('append_game_event', {
      p_room_id: room.id,
      p_guest_id: guest.id,
      p_expected_version: expectedVersion,
      p_state: nextState,
      p_status: status === 'playing' ? 'playing' : 'finished',
      p_event_type: 'move',
      p_payload: payload,
    });
    if (error) throw error;
    logRoomLifecycle('move', { roomCode: code.toUpperCase(), guestId: guest.id, version: expectedVersion + 1, status });
    const drained = await snapshotAfterCpuTurn(
      await getRoomSnapshot(code.toUpperCase(), guest.id),
      () => getRoomSnapshot(code.toUpperCase(), guest.id),
      undefined,
      code.toUpperCase(),
    );
    return Response.json(projectTienGowSnapshot(drained, guest.id));
  } catch (error) {
    logApiFailure('/api/rooms/[code]/move', error);
    return errorResponse(error);
  }
}
