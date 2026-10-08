import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, symlink, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { SpaceStore, SpaceError } from '../src/store.js';

async function fixture(maxFileBytes = 1024 * 1024) {
  const root = path.resolve('test-results/store'); await mkdir(root, { recursive: true });
  const directory = await mkdtemp(`${root}/case-`);
  const a = path.join(directory, 'a'), b = path.join(directory, 'b'), dataDir = path.join(directory, 'data');
  await mkdir(a); await mkdir(b);
  const options = { dataDir, maxFileBytes, maxTextBytes: 16, workspace: async (id: string) => id === 'a' || id === 'b' ? { id, title: id, cwd: id === 'a' ? a : b } : undefined, sourceSession: async (id: string, workspace: { id: string }) => id === `session-${workspace.id}` };
  return { a, b, dataDir, options, store: new SpaceStore(options) };
}
const code = (expected: string) => (error: unknown) => error instanceof SpaceError && error.code === expected;
test('workspace isolation, source attribution and restart persistence', async () => {
  const f = await fixture(); await writeFile(path.join(f.a, 'report.md'), '# report');
  const resource = await f.store.register({ workspaceId: 'a', path: 'report.md', role: 'output', sourceSessionId: 'session-a' });
  assert.equal(resource.sourceSessionId, 'session-a'); assert.equal((await f.store.list('a')).length, 1); assert.deepEqual(await f.store.list('b'), []);
  assert.equal((await new SpaceStore(f.options).list('a'))[0].id, resource.id);
  await assert.rejects(f.store.read('b', resource.id), code('RESOURCE_NOT_FOUND'));
  await assert.rejects(f.store.register({ workspaceId: 'a', path: 'report.md', role: 'input', sourceSessionId: 'session-b' }), code('SESSION_MISMATCH'));
});
test('parallel registrations are serialized and deduplicated without losing distinct files', async () => {
  const f = await fixture(); for (let i = 0; i < 12; i++) await writeFile(path.join(f.a, `${i}.md`), String(i));
  await Promise.all([...Array.from({ length: 12 }, (_, i) => f.store.register({ workspaceId: 'a', path: `${i}.md`, role: 'output' })), ...Array.from({ length: 12 }, () => f.store.register({ workspaceId: 'a', path: '0.md', role: 'output' }))]);
  assert.equal((await f.store.list('a')).length, 12);
  await f.store.register({ workspaceId: 'a', path: '0.md', role: 'input' }); assert.equal((await f.store.list('a')).length, 13);
});
test('traversal, absolute outside paths and outside symlinks are rejected', async () => {
  const f = await fixture(); await writeFile(path.join(f.b, 'secret.txt'), 'private'); await symlink(path.join(f.b, 'secret.txt'), path.join(f.a, 'escape.txt'));
  for (const file of ['../b/secret.txt', path.join(f.b, 'secret.txt'), 'escape.txt']) await assert.rejects(f.store.register({ workspaceId: 'a', path: file, role: 'input' }), code('PATH_OUTSIDE_WORKSPACE'));
  await assert.rejects(f.store.list('../b'), code('INVALID_ID')); assert.deepEqual(await f.store.list('a'), []);
});
test('an originally safe file cannot be read after replacement by an outside symlink', async () => {
  const f = await fixture(); await writeFile(path.join(f.a, 'ref.md'), 'safe'); const r = await f.store.register({ workspaceId: 'a', path: 'ref.md', role: 'input' });
  await writeFile(path.join(f.b, 'ref.md'), 'outside'); await unlink(path.join(f.a, 'ref.md')); await symlink(path.join(f.b, 'ref.md'), path.join(f.a, 'ref.md'));
  await assert.rejects(f.store.read('a', r.id), code('PATH_OUTSIDE_WORKSPACE')); assert.equal((await f.store.list('a'))[0].status, 'missing');
});
test('removing a record preserves both original files and uploaded copies', async () => {
  const f = await fixture(); await writeFile(path.join(f.a, 'keep.txt'), 'keep'); const r = await f.store.register({ workspaceId: 'a', path: 'keep.txt', role: 'output' }); await f.store.remove('a', r.id);
  assert.equal(await readFile(path.join(f.a, 'keep.txt'), 'utf8'), 'keep');
  const uploaded = await f.store.upload({ workspaceId: 'a', name: 'ref.txt', role: 'input', base64: Buffer.from('reference').toString('base64') }); const file = (await f.store.read('a', uploaded.id)).absolutePath;
  await f.store.remove('a', uploaded.id); assert.equal(await readFile(file, 'utf8'), 'reference'); assert.deepEqual(await f.store.list('a'), []);
});
test('text preview treats HTML and SVG as text and caps output; modification and deletion are visible', async () => {
  const f = await fixture(); const file = path.join(f.a, 'unsafe.html'); await writeFile(file, '<script>alert(1)</script>'); const r = await f.store.register({ workspaceId: 'a', path: 'unsafe.html', role: 'input' });
  assert.equal(r.kind, 'text'); assert.match(r.mime, /^text\/plain/); assert.deepEqual(await f.store.preview('a', r.id), { kind: 'text', text: '<script>alert(1)', truncated: true });
  await writeFile(file, 'changed content longer than original'); assert.equal((await f.store.list('a'))[0].status, 'changed'); await unlink(file); assert.equal((await f.store.list('a'))[0].status, 'missing');
});
test('upload encoding, names, maximum size and ordinary-file constraints are enforced', async () => {
  const f = await fixture(32);
  for (const name of ['../escape', 'a/b', 'a\\b', 'a\n.txt', '..']) await assert.rejects(f.store.upload({ workspaceId: 'a', name, role: 'input', base64: '' }), code('INVALID_NAME'));
  await assert.rejects(f.store.upload({ workspaceId: 'a', name: 'ref.txt', role: 'input', base64: '%%%=' }), code('INVALID_UPLOAD'));
  await assert.rejects(f.store.upload({ workspaceId: 'a', name: 'big.txt', role: 'input', base64: Buffer.alloc(100).toString('base64') }), code('INVALID_UPLOAD'));
  await writeFile(path.join(f.a, 'big.txt'), Buffer.alloc(33)); await assert.rejects(f.store.register({ workspaceId: 'a', path: 'big.txt', role: 'input' }), code('FILE_TOO_LARGE'));
  await assert.rejects(f.store.register({ workspaceId: 'a', path: '.', role: 'input' }), code('PATH_OUTSIDE_WORKSPACE'));
  await mkdir(path.join(f.a, 'folder')); await assert.rejects(f.store.register({ workspaceId: 'a', path: 'folder', role: 'input' }), code('NOT_A_FILE'));
  const empty = await f.store.upload({ workspaceId: 'a', name: 'empty.txt', role: 'input', base64: '' }); assert.equal((await f.store.read('a', empty.id)).bytes.length, 0);
});
test('corrupt index is preserved and refuses writes; private storage permissions', async () => {
  const f = await fixture(); const r = await f.store.upload({ workspaceId: 'a', name: 'ref.md', role: 'input', base64: 'YQ==' }); const index = path.join(f.dataDir, 'spaces/a/index.json');
  assert.equal((await stat(index)).mode & 0o777, 0o600); const text = '{corrupt'; await writeFile(index, text);
  await assert.rejects(f.store.remove('a', r.id), code('INDEX_CORRUPT')); await assert.rejects(f.store.upload({ workspaceId: 'a', name: 'ref.md', role: 'input', base64: 'YQ==' }), code('INDEX_CORRUPT')); assert.equal(await readFile(index, 'utf8'), text);
});

