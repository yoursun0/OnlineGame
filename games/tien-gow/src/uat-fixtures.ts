import { mergeTable, type Table } from './table';
import { DECK, wenId, wuId, type TileId } from './tiles';

export const UAT_FIXTURE_IDS = [
  'he-supreme',
  'capture-on',
  'unbeatable-wen',
  'bao-last',
  'bao-he',
  'must-dump',
  'pair-last',
  'forced-seven',
  'banker-tian',
  'example-yi-dian-hong',
  'example-qi-wu',
  'example-quan-bai',
  'example-ba-wu',
  'extra-si-dui-zi',
] as const;

export type UatFixtureId = (typeof UAT_FIXTURE_IDS)[number];

export type UatFixture = {
  id: UatFixtureId;
  seed: string;
  bankerSeat: number;
  table: Table;
  hands: TileId[][];
};

const PLAY: Partial<Table> = { examples: false };

export function fillHands(partial: Array<readonly TileId[] | undefined>): TileId[][] {
  const used = new Set(partial.flatMap((hand) => hand ?? []));
  const rest = DECK.map((tile) => tile.id).filter((id) => !used.has(id));
  return [0, 1, 2, 3].map((seat) => {
    const given = [...(partial[seat] ?? [])];
    while (given.length < 8) {
      const next = rest.shift();
      if (!next) throw new Error('Ran out of tiles while filling hands.');
      given.push(next);
    }
    return given;
  });
}

const WHITE = [
  wenId('tian', 0),
  wenId('tian', 1),
  wenId('meihua', 0),
  wenId('meihua', 1),
  wenId('changsan', 0),
  wenId('changsan', 1),
  wenId('bandeng', 0),
  wenId('bandeng', 1),
  wenId('futou', 0),
  wenId('futou', 1),
  wuId([3, 6]),
  wuId([3, 5]),
  wuId([2, 6]),
  wuId([2, 5]),
  wuId([2, 3]),
];

const SUPREME = [wuId([1, 2]), wuId([2, 4])];
const LINGREN = [wenId('lingren', 0), wenId('lingren', 1)];
const GAOJIAO = [wenId('gaojiao', 0), wenId('gaojiao', 1)];

const SUPREME_SOUTH = [
  ...SUPREME,
  wenId('bandeng', 0),
  wenId('meihua', 0),
  wenId('futou', 0),
  wenId('changsan', 0),
  wenId('he', 0),
  wenId('ren', 0),
];

const CAPTURE_HANDS = fillHands([
  [...LINGREN, wenId('bandeng', 0), wenId('meihua', 0), wenId('futou', 0), wenId('changsan', 0), wenId('he', 0), wenId('ren', 0)],
  [...GAOJIAO, wenId('di', 0), wenId('di', 1), wenId('tian', 0), wenId('tian', 1), wuId([3, 6]), wuId([4, 5])],
  undefined,
  undefined,
]);

function fixture(id: UatFixtureId, table: Partial<Table>, hands: TileId[][], bankerSeat = 0): UatFixture {
  return { id, seed: id, bankerSeat, table: mergeTable(table), hands };
}

