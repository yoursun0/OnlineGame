import { NextRequest } from 'next/server';
import { connectFour } from '@playroom/connect-four';
import {
  createSharedStartState,
  createSoloStartState,
  DOWNSTAIRS_SLUG,
  finishedState,
  isDownstairsRoomState,
} from '@playroom/downstairs';
import { ticTacToe } from '@playroom/tic-tac-toe';
import { createHand } from '@playroom/tien-gow';
import { ApiError, enforceRateLimit, errorResponse, getAdminClient, getAuthenticatedGuest, getClientIpHash, readJson } from '../../_lib/supabase-admin';
import { logApiFailure, logRoomLifecycle } from '../../_lib/observability';
import { snapshotAfterCpuTurn } from '../../_lib/apply-cpu-turn';
import { isPlayroomRoomCode, PLAYROOM_ROOM_CODE_HINT } from '../../../room-code';
import { downstairsReplayGuestIds } from '../../../room-replay';

type Params = { params: Promise<{ code: string }> };

async function getRoomSnapshot(code: string, guestId: string, sinceVersion = 0) {
  const admin = getAdminClient();
  const { data: room, error: roomError } = await admin.from('rooms').select('*').eq('code', code).maybeSingle();
  if (roomError) throw roomError;
  if (!room) throw new Error('Room not found or expired.');
  const { data: members, error: membersError } = await admin.from('room_members').select('*').eq('room_id', room.id).order('seat');
  if (membersError) throw membersError;
  if (!members?.some((member) => member.guest_id === guestId)) throw new Error('Join this room before reading its state.');
  let eventsQuery = admin.from('game_events').select('*').eq('room_id', room.id).order('version', { ascending: true }).limit(100);
  if (sinceVersion > 0) eventsQuery = eventsQuery.gt('version', sinceVersion);
  const { data: events, error: eventsError } = await eventsQuery;
  if (eventsError) throw eventsError;
  return { room, members: members ?? [], events: events ?? [] };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const normalizedCode = code.toUpperCase();
    if (!isPlayroomRoomCode(normalizedCode)) throw new ApiError(PLAYROOM_ROOM_CODE_HINT, 400);
    const admin = getAdminClient();
    const guest = await getAuthenticatedGuest(request, admin);
    const { error: expiryError } = await admin.rpc('expire_idle_rooms', { p_now: new Date().toISOString() });
    if (expiryError) throw expiryError;
    const sinceRaw = new URL(request.url).searchParams.get('since');
    const sinceVersion = sinceRaw === null ? 0 : Number(sinceRaw);
    if (!Number.isInteger(sinceVersion) || sinceVersion < 0 || sinceVersion > 1000000) throw new ApiError('Invalid event version.', 400);
    return Response.json(await snapshotAfterCpuTurn(
      await getRoomSnapshot(normalizedCode, guest.id, sinceVersion),
      () => getRoomSnapshot(normalizedCode, guest.id, sinceVersion),
      undefined,
      normalizedCode,
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
    const body = await readJson(request) as { action?: string; displayName?: string; reason?: string; ready?: boolean };
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
    } else if (body.action === 'start') {
      const { error } = await admin.rpc('start_room_for_guest', { p_code: normalizedCode, p_guest_id: guest.id });
      if (error) throw error;
      const started = await getRoomSnapshot(normalizedCode, guest.id);
      if (started.room.game_slug === 'tien-gow') {
        const humans = started.members.filter((member) => !member.is_cpu);
        if (humans.length < 1 || humans.length > 4 || started.members.length !== 4) {
          throw new ApiError('A 打天九 table needs 1–4 humans.', 400);
        }
        const initial = createHand({ seed: `tgw:${normalizedCode}` });
        const { error: startEventError } = await admin.rpc('append_game_event', {
          p_room_id: started.room.id,
          p_guest_id: guest.id,
          p_expected_version: started.room.version,
          p_state: initial,
          p_status: 'playing',
          p_event_type: 'start',
          p_payload: { seats: 4, humans: humans.length },
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
      let initialState;
      if (current.room.game_slug === 'connect-four') {
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
    } else {
      throw new Error('Unknown room action.');
    }
    return Response.json(await snapshotAfterCpuTurn(
      await getRoomSnapshot(normalizedCode!, guest.id),
      () => getRoomSnapshot(normalizedCode!, guest.id),
      undefined,
      normalizedCode,
    ));
  } catch (error) {
    logApiFailure(`/api/rooms/[code]#${action}`, error, normalizedCode);
    return errorResponse(error);
  }
}

export { getRoomSnapshot };
