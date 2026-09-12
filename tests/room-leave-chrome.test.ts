import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

function cssBlockAfter(css: string, marker: string) {
  const start = css.indexOf(marker);
  if (start < 0) return '';
  const from = css.indexOf('{', start);
  let depth = 0;
  for (let index = from; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(from + 1, index);
    }
  }
  return '';
}

test('narrow room chrome keeps the leave control visible', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  const mobile = cssBlockAfter(css, '@media (max-width: 620px)');
  expect(mobile.includes('.room-header-actions .button { display: none; }')).toBe(false);
});
