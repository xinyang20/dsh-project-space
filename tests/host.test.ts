import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = 'http://127.0.0.1:39393';
const log = await readFile('.runtime/dsh-server.log', 'utf8');
const loginUrl = log.match(/http:\/\/127\.0\.0\.1:39393\/\?token=[^\s]+/)![0];
const login = await fetch(loginUrl, { redirect: 'manual' });
const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
assert.ok(cookie);
const hostFetch = (url: string, init: RequestInit = {}) => fetch(url, { ...init, headers: { ...init.headers, Cookie: cookie } });
const manifest = JSON.parse(await readFile('.runtime/fixtures/manifest.json', 'utf8')) as { workspaceId: string; sessionId: string; path: string }[];
async function tool(name: string, args: Record<string, unknown> = {}, project = 0) {
  const response = await hostFetch(`${root}/dsh-space-test/tool`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, arguments: args, project }) });
  assert.equal(response.status, 200); return await response.json() as { value?: string; content?: { type: string; text?: string; attachment?: unknown }[]; isError?: boolean; error?: unknown };
}
test('official ToolRuntime registers a deliverable and lists/reads it with its real Agent session', async () => {
  const project = manifest[0]; const name = `tool-report-${project.sessionId.slice(0, 8)}.md`; await writeFile(path.join(project.path, name), '# 设计研究\n\n这里是资源库生成成果测试。');
  const added = await tool('space_add_resource', { path: name, role: 'output' });
  assert.equal(added.isError, false, JSON.stringify(added));
  const records = await hostFetch(`${root}/dsh-space/api/resources?workspaceId=${project.workspaceId}`).then(r => r.json()) as { id: string; name: string; sourceSessionId?: string }[];
  const resource = records.find(r => r.name === name)!; assert.ok(resource); assert.equal(resource.sourceSessionId, project.sessionId);
  const listed = await tool('space_list_resources'); assert.match(JSON.stringify(listed), /report\.md/);
  const read = await tool('space_read_resource', { id: resource.id }); assert.match(JSON.stringify(read), /设计研究/);
  const other = await tool('space_read_resource', { id: resource.id }, 1); assert.ok(other.isError || other.error || JSON.stringify(other).includes('RESOURCE_NOT_FOUND'));
});
test('image reading returns a durable DSH image attachment through the official ToolRuntime', async () => {
  const bytes = await readFile('.runtime/fixtures/reference-board.png');
  const response = await hostFetch(`${root}/dsh-space/api/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: manifest[0].workspaceId, name: 'tool-image.png', base64: bytes.toString('base64'), role: 'input' }) }); assert.equal(response.status, 201);
  const resource = await response.json() as { id: string }; const read = await tool('space_read_resource', { id: resource.id });
  assert.equal(read.isError, false, JSON.stringify(read)); assert.equal(read.content?.[0]?.type, 'image'); assert.ok(read.content?.[0]?.attachment);
});
test('real DSH host exposes safe resource previews and denies source-session crossover', async () => {
  const upload = (name: string, content: string, sourceSessionId?: string) => hostFetch(`${root}/dsh-space/api/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: manifest[0].workspaceId, name, base64: Buffer.from(content).toString('base64'), role: 'input', sourceSessionId }) });
  assert.equal((await upload('wrong.txt', 'test', manifest[1].sessionId)).status, 400);
  const response = await upload('reference.md', '# 用户提供的参考资料', manifest[0].sessionId); assert.equal(response.status, 201);
  const r = await response.json() as { id: string }; const result = await tool('space_read_resource', { id: r.id }); assert.match(JSON.stringify(result), /用户提供/);
  await mkdir('test-results/host', { recursive: true }); await writeFile('test-results/host/runtime.json', JSON.stringify({ officialVersion: '0.2.0-rc.2', workspaceId: manifest[0].workspaceId, tools: ['space_add_resource', 'space_list_resources', 'space_read_resource'], passed: true }, null, 2));
});
test('resource routes require the official DSH browser session cookie', async () => {
  assert.equal((await fetch(`${root}/dsh-space/api/workspaces`)).status, 401);
  assert.equal((await fetch(`${root}/dsh-space/api/workspaces`, { headers: { Cookie: 'invalid=test' } })).status, 401);
  assert.equal((await hostFetch(`${root}/dsh-space/api/workspaces`)).status, 200);
});

test('the local integration fixture requires authentication, trusted origin and its own tool allowlist', async () => {
  const route = `${root}/dsh-space-test/tool`;
  const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'space_list_resources' }) };
  assert.equal((await fetch(route, init)).status, 401);
  assert.equal((await hostFetch(route, { ...init, headers: { ...init.headers, Origin: 'http://untrusted.example' } })).status, 403);
  assert.equal((await hostFetch(route, { ...init, headers: { ...init.headers, 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await hostFetch(route, { ...init, body: JSON.stringify({ name: 'unrelated_tool' }) })).status, 400);
  assert.equal((await hostFetch(route, { ...init, body: JSON.stringify({ name: 'space_list_resources', project: -1 }) })).status, 400);
  assert.equal((await hostFetch(route, { ...init, body: '{invalid' })).status, 400);
  assert.equal((await hostFetch(route, { ...init, body: JSON.stringify({ name: 'space_list_resources', padding: 'x'.repeat(20000) }) })).status, 413);
  assert.equal((await hostFetch(route, init)).status, 200);
});

test('the installed host accepts a 20 MiB Unicode-named upload, returns its bytes and rejects one byte over', async () => {
  const bytes = Buffer.alloc(20 * 1024 * 1024, 0x41);
  const name = '审查资料'.repeat(40) + '.bin';
  const upload = (base64: string) => hostFetch(`${root}/dsh-space/api/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: manifest[0].workspaceId, name, base64, role: 'input' }) });
  const added = await upload(bytes.toString('base64')); assert.equal(added.status, 201);
  const resource = await added.json() as { id: string; name: string; size: number };
  try {
    assert.equal(resource.name, name); assert.equal(resource.size, bytes.length);
    const query = new URLSearchParams({ workspaceId: manifest[0].workspaceId, id: resource.id });
    const download = await hostFetch(`${root}/dsh-space/api/file?${query}`);
    assert.equal(download.status, 200); assert.match(download.headers.get('content-disposition')!, /^attachment/);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
    assert.equal((await upload(Buffer.alloc(bytes.length + 1).toString('base64'))).status, 413);
  } finally {
    const removal = await hostFetch(`${root}/dsh-space/api/resources?${new URLSearchParams({ workspaceId: manifest[0].workspaceId, id: resource.id })}`, { method: 'DELETE' });
    assert.equal(removal.status, 200);
  }
});
