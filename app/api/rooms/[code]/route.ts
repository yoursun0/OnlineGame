import { NextRequest } from 'next/server';
import { errorResponse, getAdminClient, getAuthenticatedGuest, readJson } from '../../_lib/supabase-admin';

type Params = { params: Promise<{ code: string }> };

async function getRoomSnapshot(code: string, guestId: string) {
  const admin = getAdminClient();
  const { data: room, error: roomError } = await admin.from('rooms').select('*').eq('code', code).maybeSingle();
  if (roomError) throw roomError;
  if (!room) throw new Error('Room not found or expired.');
  const { data: members, error: membersError } = await admin.from('room_members').select('*').eq('room_id', room.id).order('seat');
  if (membersError) throw membersError;
  if (!members?.some((member) => member.guest_id === guestId)) throw new Error('Join this room before reading its state.');
  const { data: events, error: eventsError } = await admin.from('game_events').select('*').eq('room_id', room.id).order('version', { ascending: true }).limit(100);
  if (eventsError) throw eventsError;
  return { room, members: members ?? [], events: events ?? [] };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const admin = getAdminClient();
    const guest = await getAuthenticatedGuest(request, admin);
    return Response.json(await getRoomSnapshot(code.toUpperCase(), guest.id));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const normalizedCode = code.toUpperCase();
    const admin = getAdminClient();
    const guest = await getAuthenticatedGuest(request, admin);
    const body = await readJson(request) as { action?: string; displayName?: string; ready?: boolean };
    if (body.action === 'join') {
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 32) : '';
      if (!displayName) throw new Error('Enter a display name before joining.');
      const { error } = await admin.rpc('join_room_for_guest', { p_code: normalizedCode, p_guest_id: guest.id, p_display_name: displayName });
      if (error) throw error;
    } else if (body.action === 'ready') {
      const { error } = await admin.rpc('set_room_ready_for_guest', { p_code: normalizedCode, p_guest_id: guest.id, p_ready: body.ready !== false });
      if (error) throw error;
    } else if (body.action === 'start') {
      const { error } = await admin.rpc('start_room_for_guest', { p_code: normalizedCode, p_guest_id: guest.id });
      if (error) throw error;
    } else if (body.action === 'leave') {
      const { error } = await admin.rpc('leave_room_for_guest', { p_code: normalizedCode, p_guest_id: guest.id });
      if (error) throw error;
      return Response.json({ left: true });
    } else {
      throw new Error('Unknown room action.');
    }
    return Response.json(await getRoomSnapshot(normalizedCode, guest.id));
  } catch (error) { return errorResponse(error); }
}

export { getRoomSnapshot };
