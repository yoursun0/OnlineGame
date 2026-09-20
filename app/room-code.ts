export const PLAYROOM_ROOM_CODE = /^(TIK|CON|LAD|TGW)-[2-9A-HJ-NP-Z]{3}$/;

export const PLAYROOM_ROOM_CODE_HINT = 'Use a room code like TIK-7Q4, CON-K8P, LAD-ZHW, or TGW-4K8.';

export function isPlayroomRoomCode(code: string) {
  return PLAYROOM_ROOM_CODE.test(code);
}
