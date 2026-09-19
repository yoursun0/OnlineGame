import { NextRequest } from 'next/server';
import { ApiError, enforceRateLimit, errorResponse, getAdminClient, getAuthenticatedGuest, getClientIpHash, readJson } from '../_lib/supabase-admin';
import { logApiFailure, logRoomLifecycle } from '../_lib/observability';

const AVAILABLE = {
  'tic-tac-toe': 'turn_based',
  'connect-four': 'turn_based',
  downstairs: 'realtime',
} as const;

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const guest = await getAuthenticatedGuest(request, admin);
    const body = await readJson(request) as { gameSlug?: string; mode?: string; displayName?: string };
    const expectedMode = body.gameSlug ? AVAILABLE[body.gameSlug as keyof typeof AVAILABLE] : undefined;
    if (!expectedMode) throw new Error('That game is not available.');
    if (body.mode !== expectedMode) {
      if (body.gameSlug === 'downstairs') throw new ApiError('小朋友落樓梯 is realtime only.', 400);
      if (body.gameSlug === 'connect-four') throw new ApiError('Connect Four is turn-based only.', 400);
      throw new ApiError('Tic-tac-toe is turn-based only.', 400);
    }
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
