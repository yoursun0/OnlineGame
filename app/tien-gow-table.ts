import {
  createHand,
  DEFAULT_TABLE,
  mergeTable,
  nextHandSeed,
  type State,
  type Table,
} from '@playroom/tien-gow';

export const TABLE_OPTION_KEYS = [
  'wenHonor',
  'captureWenHonor',
  'yaoSettle',
  'yaoCapture',
  'baoHonor',
  'fourBless',
  'slam',
  'examples',
  'baoHonorAlsoHe',
  'extraExamples',
] as const satisfies ReadonlyArray<keyof Table>;

export type TableOptionKey = (typeof TABLE_OPTION_KEYS)[number];

export const TABLE_OPTIONS: Array<{
  key: TableOptionKey;
  label: string;
  labelEn: string;
  hint: string;
  hintEn: string;
}> = [
  { key: 'wenHonor', label: '文尊', labelEn: 'Wen honor', hint: '孖伶冧作文尊。領出後除非開了擒文尊，否則無人可打。', hintEn: 'Pair of 伶冧 is 文尊. Lead-only unbeatable unless 擒文尊 is on.' },
  { key: 'captureWenHonor', label: '擒文尊', labelEn: 'Capture wen honor', hint: '孖高腳可打領出的文尊，並照賀尊收錢。需先開文尊。', hintEn: 'Pair of 高腳 may beat led 文尊 and collect as 賀尊. Needs 文尊.' },
  { key: 'yaoSettle', label: '么結', labelEn: 'Yao settle', hint: '單張么三結牌為么結 ×2。開了文尊時，單張伶冧六也可么結。', hintEn: 'Singleton 么三 結 is 么結 ×2. With 文尊, singleton 伶冧六 also 么結.' },
  { key: 'yaoCapture', label: '么雙擒四', labelEn: 'Yao capture', hint: '大頭六結領出的么三、或高腳七結領出的伶冧六：被擒者代付低於門檻的輸分，再 ×4。需先開么結。', hintEn: '大頭六 結 led 么三, or 高腳七 結 led 伶冧六: captured seat covers below-par losses, then ×4. Needs 么結.' },
  { key: 'baoHonor', label: '包尊', labelEn: 'Bao honor', hint: '最後一墩至尊（武尊，或無人打的文尊）為包尊，結分 ×2。該墩不收賀錢。', hintEn: 'Last-trick 至尊 (武尊, or unbeaten 文尊) is 包尊 ×2. No 賀 on that trick.' },
  { key: 'fourBless', label: '賀四 / 四大包', labelEn: 'Four bless', hint: '非最後的四文武收賀四（基數 4）。最後一墩四文武為四大包 ×4。', hintEn: 'Non-final 四文武 pays 賀四 (base 4). Last-trick 四文武 is 四大包 ×4.' },
  { key: 'slam', label: '七支 / 八支', labelEn: 'Slam', hint: '結時拿齊 8 棟。視最後一墩為七支 ×2 或八支 ×4。', hintEn: '結 with all 8 棟. Last trick decides 七支 ×2 or 八支 ×4.' },
  { key: 'examples', label: '例牌', labelEn: 'Examples', hint: '開牌後先看例牌：一點紅、七武、全白、八武。符合者可即時結，不打牌。', hintEn: 'After the deal, 一點紅 / 七武 / 全白 / 八武 may 結 immediately.' },
  { key: 'baoHonorAlsoHe', label: '包尊亦賀', labelEn: 'Bao also 賀', hint: '包尊／四大包仍先收賀錢，再算結分倍數。', hintEn: '包尊 / 四大包 still collect 賀, then the 結 multiplier.' },
  { key: 'extraExamples', label: '額外例牌', labelEn: 'Extra examples', hint: '加四對子、七星文士、八方文士三款例牌。', hintEn: 'Adds 四對子, 七星文士, and 八方文士.' },
];

export type TienGowLobbyState = {
  kind: 'tien-gow';
  phase: 'lobby';
  table?: Partial<Table>;
};

export function isTienGowLobbyState(value: unknown): value is TienGowLobbyState {
  if (!value || typeof value !== 'object') return false;
  const record = value as { kind?: unknown; phase?: unknown };
  return record.kind === 'tien-gow' && record.phase === 'lobby';
}

export function parsePlayroomTable(value: unknown): Table {
  if (!value || typeof value !== 'object') return mergeTable();
  const record = value as Record<string, unknown>;
  const partial: Partial<Table> = {};
  for (const key of TABLE_OPTION_KEYS) {
    if (typeof record[key] === 'boolean') partial[key] = record[key];
  }
  return mergeTable(partial);
}

export function tableFromLobbyState(state: unknown): Table {
  if (isTienGowLobbyState(state)) return parsePlayroomTable(state.table);
  return mergeTable();
}

export function togglePlayroomTableOption(table: Table, key: TableOptionKey, checked: boolean): Table {
  return mergeTable({ ...table, [key]: checked });
}

export function optionDisabled(table: Table, key: TableOptionKey): boolean {
  if (key === 'captureWenHonor') return !table.wenHonor;
  if (key === 'yaoCapture') return !table.yaoSettle;
  return false;
}

export function dealPlayroomHand(input: {
  kind: 'open' | 'rematch' | 'next';
  code: string;
  table?: Table;
  current?: State;
}): State {
  if (input.kind === 'open') {
    return createHand({ seed: `tgw:${input.code}`, table: input.table });
  }
  const current = input.current;
  if (!current || current.phase !== 'recap' || current.jieSeat === null) {
    throw new Error('Wait until 結 before dealing the next hand.');
  }
  const seed = nextHandSeed(current.seed);
  const table = current.table;
  if (input.kind === 'rematch') {
    return createHand({ seed, table, chips: [100, 100, 100, 100], bankerStreak: 1 });
  }
  const bankerSeat = current.jieSeat;
  const bankerStreak = bankerSeat === current.bankerSeat ? current.bankerStreak + 1 : 1;
  return createHand({
    seed,
    table,
    chips: [...current.chips],
    bankerSeat,
    bankerStreak,
  });
}

export function canDealTienGowHand(input: {
  status: string;
  phase?: string;
  isMember: boolean;
  isCpu?: boolean;
}) {
  return input.status === 'playing' && input.phase === 'recap' && input.isMember && !input.isCpu;
}

export function lobbyStateWithTable(table: Table): TienGowLobbyState {
  return { kind: 'tien-gow', phase: 'lobby', table };
}
