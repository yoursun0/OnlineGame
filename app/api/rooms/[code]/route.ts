import { NextRequest } from 'next/server';
import { createPlayingState, createRematchState, isCatAndDogState, parseDifficulty } from '@playroom/cat-and-dog';
import { connectFour } from '@playroom/connect-four';
import {
  createSharedStartState,
  createSoloStartState,
  DOWNSTAIRS_SLUG,
  finishedState,
  isDownstairsRoomState,
} from '@playroom/downstairs';
import { ticTacToe } from '@playroom/tic-tac-toe';
import { ApiError, enforceRateLimit, errorResponse, getAdminClient, getAuthenticatedGuest, getClientIpHash, readJson } from '../../_lib/supabase-admin';
import { logApiFailure, logRoomLifecycle } from '../../_lib/observability';
import { snapshotAfterCpuTurn } from '../../_lib/apply-cpu-turn';
import { isTienGowState, presentRoomCommandSnapshot, projectTienGowSnapshot } from '../../_lib/tien-gow-room';
import { isPlayroomRoomCode, PLAYROOM_ROOM_CODE_HINT } from '../../../room-code';
import { downstairsReplayGuestIds } from '../../../room-replay';
import { dealPlayroomHand, lobbyStateWithTable, parsePlayroomTable, tableFromLobbyState } from '../../../tien-gow-table';

type Params = { params: Promise<{ code: string }> };

export type RoomSnapshot = {
  room: {
    id: string;
    code: string;
    game_slug: string;
    mode: 'realtime' | 'turn_based';
    status: 'open' | 'playing' | 'finished' | 'expired';
    host_guest_id: string;
    state: any;
    version: number;
    max_players: number;
  };
  members: Array<{ guest_id: string; display_name: string; seat: number; is_ready: boolean; is_cpu?: boolean }>;
  events: Array<{ version: number; event_type: string; payload?: unknown }>;
};

