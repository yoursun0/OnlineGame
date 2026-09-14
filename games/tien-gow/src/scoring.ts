import type { Combo } from './combinations';
import { getTile } from './tiles';
import type { Table } from './table';

export type SlamKind = 'seven' | 'eight';

export type Payment = {
  from: number;
  to: number;
  amount: number;
  reason: string;
};

export type SettleFlags = {
  baoHonor: boolean;
  fourBao: boolean;
  yaoJie: boolean;
  yaoCapture: boolean;
  slam: SlamKind | null;
  example: string | null;
};

export function ordinaryNet(dong: number): number {
  if (dong <= 0) return -5;
  if (dong === 1) return -3;
  if (dong === 2) return -2;
  if (dong === 3) return -1;
  return dong - 4;
}

export function bankerMultiplier(streak: number): number {
  return streak + 1;
}

export function stakeMultiplier(
  jieSeat: number,
  otherSeat: number,
  bankerSeat: number,
  bankerStreak: number,
  netOfOther: number,
): number {
  if (otherSeat === bankerSeat && netOfOther > 0) return 1;
  if (jieSeat === bankerSeat || otherSeat === bankerSeat) return bankerMultiplier(bankerStreak);
  return 1;
}

export function hePayments(
  collector: number,
  bankerSeat: number,
  bankerStreak: number,
  base: number,
  reason: string,
): Payment[] {
  const payments: Payment[] = [];
  for (let seat = 0; seat < 4; seat += 1) {
    if (seat === collector) continue;
    const amount = collector === bankerSeat || seat === bankerSeat ? base * bankerMultiplier(bankerStreak) : base;
    payments.push({ from: seat, to: collector, amount, reason });
  }
  return payments;
}

export function applyPayments(chips: readonly number[], payments: readonly Payment[]): number[] {
  const next = [...chips];
  for (const payment of payments) {
    next[payment.from] -= payment.amount;
    next[payment.to] += payment.amount;
  }
  return next;
}

export function isBankerEightForbidden(firstLead: Combo | null): boolean {
  if (!firstLead) return false;
  if (firstLead.class === 'supreme') return true;
  if (firstLead.class === 'singleWen' && firstLead.rank === 1) return true;
  if (firstLead.class === 'singleWu' && firstLead.rank === 1) return true;
  return false;
}

export function detectSlam(input: {
  table: Table;
  dong: readonly number[];
  jieSeat: number;
  lastCombo: Combo | null;
  forcedLastSingleton: boolean;
  firstLead: Combo | null;
  bankerSeat: number;
  exampleSlam?: SlamKind | null;
}): SlamKind | null {
  if (input.exampleSlam) return input.exampleSlam;
  if (!input.table.slam) return null;
  if (input.dong[input.jieSeat] !== 8) return null;
  if (input.lastCombo && input.lastCombo.tiles.length === 1 && input.forcedLastSingleton) return 'seven';
  if (isEightLastTrick(input.lastCombo, input.table)) {
    if (input.jieSeat === input.bankerSeat && isBankerEightForbidden(input.firstLead)) return 'seven';
    return 'eight';
  }
  return 'seven';
}

function isEightLastTrick(lastCombo: Combo | null, table: Table): boolean {
  if (!lastCombo) return false;
  if (lastCombo.tiles.length >= 2) return true;
  if (lastCombo.class === 'singleWen' && lastCombo.rank === 1) return true;
  if (lastCombo.class === 'singleWu' && lastCombo.rank === 1) return true;
  const tile = getTile(lastCombo.tiles[0]);
  if (tile.name === 'sanjie') return true;
  if (table.wenHonor && tile.name === 'lingren') return true;
  return false;
}

export function settleJie(input: {
  dong: readonly number[];
  jieSeat: number;
  bankerSeat: number;
  bankerStreak: number;
  table: Table;
  flags: SettleFlags;
  capturedSeat?: number;
}): Payment[] {
  const { dong, jieSeat, bankerSeat, bankerStreak, flags } = input;
  const slamMult = flags.slam === 'eight' ? 4 : flags.slam === 'seven' ? 2 : 1;
  const specialMult = flags.yaoCapture ? 1 : flags.fourBao ? 4 : flags.baoHonor || flags.yaoJie ? 2 : 1;
  const belowPar: Payment[] = [];
  const payments: Payment[] = [];

  for (let seat = 0; seat < 4; seat += 1) {
    if (seat === jieSeat) continue;
    const net = flags.example ? -5 : ordinaryNet(dong[seat]);
    if (net === 0) continue;
    const stake = stakeMultiplier(jieSeat, seat, bankerSeat, bankerStreak, net);
    if (net > 0) {
      const reason = net === 1 ? '入一' : net === 2 ? '入二' : `入${net}`;
      payments.push({ from: jieSeat, to: seat, amount: net * stake, reason });
      continue;
    }
    let amount = flags.slam || flags.example ? 5 * slamMult : -net;
    amount *= specialMult;
    amount *= stake;
    const payment = { from: seat, to: jieSeat, amount, reason: settleReason(flags) };
    if (flags.yaoCapture) belowPar.push({ ...payment, amount: (-net) * stake });
    else payments.push(payment);
  }

  if (flags.yaoCapture) {
    const captured = input.capturedSeat;
    if (captured == null) throw new Error('么雙擒四 requires a captured seat.');
    const covered = belowPar.reduce((sum, payment) => sum + payment.amount, 0);
    payments.push({ from: captured, to: jieSeat, amount: covered * 4, reason: '么雙擒四' });
  }

  return payments;
}

function settleReason(flags: SettleFlags): string {
  if (flags.example) return flags.example;
  if (flags.fourBao) return '四大包';
  if (flags.baoHonor) return '包尊';
  if (flags.yaoJie) return '么結';
  if (flags.slam === 'eight') return '八支';
  if (flags.slam === 'seven') return '七支';
  return '結';
}