test('4 MiB and 20 MiB uploads retain their bytes; one byte over the limit is rejected', async () => {
  const f = await fixture(20 * 1024 * 1024);
  for (const size of [4 * 1024 * 1024, 20 * 1024 * 1024]) {
    const bytes = Buffer.alloc(size, 0x41);
    const resource = await f.store.upload({ workspaceId: 'a', name: `${size}.bin`, role: 'input', base64: bytes.toString('base64') });
    assert.equal(resource.size, size);
    assert.deepEqual((await f.store.read('a', resource.id)).bytes, bytes);
  }
  await assert.rejects(f.store.upload({ workspaceId: 'a', name: 'too-large.bin', role: 'input', base64: Buffer.alloc(20 * 1024 * 1024 + 1).toString('base64') }), code('FILE_TOO_LARGE'));
  for (const base64 of ['a', 'abc', 'ab=c', 'a===', '====', 'YQ===', 'YQ==\n', 'YQ==YQ==']) await assert.rejects(f.store.upload({ workspaceId: 'a', name: 'invalid.bin', role: 'input', base64 }), code('INVALID_UPLOAD'));
});

test('legal long Unicode names keep their display name without overflowing the storage filename', async () => {
  const f = await fixture();
  for (const name of ['文'.repeat(73) + '.md', '文'.repeat(190) + '.md', '😀'.repeat(60) + '.txt', 'file.' + 'a'.repeat(190)]) {
    const uploaded = await f.store.upload({ workspaceId: 'a', name, role: 'input', base64: Buffer.from('reference').toString('base64') });
    const stored = await f.store.read('a', uploaded.id);
    assert.equal(uploaded.name, name); assert.equal(uploaded.path, name);
    assert.equal(stored.bytes.toString('utf8'), 'reference');
    assert.ok(Buffer.byteLength(path.basename(stored.absolutePath)) <= 49);
  }
  await assert.rejects(f.store.upload({ workspaceId: 'a', name: '文'.repeat(201) + '.md', role: 'input', base64: '' }), code('INVALID_NAME'));
});