async function getRoomSnapshot(code: string, guestId: string, sinceVersion = 0): Promise<RoomSnapshot> {
  const admin = getAdminClient();
  const { data, error } = await admin.rpc('get_room_snapshot', {
    p_code: code,
    p_guest_id: guestId,
    p_since_version: sinceVersion,
  });
  if (error) throw error;
  const snapshot = (typeof data === 'string' ? JSON.parse(data) : data) as RoomSnapshot | null;
  if (!snapshot?.room?.id) throw new Error('Room not found or expired.');
  return snapshot;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const normalizedCode = code.toUpperCase();
    if (!isPlayroomRoomCode(normalizedCode)) throw new ApiError(PLAYROOM_ROOM_CODE_HINT, 400);
    const admin = getAdminClient();
    const guest = await getAuthenticatedGuest(request, admin);
    const sinceRaw = new URL(request.url).searchParams.get('since');
    const sinceVersion = sinceRaw === null ? 0 : Number(sinceRaw);
    if (!Number.isInteger(sinceVersion) || sinceVersion < 0 || sinceVersion > 1000000) throw new ApiError('Invalid event version.', 400);
    return Response.json(projectTienGowSnapshot(
      await getRoomSnapshot(normalizedCode, guest.id, sinceVersion),
      guest.id,
    ));
  } catch (error) {
    logApiFailure('/api/rooms/[code]', error);
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  let action = 'unknown';
  let normalizedCode: string | undefined;
  try {
    const { code } = await params;
    normalizedCode = code.toUpperCase();
    if (!isPlayroomRoomCode(normalizedCode)) throw new ApiError(PLAYROOM_ROOM_CODE_HINT, 400);
    const admin = getAdminClient();
    const guest = await getAuthenticatedGuest(request, admin);
    const body = await readJson(request) as { action?: string; displayName?: string; reason?: string; ready?: boolean; table?: unknown; difficulty?: unknown };
    action = body.action ?? 'unknown';
    if (body.action === 'join') {
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
      if (!displayName) throw new Error('Enter a display name before joining.');
      if (displayName.length > 32) throw new ApiError('Display name must be 32 characters or fewer.', 400);
      await enforceRateLimit(admin, guest.id, 'join-room', getClientIpHash(request), 10, 60);
      const { error } = await admin.rpc('join_room_for_guest', { p_code: normalizedCode, p_guest_id: guest.id, p_display_name: displayName });
      if (error) throw error;
      logRoomLifecycle('join', { roomCode: normalizedCode, guestId: guest.id, status: 'open' });
    } else if (body.action === 'ready') {
      const { error } = await admin.rpc('set_room_ready_for_guest', { p_code: normalizedCode, p_guest_id: guest.id, p_ready: body.ready !== false });
      if (error) throw error;
      logRoomLifecycle('ready', { roomCode: normalizedCode, guestId: guest.id });
    } else if (body.action === 'table') {
      const current = await getRoomSnapshot(normalizedCode, guest.id);
      if (current.room.game_slug !== 'tien-gow') throw new ApiError('Table options are only for 打天九.', 400);
      if (current.room.status !== 'open') throw new ApiError('Table options can only be set before the first hand.', 400);
      if (current.room.host_guest_id !== guest.id) throw new ApiError('Only the host can set Table options.', 403);
      const table = parsePlayroomTable(body.table);
      const { error } = await admin.from('rooms').update({
        state: lobbyStateWithTable(table),
        last_activity_at: new Date().toISOString(),
      }).eq('id', current.room.id).eq('status', 'open');
      if (error) throw error;
      logRoomLifecycle('table', { roomCode: normalizedCode, guestId: guest.id, status: 'open' });
    } else if (body.action === 'start') {
      const { error } = await admin.rpc('start_room_for_guest', { p_code: normalizedCode, p_guest_id: guest.id });
      if (error) throw error;
      const started = await getRoomSnapshot(normalizedCode, guest.id);
      if (started.room.game_slug === 'tien-gow') {
        const humans = started.members.filter((member) => !member.is_cpu);
        if (humans.length < 1 || humans.length > 4 || started.members.length !== 4) {
          throw new ApiError('A 打天九 table needs 1–4 humans.', 400);
        }
        const table = body.table !== undefined ? parsePlayroomTable(body.table) : tableFromLobbyState(started.room.state);
        const initial = dealPlayroomHand({ kind: 'open', code: normalizedCode, table });
        const { error: startEventError } = await admin.rpc('append_game_event', {
          p_room_id: started.room.id,
          p_guest_id: guest.id,
          p_expected_version: started.room.version,
          p_state: initial,
          p_status: 'playing',
          p_event_type: 'start',
          p_payload: { seats: 4, humans: humans.length, table },
        });
        if (startEventError) throw startEventError;
      } else if (started.room.game_slug === DOWNSTAIRS_SLUG) {
        const humans = started.members
          .filter((member) => !member.is_cpu)
          .sort((a, b) => a.seat - b.seat);
        if (humans.length < 1 || humans.length > 4) {
          throw new ApiError('A LAD well supports Solo (1) or Shared (2–4) kids.', 400);
        }
        const guestIds = [
          guest.id,
          ...humans.filter((member) => member.guest_id !== guest.id).map((member) => member.guest_id as string),
        ];
        const initial = humans.length === 1
          ? createSoloStartState(guest.id)
          : createSharedStartState(guestIds);
        const { error: startEventError } = await admin.rpc('append_game_event', {
          p_room_id: started.room.id,
          p_guest_id: guest.id,
          p_expected_version: started.room.version,
          p_state: initial,
          p_status: 'playing',
          p_event_type: 'start',
          p_payload: { kids: guestIds.length },
        });
        if (startEventError) throw startEventError;
      } else if (started.room.game_slug === 'cat-and-dog') {
        const humans = started.members.filter((member) => !member.is_cpu);
        const difficulty = humans.length === 1 ? parseDifficulty(body.difficulty) : null;
        if (humans.length === 1 && !difficulty) throw new ApiError('Choose a difficulty before starting versus CPU.', 400);
        const initial = createPlayingState({ roomCode: normalizedCode, difficulty });
        const { error: startEventError } = await admin.rpc('append_game_event', {
          p_room_id: started.room.id,
          p_guest_id: guest.id,
          p_expected_version: started.room.version,
          p_state: initial,
          p_status: 'playing',
          p_event_type: 'start',
          p_payload: { difficulty, humans: humans.length },
        });
        if (startEventError) throw startEventError;
      }
      logRoomLifecycle('start', { roomCode: normalizedCode, guestId: guest.id, status: 'playing' });
    } else if (body.action === 'leave') {
      // Host leave mid-fall ends the well for remaining guests (v1: no host handoff).
      try {
        const current = await getRoomSnapshot(normalizedCode, guest.id);
        if (
          current.room.game_slug === DOWNSTAIRS_SLUG
          && current.room.status === 'playing'
          && current.room.host_guest_id === guest.id
          && isDownstairsRoomState(current.room.state)
          && current.room.state.checkpoint
        ) {
          const nextState = finishedState(current.room.state.checkpoint, 'host_left', null);
          const { error: finishError } = await admin.rpc('append_game_event', {
            p_room_id: current.room.id,
            p_guest_id: guest.id,
            p_expected_version: current.room.version,
            p_state: nextState,
            p_status: 'finished',
            p_event_type: 'finish',
            p_payload: { seq: current.room.state.checkpoint.seq, reason: 'host_left', winnerGuestId: null },
          });
          if (finishError) throw finishError;
          logRoomLifecycle('finish', { roomCode: normalizedCode, guestId: guest.id, version: current.room.version + 1, status: 'finished' });
        }
      } catch {
        // Best-effort: leave still proceeds if finish raced or room already ended.
      }
      const { error } = await admin.rpc('leave_room_for_guest', { p_code: normalizedCode, p_guest_id: guest.id });
      if (error) throw error;
      logRoomLifecycle('leave', { roomCode: normalizedCode, guestId: guest.id });
      return Response.json({ left: true });
    } else if (body.action === 'report') {
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (reason.length < 1 || reason.length > 280) throw new ApiError('Report reason must be between 1 and 280 characters.', 400);
      await enforceRateLimit(admin, guest.id, 'report-room', getClientIpHash(request), 3, 3600);
      const { error } = await admin.rpc('report_room_for_guest', { p_code: normalizedCode, p_guest_id: guest.id, p_reason: reason });
      if (error) throw error;
      logRoomLifecycle('report', { roomCode: normalizedCode, guestId: guest.id });
    } else if (body.action === 'replay') {
      await enforceRateLimit(admin, guest.id, 'replay-room', getClientIpHash(request), 5, 60);
      const current = await getRoomSnapshot(normalizedCode, guest.id);
      if (current.room.game_slug === 'tien-gow') {
        throw new ApiError('Wait until 結 before dealing the next hand.', 400);
      }
      let initialState;
      if (current.room.game_slug === 'cat-and-dog') {
        if (!isCatAndDogState(current.room.state)) throw new ApiError('Cat-and-Dog state is missing.', 409);
        initialState = createRematchState(current.room.state);
      } else if (current.room.game_slug === 'connect-four') {
        initialState = connectFour.createInitialState();
      } else if (current.room.game_slug === DOWNSTAIRS_SLUG) {
        const guestIds = downstairsReplayGuestIds(
          current.room.host_guest_id as string,
          current.members as Array<{ guest_id: string; seat: number; is_cpu?: boolean }>,
        );
        initialState = guestIds.length === 1
          ? createSoloStartState(guestIds[0]!)
          : createSharedStartState(guestIds);
      } else {
        initialState = ticTacToe.createInitialState();
      }
      const { error } = await admin.rpc('replay_room_for_guest', {
        p_code: normalizedCode,
        p_guest_id: guest.id,
        p_state: initialState,
      });
      if (error) throw error;
      logRoomLifecycle('replay', { roomCode: normalizedCode, guestId: guest.id, status: 'playing' });
    } else if (body.action === 'rematch' || body.action === 'next') {
      await enforceRateLimit(admin, guest.id, 'replay-room', getClientIpHash(request), 5, 60);
      const current = await getRoomSnapshot(normalizedCode, guest.id);
      if (current.room.game_slug !== 'tien-gow') throw new ApiError('Wait until 結 before dealing the next hand.', 400);
      if (current.room.status !== 'playing' || !isTienGowState(current.room.state) || current.room.state.phase !== 'recap') {
        throw new ApiError('Wait until 結 before dealing the next hand.', 400);
      }
      const member = current.members.find((candidate) => candidate.guest_id === guest.id);
      if (!member || member.is_cpu) throw new Error('You are not a member of this room.');
      const nextState = dealPlayroomHand({
        kind: body.action,
        code: normalizedCode,
        current: current.room.state,
      });
      const { error } = await admin.rpc('append_game_event', {
        p_room_id: current.room.id,
        p_guest_id: guest.id,
        p_expected_version: current.room.version,
        p_state: nextState,
        p_status: 'playing',
        p_event_type: 'start',
        p_payload: { kind: body.action, seats: 4 },
      });
      if (error) throw error;
      logRoomLifecycle('start', { roomCode: normalizedCode, guestId: guest.id, status: 'playing' });
    } else {
      throw new Error('Unknown room action.');
    }
    return Response.json(presentRoomCommandSnapshot(
      await snapshotAfterCpuTurn(
        await getRoomSnapshot(normalizedCode!, guest.id),
        () => getRoomSnapshot(normalizedCode!, guest.id),
        undefined,
        normalizedCode,
      ),
      guest.id,
    ));
  } catch (error) {
    logApiFailure(`/api/rooms/[code]#${action}`, error, normalizedCode);
    return errorResponse(error);
  }
}

export { getRoomSnapshot };
