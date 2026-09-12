import { NextRequest } from 'next/server';
import { ticTacToe, type TicTacToeState } from '@playroom/tic-tac-toe';
import { ApiError, enforceRateLimit, errorResponse, getAdminClient, getAuthenticatedGuest, getClientIpHash, readJson } from '../../../_lib/supabase-admin';
import { logApiFailure, logRoomLifecycle } from '../../../_lib/observability';
import { snapshotAfterCpuTurn } from '../../../_lib/apply-cpu-turn';
import { getRoomSnapshot } from '../route';

type Params = { params: Promise<{ code: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const admin = getAdminClient();
    const guest = await getAuthenticatedGuest(request, admin);
    const body = await readJson(request, 1024) as { cell?: number; expectedVersion?: number };
    const cell = body.cell;
    if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell > 8) throw new ApiError('Choose a valid board cell.', 400);
    await enforceRateLimit(admin, guest.id, 'move', getClientIpHash(request), 12, 10);
    const { room, members } = await getRoomSnapshot(code.toUpperCase(), guest.id);
    const expectedVersion = body.expectedVersion ?? room.version;
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new ApiError('Invalid room version.', 400);
    if (room.status !== 'playing') throw new Error('The game has not started or is already finished.');
    const member = members.find((candidate) => candidate.guest_id === guest.id);
    if (!member) throw new Error('You are not a member of this room.');
    const state = room.state as TicTacToeState;
    const move = { cell };
    const validation = ticTacToe.validateMove(state, move, { id: guest.id, seat: member.seat ?? undefined });
    if (!validation.ok) throw new Error(validation.reason);
    const nextState = ticTacToe.applyMove(state, move, { id: guest.id, seat: member.seat ?? undefined });
    const status = ticTacToe.getStatus(nextState);
    const { error } = await admin.rpc('append_game_event', {
      p_room_id: room.id,
      p_guest_id: guest.id,
      p_expected_version: expectedVersion,
      p_state: nextState,
      p_status: status === 'playing' ? 'playing' : 'finished',
      p_event_type: 'move',
      p_payload: { cell: move.cell, mark: state.nextMark },
    });
    if (error) throw error;
    logRoomLifecycle('move', { roomCode: code.toUpperCase(), guestId: guest.id, version: expectedVersion + 1, status });
    return Response.json(await snapshotAfterCpuTurn(
      await getRoomSnapshot(code.toUpperCase(), guest.id),
      () => getRoomSnapshot(code.toUpperCase(), guest.id),
      undefined,
      code.toUpperCase(),
    ));
  } catch (error) {
    logApiFailure('/api/rooms/[code]/move', error);
    return errorResponse(error);
  }
}
