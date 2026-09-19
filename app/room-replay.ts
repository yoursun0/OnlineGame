/** Whether the finished-room Replay control should show (Connect Four / TIK / LAD). */
export function canShowRoomReplay(input: {
  status: 'open' | 'playing' | 'finished' | 'expired';
  gameSlug?: string;
  isMember: boolean;
  memberCount: number;
  maxPlayers: number;
  humanCount: number;
  hostStillPresent: boolean;
}) {
  if (input.status !== 'finished' || !input.isMember) return false;
  if (input.gameSlug === 'downstairs') {
    // Same-room rematch like CF: any remaining member may press Replay while
    // the host simulator is still seated. Occupancy may be Solo (1) or Shared (2–4);
    // max_players stays 4 so we do not require a full room.
    return input.hostStillPresent && input.humanCount >= 1 && input.humanCount <= 4;
  }
  return input.memberCount === input.maxPlayers;
}

/** Host-first guest ids for a downstairs rematch Checkpoint (matches start). */
export function downstairsReplayGuestIds(
  hostGuestId: string,
  members: Array<{ guest_id: string; seat: number; is_cpu?: boolean }>,
) {
  const humans = members
    .filter((member) => !member.is_cpu)
    .sort((a, b) => a.seat - b.seat);
  if (humans.length < 1 || humans.length > 4) {
    throw new Error('A LAD well supports Solo (1) or Shared (2–4) kids.');
  }
  if (!humans.some((member) => member.guest_id === hostGuestId)) {
    throw new Error('The host must still be in the room to replay.');
  }
  return [
    hostGuestId,
    ...humans.filter((member) => member.guest_id !== hostGuestId).map((member) => member.guest_id),
  ];
}
