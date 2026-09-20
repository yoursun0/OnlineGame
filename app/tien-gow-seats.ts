import { shuffle } from '@playroom/tien-gow';

export const TGW_SEAT_COUNT = 4;

/**
 * Absolute Playroom / lab seats, counterclockwise from above:
 * 0 = 南 South, 1 = 東 East, 2 = 北 North, 3 = 西 West.
 * Random permutation is applied at host start.
 *
 * Playroom orients the table from `viewerSeat` so that seat is always at the
 * bottom of the viewport. CSS classes `south`/`east`/`north`/`west` are
 * viewport grid areas (bottom/right/top/left), not absolute winds.
 *
 * Helic: viewerSeat=3 (West) → bottom=West, left=North, top=East, right=South.
 */
export const TGW_SEAT_WINDS = ['south', 'east', 'north', 'west'] as const;
export const TGW_SEAT_WIND_ZH = ['南', '東', '北', '西'] as const;
export const TGW_SEAT_WIND_EN = ['South', 'East', 'North', 'West'] as const;
export const TGW_VIEWPORT_REGIONS = ['bottom', 'right', 'top', 'left'] as const;

export type TienGowViewportRegion = (typeof TGW_VIEWPORT_REGIONS)[number];
export type TienGowViewportPlace = (typeof TGW_SEAT_WINDS)[number];

export const TGW_VIEWPORT_PLACE = {
  bottom: 'south',
  right: 'east',
  top: 'north',
  left: 'west',
} as const satisfies Record<TienGowViewportRegion, TienGowViewportPlace>;

export type TienGowViewportSlot = {
  seat: number;
  region: TienGowViewportRegion;
  place: TienGowViewportPlace;
};

export function tienGowViewportLayout(viewerSeat: number): TienGowViewportSlot[] {
  const origin = ((viewerSeat % TGW_SEAT_COUNT) + TGW_SEAT_COUNT) % TGW_SEAT_COUNT;
  return TGW_VIEWPORT_REGIONS.map((region, offset) => {
    const seat = (origin + offset) % TGW_SEAT_COUNT;
    return { seat, region, place: TGW_VIEWPORT_PLACE[region] };
  });
}

export function tienGowSeatWind(seat: number, language: 'en' | 'zh-Hant'): string {
  const index = ((seat % TGW_SEAT_COUNT) + TGW_SEAT_COUNT) % TGW_SEAT_COUNT;
  return language === 'zh-Hant' ? TGW_SEAT_WIND_ZH[index]! : TGW_SEAT_WIND_EN[index]!;
}

export function tienGowSeatMark(seat: number, language: 'en' | 'zh-Hant'): string {
  const index = ((seat % TGW_SEAT_COUNT) + TGW_SEAT_COUNT) % TGW_SEAT_COUNT;
  return language === 'zh-Hant' ? TGW_SEAT_WIND_ZH[index]! : TGW_SEAT_WIND_EN[index]![0]!;
}

export function fillTienGowCpuSeats<T>(
  humans: readonly T[],
  makeCpu: (cpuIndex: number) => T,
): T[] {
  if (humans.length < 1 || humans.length > TGW_SEAT_COUNT) {
    throw new Error('A 打天九 table needs 1–4 humans.');
  }
  const filled = [...humans];
  for (let index = 0; index < TGW_SEAT_COUNT - humans.length; index += 1) {
    filled.push(makeCpu(index));
  }
  return filled;
}

export function assignTienGowSeats<T>(members: readonly T[], seed: string): Array<T & { seat: number }> {
  if (members.length !== TGW_SEAT_COUNT) {
    throw new Error('打天九 seats must be a permutation of 0–3.');
  }
  return shuffle(members, `tgw-seats:${seed}`).map((member, seat) => ({ ...member, seat }));
}

export type TienGowLobbySlot<T extends { seat: number; is_cpu?: boolean }> =
  | { seat: number; occupied: true; member: T }
  | { seat: number; occupied: false; member: null };

export function tienGowLobbySlots<T extends { seat: number; is_cpu?: boolean }>(
  members: readonly T[],
): TienGowLobbySlot<T>[] {
  return [0, 1, 2, 3].map((seat) => {
    const member = members.find((candidate) => candidate.seat === seat) ?? null;
    return member
      ? { seat, occupied: true as const, member }
      : { seat, occupied: false as const, member: null };
  });
}
