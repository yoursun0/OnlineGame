import { spawn, type ChildProcess } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const localEnv = await readFile('.env.local', 'utf8').catch(() => '');
for (const line of localEnv.split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const configuredUrl = process.env.PLAYROOM_TEST_URL?.trim();
const port = process.env.PLAYROOM_TEST_PORT?.trim() || '3000';
const baseUrl = configuredUrl || `http://127.0.0.1:${port}`;
process.env.PLAYROOM_TEST_URL = baseUrl;

let localServer: ChildProcess | undefined;

async function isReady(url: string) {
  try {
    const response = await fetch(`${url}/`, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

if (!configuredUrl && !(await isReady(baseUrl))) {
  localServer = spawn(process.execPath, ['x', 'next', 'dev', '-p', port], {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: 'ignore',
    windowsHide: true,
  });

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && !(await isReady(baseUrl))) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (!(await isReady(baseUrl))) {
    localServer.kill();
    throw new Error(`Test server did not become ready at ${baseUrl}.`);
  }
}

process.on('exit', () => {
  localServer?.kill();
});
