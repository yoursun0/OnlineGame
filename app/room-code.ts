export const PLAYROOM_ROOM_CODE = /^(TIK|CON|LAD|TGW|CAD)-[2-9A-HJ-NP-Z]{3}$/;

export const PLAYROOM_ROOM_CODE_HINT = 'Use a room code like TIK-7Q4, CON-K8P, LAD-ZHW, TGW-4K8, or CAD-7KQ.';

export function isPlayroomRoomCode(code: string) {
  return PLAYROOM_ROOM_CODE.test(code);
}
