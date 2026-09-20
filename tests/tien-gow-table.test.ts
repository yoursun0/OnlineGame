import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createHand,
  DEFAULT_TABLE,
  identifyCombo,
  nextHandSeed,
  projectView,
  wenId,
  type Recap,
  type State,
} from '@playroom/tien-gow';
import { TienGowBoard } from '../app/tien-gow-board';
import { TienGowTableOptions } from '../app/tien-gow-table-options';
import {
  canDealTienGowHand,
  dealPlayroomHand,
  parsePlayroomTable,
  tableFromLobbyState,
  togglePlayroomTableOption,
} from '../app/tien-gow-table';
import { translateError } from '../app/language';

const members = [
  { guest_id: 'south', display_name: 'aa', seat: 0, is_cpu: false },
  { guest_id: 'cpu-east', display_name: 'CPU', seat: 1, is_cpu: true },
  { guest_id: 'cpu-north', display_name: 'CPU', seat: 2, is_cpu: true },
  { guest_id: 'west', display_name: 'bb', seat: 3, is_cpu: false },
];

const lingren = [wenId('lingren', 0), wenId('lingren', 1)];

function recapFixture(overrides: Partial<Recap> = {}): Recap {
  return {
    jieSeat: 2,
    dong: [2, 2, 6, 6],
    ordinaryNets: [-2, -2, 2, 2],
    flags: {
      baoHonor: false,
      fourBao: false,
      yaoJie: false,
      yaoCapture: false,
      slam: null,
      example: null,
    },
    payments: [
      { from: 0, to: 2, amount: 2, reason: 'ordinary' },
      { from: 1, to: 2, amount: 2, reason: 'ordinary' },
    ],
    chipsBefore: [100, 100, 100, 100],
    chipsAfter: [98, 98, 104, 100],
    revealedHidden: [[], [], [], []],
    ...overrides,
  };
}

function recapState(): State {
  const state = createHand({ seed: 'tgw-recap-ui', table: { examples: false }, bankerSeat: 0 });
  return {
    ...state,
    phase: 'recap',
    jieSeat: 2,
    chips: [98, 98, 104, 100],
    recap: recapFixture(),
  };
}

function renderBoard(state: State, extras: {
  language?: 'en' | 'zh-Hant';
  canDeal?: boolean;
} = {}) {
  return renderToStaticMarkup(createElement(TienGowBoard, {
    view: projectView(state, 0),
    members,
    onMove: () => {},
    disabled: true,
    language: extras.language ?? 'en',
    onNext: () => {},
    onRematch: () => {},
    canDeal: extras.canDeal ?? true,
  }));
}

test('Playroom Table defaults match lab / rules.md', () => {
  expect(DEFAULT_TABLE).toEqual({
    wenHonor: true,
    captureWenHonor: true,
    yaoSettle: true,
    yaoCapture: true,
    baoHonor: true,
    fourBless: true,
    slam: true,
    examples: true,
    baoHonorAlsoHe: false,
    extraExamples: false,
  });
  expect(parsePlayroomTable(undefined)).toEqual(DEFAULT_TABLE);
  expect(tableFromLobbyState({ kind: 'tien-gow', phase: 'lobby' })).toEqual(DEFAULT_TABLE);
  expect(tableFromLobbyState({ kind: 'tien-gow', phase: 'lobby', table: { examples: false, wenHonor: false } })).toEqual({
    ...DEFAULT_TABLE,
    examples: false,
    wenHonor: false,
    captureWenHonor: false,
  });
});

test('host Table toggles disable 擒文尊 / 么雙擒四 with their parents', () => {
  const noWen = togglePlayroomTableOption(DEFAULT_TABLE, 'wenHonor', false);
  expect(noWen.wenHonor).toBe(false);
  expect(noWen.captureWenHonor).toBe(false);
  const noYao = togglePlayroomTableOption(DEFAULT_TABLE, 'yaoSettle', false);
  expect(noYao.yaoSettle).toBe(false);
  expect(noYao.yaoCapture).toBe(false);
});

test('Table options affect deal identity and legal combinations', () => {
  const honorOn = dealPlayroomHand({
    kind: 'open',
    code: 'TGW-4K8',
    table: parsePlayroomTable({ examples: false }),
  });
  const honorOff = dealPlayroomHand({
    kind: 'open',
    code: 'TGW-4K8',
    table: parsePlayroomTable({ examples: false, wenHonor: false }),
  });
  expect(honorOn.table.wenHonor).toBe(true);
  expect(honorOn.table.captureWenHonor).toBe(true);
  expect(honorOff.table.wenHonor).toBe(false);
  expect(honorOff.table.captureWenHonor).toBe(false);
  expect(identifyCombo(lingren, honorOn.table)?.class).toBe('wenHonor');
  expect(identifyCombo(lingren, honorOff.table)?.class).toBe('wenPair');
  expect(honorOn.seed).toBe('tgw:TGW-4K8');
});

test('lab rematch resets chips and keeps seats/Table; next hand 飛莊 carries chips', () => {
  const current = recapState();
  current.table = { ...DEFAULT_TABLE, examples: false, extraExamples: true };
  current.chips = [80, 90, 120, 110];
  current.bankerSeat = 0;
  current.bankerStreak = 2;
  current.jieSeat = 2;

  const rematch = dealPlayroomHand({ kind: 'rematch', code: 'TGW-4K8', current });
  expect(rematch.chips).toEqual([100, 100, 100, 100]);
  expect(rematch.table).toEqual(current.table);
  expect(rematch.seed).toBe(nextHandSeed(current.seed));
  expect(rematch.bankerStreak).toBe(1);
  expect(rematch.phase).not.toBe('recap');

  const next = dealPlayroomHand({ kind: 'next', code: 'TGW-4K8', current });
  expect(next.chips).toEqual([80, 90, 120, 110]);
  expect(next.table).toEqual(current.table);
  expect(next.bankerSeat).toBe(2);
  expect(next.bankerStreak).toBe(1);
  expect(next.seed).toBe(nextHandSeed(current.seed));

  const sameBanker = dealPlayroomHand({
    kind: 'next',
    code: 'TGW-4K8',
    current: { ...current, jieSeat: 0 },
  });
  expect(sameBanker.bankerSeat).toBe(0);
  expect(sameBanker.bankerStreak).toBe(3);
});

