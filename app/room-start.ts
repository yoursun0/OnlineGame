export function canHostStartRoom(input: {
  status: 'open' | 'playing' | 'finished' | 'expired';
  hostGuestId: string;
  guestId: string;
  members: Array<{ is_ready: boolean; is_cpu?: boolean }>;
  maxPlayers: number;
  gameSlug?: string;
}) {
  if (input.status !== 'open' || input.hostGuestId !== input.guestId) return false;
  const humans = input.members.filter((member) => !member.is_cpu);
  if (humans.length === 1) return true;
  if (input.gameSlug === 'downstairs') {
    // Issue #11: Shared well is 2 humans, all ready. Room max stays 4 for later tickets.
    return humans.length === 2 && humans.every((member) => member.is_ready);
  }
  return input.members.length === input.maxPlayers && input.members.every((member) => member.is_ready);
}
