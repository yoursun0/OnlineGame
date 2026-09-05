import { NextRequest } from 'next/server';
import { ticTacToe, type TicTacToeState } from '@playroom/tic-tac-toe';
import { errorResponse, getAdminClient, getAuthenticatedGuest, readJson } from '../../../_lib/supabase-admin';
import { getRoomSnapshot } from '../route';

type Params = { params: Promise<{ code: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const admin = getAdminClient();
    const guest = await getAuthenticatedGuest(request, admin);
    const body = await readJson(request) as { cell?: number };
    const { room, members } = await getRoomSnapshot(code.toUpperCase(), guest.id);
    if (room.status !== 'playing') throw new Error('The game has not started or is already finished.');
    const member = members.find((candidate) => candidate.guest_id === guest.id);
    if (!member) throw new Error('You are not a member of this room.');
    const state = room.state as TicTacToeState;
    const move = { cell: body.cell as number };
    const validation = ticTacToe.validateMove(state, move, { id: guest.id, seat: member.seat ?? undefined });
    if (!validation.ok) throw new Error(validation.reason);
    const nextState = ticTacToe.applyMove(state, move, { id: guest.id, seat: member.seat ?? undefined });
    const status = ticTacToe.getStatus(nextState);
    const { error } = await admin.rpc('append_game_event', {
      p_room_id: room.id,
      p_guest_id: guest.id,
      p_expected_version: room.version,
      p_state: nextState,
      p_status: status === 'playing' ? 'playing' : 'finished',
      p_event_type: 'move',
      p_payload: { cell: move.cell, mark: state.nextMark },
    });
    if (error) throw error;
    return Response.json(await getRoomSnapshot(code.toUpperCase(), guest.id));
  } catch (error) { return errorResponse(error); }
}
