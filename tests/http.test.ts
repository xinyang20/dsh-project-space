import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as rawRequest } from 'node:http';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { SpaceStore } from '../src/store.js';
import { createHandler } from '../src/http.js';

test('real HTTP routes, browser trust fence, safe preview, upload and non-destructive removal', async t => {
  const base = path.resolve('test-results/http'); await mkdir(base, { recursive: true }); const dir = await mkdtemp(`${base}/case-`); const cwd = path.join(dir, 'workspace'); await mkdir(cwd);
  const workspace = { id: 'a', cwd, title: 'A' }; const store = new SpaceStore({ dataDir: path.join(dir, 'data'), maxFileBytes: 1024, workspace: async id => id === 'a' ? workspace : undefined, sourceSession: async () => false });
  const server = createServer(createHandler(store, () => [workspace])); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const port = (server.address() as { port: number }).port; const root = `http://127.0.0.1:${port}/dsh-space/api`;
  const post = (route: string, value: unknown, headers = {}) => fetch(`${root}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value) });
  assert.equal((await fetch(`${root}/workspaces`)).status, 200);
  for (const headers of [{ Origin: 'http://evil.test' }, { Host: 'evil.test' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const status = await new Promise<number>(resolve => { const req = rawRequest(`${root}/workspaces`, { headers }, res => { res.resume(); resolve(res.statusCode!); }); req.end(); });
    assert.equal(status, 403, JSON.stringify(headers));
  }
  assert.equal((await fetch(`${root}/upload`, { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await post('/register', { workspaceId: 'a', path: '../escape', role: 'input' })).status, 403);
  assert.equal((await post('/upload', { workspaceId: 'a', name: 'big', base64: 'a'.repeat(10000), role: 'input' })).status, 413);
  const upload = await post('/upload', { workspaceId: 'a', name: 'unsafe.svg', base64: Buffer.from('<svg onload="alert(1)"></svg>').toString('base64'), role: 'input' }); assert.equal(upload.status, 201); const resource = await upload.json() as { id: string };
  const query = new URLSearchParams({ workspaceId: 'a', id: resource.id }); const file = await fetch(`${root}/file?${query}`); assert.match(file.headers.get('content-type')!, /^text\/plain/); assert.match(file.headers.get('content-disposition')!, /^attachment/); assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
  const preview = await fetch(`${root}/preview?${query}`); assert.equal((await preview.json() as { text: string }).text, '<svg onload="alert(1)"></svg>');
  await writeFile(path.join(cwd, 'keep.md'), 'keep'); const registration = await post('/register', { workspaceId: 'a', path: 'keep.md', role: 'output' }); const registered = await registration.json() as { id: string };
  assert.equal((await fetch(`${root}/resources?workspaceId=a&id=${registered.id}`, { method: 'DELETE' })).status, 200); assert.equal(await readFile(path.join(cwd, 'keep.md'), 'utf8'), 'keep');
});
