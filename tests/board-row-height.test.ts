import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

test('tic-tac-toe board keeps equal row tracks when some cells are empty', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  expect(css).toContain('grid-template-rows: repeat(3, minmax(0, 1fr))');
  expect(css).toMatch(/\.board-cell \{[^}]*min-height: 0/);
});