test('next/rematch chrome only after 結, for a seated human', () => {
  expect(canDealTienGowHand({ status: 'playing', phase: 'recap', isMember: true, isCpu: false })).toBe(true);
  expect(canDealTienGowHand({ status: 'playing', phase: 'lead', isMember: true, isCpu: false })).toBe(false);
  expect(canDealTienGowHand({ status: 'open', phase: 'lobby', isMember: true, isCpu: false })).toBe(false);
  expect(canDealTienGowHand({ status: 'playing', phase: 'recap', isMember: true, isCpu: true })).toBe(false);
  expect(canDealTienGowHand({ status: 'finished', phase: 'recap', isMember: true, isCpu: false })).toBe(false);
});

test('lobby Table checkboxes use lab labels and default on/off', () => {
  const html = renderToStaticMarkup(createElement(TienGowTableOptions, {
    table: DEFAULT_TABLE,
    editable: true,
    language: 'zh-Hant',
    onChange: () => {},
  }));
  expect(html).toContain('文尊');
  expect(html).toContain('擒文尊');
  expect(html).toContain('么結');
  expect(html).toContain('么雙擒四');
  expect(html).toContain('包尊');
  expect(html).toContain('賀四 / 四大包');
  expect(html).toContain('七支 / 八支');
  expect(html).toContain('例牌');
  expect(html).toContain('包尊亦賀');
  expect(html).toContain('額外例牌');
  expect(html).toContain('aria-label="Table"');
  expect(html.match(/checked=""/g)?.length).toBe(8);
  expect(html).not.toContain('god');
});

test('guests see locked Table checkboxes; 擒文尊 is disabled when 文尊 is off', () => {
  const guest = renderToStaticMarkup(createElement(TienGowTableOptions, {
    table: DEFAULT_TABLE,
    editable: false,
    language: 'en',
  }));
  expect(guest).toContain('disabled=""');
  expect(guest).toContain('Wen honor');

  const noWen = renderToStaticMarkup(createElement(TienGowTableOptions, {
    table: togglePlayroomTableOption(DEFAULT_TABLE, 'wenHonor', false),
    editable: true,
    language: 'zh-Hant',
    onChange: () => {},
  }));
  expect(noWen).toContain('擒文尊');
  expect(noWen).toMatch(/disabled[^>]*aria-label="擒文尊"|aria-label="擒文尊"[^>]*disabled/);
});

test('hand end recap lists 結, payments, chips, and rematch chrome', () => {
  const html = renderBoard(recapState(), { language: 'zh-Hant', canDeal: true });
  expect(html).toContain('tgw-recap');
  expect(html).toContain('北');
  expect(html).toContain('結');
  expect(html).toContain('南→北 2');
  expect(html).toContain('下一局');
  expect(html).toContain('重開牌局');
  expect(html).not.toContain('god');

  const midHand = renderBoard(
    createHand({ seed: 'tgw-mid', table: { examples: false }, bankerSeat: 0 }),
    { canDeal: true },
  );
  expect(midHand).not.toContain('下一局');
  expect(midHand).not.toContain('重開牌局');
});

test('traditional chinese names Table and rematch errors', () => {
  expect(translateError('Only the host can set Table options.', 'zh-Hant')).toBe('只有房主可以設定臺面規則。');
  expect(translateError('Wait until 結 before dealing the next hand.', 'zh-Hant')).toBe('結牌後才能開下一局。');
  expect(translateError('Table options can only be set before the first hand.', 'zh-Hant')).toBe('臺面規則只能在開局前設定。');
});

test('start uses the lobby Table; rematch/next stay on the playing room', async () => {
  const route = await readFile(new URL('../app/api/rooms/[code]/route.ts', import.meta.url), 'utf8');
  expect(route).toContain('dealPlayroomHand');
  expect(route).toContain('parsePlayroomTable');
  expect(route).toContain("body.action === 'table'");
  expect(route).toContain("body.action === 'rematch'");
  expect(route).toContain("body.action === 'next'");
  expect(route).not.toContain('god');

  const client = await readFile(new URL('../app/room/[code]/room-client.tsx', import.meta.url), 'utf8');
  expect(client).toContain('TienGowTableOptions');
  expect(client).toContain("action('table'");
  expect(client).toContain("action('next'");
  expect(client).toContain("action('rematch'");
  expect(client).not.toContain('god=1');

  const board = await readFile(new URL('../app/tien-gow-board.tsx', import.meta.url), 'utf8');
  expect(board).toContain('tgw-recap');
  expect(board).toContain('onRematch');
  expect(board).not.toContain('god');
});

test('Playroom Table options are documented against lab defaults', async () => {
  const readme = await readFile(new URL('../games/tien-gow/README.md', import.meta.url), 'utf8');
  const rules = await readFile(new URL('../games/tien-gow/rules.md', import.meta.url), 'utf8');
  expect(readme).toContain('Playroom');
  expect(readme).toContain('wenHonor');
  expect(readme).toContain('baoHonorAlsoHe');
  expect(readme).toContain('extraExamples');
  expect(readme).toContain('重開牌局');
  expect(rules).toContain('Playroom');
  expect(rules).toContain('Locked before the first hand');
});
