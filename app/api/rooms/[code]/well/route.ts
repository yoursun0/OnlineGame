import { NextRequest } from 'next/server';
import { isWellCheckpoint } from '@playroom/game-core';
import {
  DOWNSTAIRS_SLUG,
  finishedState,
  playingState,
  type WellFinishReason,
} from '@playroom/downstairs';
import { ApiError, enforceRateLimit, errorResponse, getAdminClient, getAuthenticatedGuest, getClientIpHash, readJson } from '../../../_lib/supabase-admin';
import { logApiFailure, logRoomLifecycle } from '../../../_lib/observability';
import { getRoomSnapshot } from '../route';
import { isPlayroomRoomCode } from '../../../../room-code';

type Params = { params: Promise<{ code: string }> };

const FINISH_REASONS: readonly WellFinishReason[] = ['hp', 'fall', 'quit'];

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const normalizedCode = code.toUpperCase();
    if (!isPlayroomRoomCode(normalizedCode)) throw new ApiError('Use a room code like LAD-ZHW.', 400);
    const admin = getAdminClient();
    const guest = await getAuthenticatedGuest(request, admin);
    const body = await readJson(request, 16 * 1024) as {
      action?: string;
      checkpoint?: unknown;
      reason?: string;
      winnerGuestId?: string | null;
      expectedVersion?: number;
    };
    await enforceRateLimit(admin, guest.id, 'well-checkpoint', getClientIpHash(request), 8, 10);

    const { room, members } = await getRoomSnapshot(normalizedCode, guest.id);
    if (room.game_slug !== DOWNSTAIRS_SLUG) throw new ApiError('This room is not a downstairs well.', 400);
    if (room.host_guest_id !== guest.id) throw new ApiError('Only the host simulator may write Checkpoints.', 403);
    if (!members.some((member) => member.guest_id === guest.id)) throw new Error('You are not a member of this room.');
    if (room.status !== 'playing') {
      throw new Error('The game has not started or is already finished.');
    }
    if (!isWellCheckpoint(body.checkpoint)) throw new ApiError('Checkpoint shape is invalid.', 400);

    const expectedVersion = body.expectedVersion ?? room.version;
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new ApiError('Invalid room version.', 400);

    if (body.action === 'checkpoint') {
      if (room.status !== 'playing') throw new Error('The game has not started or is already finished.');
      const nextState = playingState(body.checkpoint);
      const { error } = await admin.rpc('append_game_event', {
        p_room_id: room.id,
        p_guest_id: guest.id,
        p_expected_version: expectedVersion,
        p_state: nextState,
        p_status: 'playing',
        p_event_type: 'checkpoint',
        p_payload: { seq: body.checkpoint.seq },
      });
      if (error) throw error;
      logRoomLifecycle('checkpoint', { roomCode: normalizedCode, guestId: guest.id, version: expectedVersion + 1, status: 'playing' });
    } else if (body.action === 'finish') {
      const reason = body.reason as WellFinishReason;
      if (!FINISH_REASONS.includes(reason)) throw new ApiError('Finish reason must be hp, fall, or quit.', 400);
      const winnerGuestId = body.winnerGuestId === undefined
        ? undefined
        : body.winnerGuestId === null
          ? null
          : typeof body.winnerGuestId === 'string' && body.winnerGuestId.length > 0
            ? body.winnerGuestId
            : undefined;
      if (body.winnerGuestId !== undefined && winnerGuestId === undefined && body.winnerGuestId !== null) {
        throw new ApiError('winnerGuestId must be a guest id string or null.', 400);
      }
      const nextState = finishedState(body.checkpoint, reason, winnerGuestId);
      const { error } = await admin.rpc('append_game_event', {
        p_room_id: room.id,
        p_guest_id: guest.id,
        p_expected_version: expectedVersion,
        p_state: nextState,
        p_status: 'finished',
        p_event_type: 'finish',
        p_payload: { seq: body.checkpoint.seq, reason, winnerGuestId: winnerGuestId ?? null },
      });
      if (error) throw error;
      logRoomLifecycle('finish', { roomCode: normalizedCode, guestId: guest.id, version: expectedVersion + 1, status: 'finished' });
    } else {
      throw new Error('Unknown well action.');
    }

    return Response.json(await getRoomSnapshot(normalizedCode, guest.id));
  } catch (error) {
    logApiFailure('/api/rooms/[code]/well', error);
    return errorResponse(error);
  }
}