const FIXTURES: Record<UatFixtureId, UatFixture> = {
  'he-supreme': fixture('he-supreme', PLAY, fillHands([SUPREME_SOUTH, undefined, undefined, undefined])),
  'capture-on': fixture('capture-on', PLAY, CAPTURE_HANDS),
  'unbeatable-wen': fixture('unbeatable-wen', { ...PLAY, captureWenHonor: false }, CAPTURE_HANDS),
  'bao-last': fixture('bao-last', PLAY, fillHands([SUPREME_SOUTH, undefined, undefined, undefined])),
  'bao-he': fixture('bao-he', { ...PLAY, baoHonorAlsoHe: true }, fillHands([SUPREME_SOUTH, undefined, undefined, undefined])),
  'must-dump': fixture(
    'must-dump',
    PLAY,
    fillHands([
      [
        wenId('bandeng', 0),
        wenId('meihua', 0),
        wenId('futou', 0),
        wenId('changsan', 0),
        wenId('he', 0),
        wenId('ren', 0),
        wenId('di', 0),
        wenId('lingren', 0),
      ],
      [
        wenId('tian', 0),
        wenId('lingren', 1),
        wenId('gaojiao', 0),
        wenId('pingfeng', 0),
        wuId([1, 2]),
        wuId([2, 4]),
        wuId([2, 3]),
        wuId([1, 4]),
      ],
      undefined,
      undefined,
    ]),
  ),
  'pair-last': fixture(
    'pair-last',
    PLAY,
    fillHands([
      [
        wenId('bandeng', 0),
        wenId('bandeng', 1),
        wenId('meihua', 0),
        wenId('futou', 0),
        wenId('changsan', 0),
        wenId('he', 0),
        wenId('ren', 0),
        wenId('di', 0),
      ],
      [
        wenId('tian', 0),
        wenId('tian', 1),
        wenId('lingren', 0),
        wenId('gaojiao', 0),
        wenId('pingfeng', 0),
        wuId([1, 2]),
        wuId([2, 4]),
        wuId([2, 3]),
      ],
      undefined,
      undefined,
    ]),
  ),
  'forced-seven': fixture(
    'forced-seven',
    PLAY,
    fillHands([
      [
        wenId('bandeng', 0),
        wenId('meihua', 0),
        wenId('futou', 0),
        wenId('changsan', 0),
        wenId('he', 0),
        wenId('ren', 0),
        wenId('di', 0),
        wenId('tian', 0),
      ],
      undefined,
      undefined,
      undefined,
    ]),
  ),
  'banker-tian': fixture(
    'banker-tian',
    PLAY,
    fillHands([
      [
        wenId('tian', 0),
        wenId('meihua', 0),
        wenId('futou', 0),
        wenId('changsan', 0),
        wenId('he', 0),
        wenId('ren', 0),
        wenId('bandeng', 0),
        wenId('bandeng', 1),
      ],
      undefined,
      undefined,
      undefined,
    ]),
  ),
  'example-yi-dian-hong': fixture(
    'example-yi-dian-hong',
    { examples: true },
    fillHands([
      [wenId('lingren', 0), ...WHITE.slice(0, 7)],
      [wenId('gaojiao', 0), ...WHITE.slice(7, 14)],
      undefined,
      undefined,
    ]),
  ),
  'example-qi-wu': fixture(
    'example-qi-wu',
    { examples: true },
    fillHands([
      [wuId([3, 6]), wuId([4, 5]), wuId([3, 5]), wuId([2, 6]), wuId([3, 4]), wuId([2, 5]), wuId([2, 4]), wenId('tian', 0)],
      undefined,
      undefined,
      undefined,
    ]),
  ),
  'example-quan-bai': fixture('example-quan-bai', { examples: true }, fillHands([WHITE.slice(0, 8), undefined, undefined, undefined])),
  'example-ba-wu': fixture(
    'example-ba-wu',
    { examples: true },
    fillHands([
      [wuId([3, 6]), wuId([4, 5]), wuId([3, 5]), wuId([2, 6]), wuId([3, 4]), wuId([2, 5]), wuId([2, 4]), wuId([2, 3])],
      undefined,
      undefined,
      undefined,
    ]),
  ),
  'extra-si-dui-zi': fixture(
    'extra-si-dui-zi',
    { examples: true, extraExamples: false },
    fillHands([
      [
        wenId('tian', 0),
        wenId('tian', 1),
        wenId('di', 0),
        wenId('di', 1),
        wenId('meihua', 0),
        wenId('meihua', 1),
        wenId('bandeng', 0),
        wenId('bandeng', 1),
      ],
      undefined,
      undefined,
      undefined,
    ]),
  ),
};

export function getUatFixture(id: string): UatFixture | undefined {
  return FIXTURES[id as UatFixtureId];
}
