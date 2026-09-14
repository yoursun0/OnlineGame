export type Table = {
  wenHonor: boolean;
  captureWenHonor: boolean;
  yaoSettle: boolean;
  yaoCapture: boolean;
  baoHonor: boolean;
  fourBless: boolean;
  slam: boolean;
  examples: boolean;
  baoHonorAlsoHe: boolean;
  extraExamples: boolean;
};

export const DEFAULT_TABLE: Table = {
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
};

export function mergeTable(partial?: Partial<Table>): Table {
  const table = { ...DEFAULT_TABLE, ...partial };
  if (!table.wenHonor) table.captureWenHonor = false;
  if (!table.yaoSettle) table.yaoCapture = false;
  return table;
}
