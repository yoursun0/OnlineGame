import { NextRequest } from 'next/server';
import { ticTacToe } from '@playroom/tic-tac-toe';
import { ApiError, enforceRateLimit, errorResponse, getAdminClient, getAuthenticatedGuest, getClientIpHash, readJson } from '../../_lib/supabase-admin';
import { logApiFailure, logRoomLifecycle } from '../../_lib/observability';
import { snapshotAfterCpuTurn } from '../../_lib/apply-cpu-turn';

type Params = { params: Promise<{ code: string }> };

const ROOM_CODE = /^TIK-[2-9A-HJ-NP-Z]{3}$/;

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
    if (!ROOM_CODE.test(normalizedCode)) throw new ApiError('Use a room code like TIK-7Q4.', 400);
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
    if (!ROOM_CODE.test(normalizedCode)) throw new ApiError('Use a room code like TIK-7Q4.', 400);
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
      logRoomLifecycle('start', { roomCode: normalizedCode, guestId: guest.id, status: 'playing' });
    } else if (body.action === 'leave') {
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
      const { error } = await admin.rpc('replay_room_for_guest', {
        p_code: normalizedCode,
        p_guest_id: guest.id,
        p_state: ticTacToe.createInitialState(),
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
