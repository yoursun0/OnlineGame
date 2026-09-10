import { NextRequest } from 'next/server';
import { ApiError, enforceRateLimit, errorResponse, getAdminClient, getAuthenticatedGuest, getClientIpHash, readJson } from '../_lib/supabase-admin';
import { logApiFailure, logRoomLifecycle } from '../_lib/observability';

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const guest = await getAuthenticatedGuest(request, admin);
    const body = await readJson(request) as { gameSlug?: string; mode?: string; displayName?: string };
    if (body.gameSlug !== 'tic-tac-toe') throw new Error('Only Tic-tac-toe rooms are available.');
    if (body.mode !== 'realtime' && body.mode !== 'turn_based') throw new Error('Choose a supported room mode.');
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (displayName.length > 32) throw new ApiError('Display name must be 32 characters or fewer.', 400);
    await enforceRateLimit(admin, guest.id, 'create-room', getClientIpHash(request), 5, 60);
    const { data: roomId, error } = await admin.rpc('create_room_for_guest', {
      p_guest_id: guest.id,
      p_game_slug: body.gameSlug,
      p_mode: body.mode,
      p_display_name: displayName || 'Guest',
    });
    if (error) throw error;
    const { data: room, error: roomError } = await admin.from('rooms').select('code').eq('id', roomId).single();
    if (roomError) throw roomError;
    logRoomLifecycle('create', { roomCode: room.code, guestId: guest.id, status: 'open' });
    return Response.json({ code: room.code });
  } catch (error) {
    logApiFailure('/api/rooms', error);
    return errorResponse(error);
  }
}
