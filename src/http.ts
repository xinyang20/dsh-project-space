import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SpaceInfo, ResourceRole } from './shared.js';
import { API } from './shared.js';
import { SpaceError, SpaceStore } from './store.js';

function fence(req: IncomingMessage): void {
  const address = req.socket.remoteAddress;
  if (!address || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) throw new SpaceError('LOCAL_ONLY', '资源库仅允许本机访问。', 403);
  const host = req.headers.host;
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) throw new SpaceError('UNTRUSTED_HOST', '请求主机不受信任。', 403);
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new SpaceError('UNTRUSTED_ORIGIN', '拒绝跨站请求。', 403);
  if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new SpaceError('UNTRUSTED_ORIGIN', '请求来源不匹配。', 403);
}
function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
async function body(req: IncomingMessage, limit: number): Promise<Record<string, unknown>> {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new SpaceError('CONTENT_TYPE', '请求必须使用 JSON。', 415);
  if (Number(req.headers['content-length'] ?? 0) > limit) throw new SpaceError('BODY_TOO_LARGE', '请求超过上传上限。', 413);
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new SpaceError('BODY_TOO_LARGE', '请求超过上传上限。', 413);
    chunks.push(Buffer.from(chunk));
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch { throw new SpaceError('INVALID_JSON', '无效的 JSON 请求。'); }
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new SpaceError('INVALID_INPUT', '请求字段必须是文本。');
  return value;
}
function role(value: unknown): ResourceRole {
  if (value !== 'input' && value !== 'output') throw new SpaceError('INVALID_ROLE', '请选择输入资料或生成成果。');
  return value;
}
export function createHandler(store: SpaceStore, workspaces: () => SpaceInfo[], admission?: (req: IncomingMessage) => 401 | 403 | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      fence(req);
      const rejection = admission?.(req);
      if (rejection) throw new SpaceError('UNAUTHENTICATED', '请先通过 DSH 登录链接打开网页。', rejection);
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const route = url.pathname.slice(API.length);
      const workspaceId = url.searchParams.get('workspaceId') ?? '';
      const id = url.searchParams.get('id') ?? '';
      if (req.method === 'GET' && route === '/workspaces') { json(res, 200, workspaces()); return; }
      if (req.method === 'GET' && route === '/resources') { json(res, 200, await store.list(workspaceId)); return; }
      if (req.method === 'GET' && route === '/preview') { json(res, 200, await store.preview(workspaceId, id)); return; }
      if (req.method === 'GET' && route === '/file') {
        const { resource, bytes } = await store.read(workspaceId, id);
        const download = url.searchParams.get('download') === '1' || resource.kind === 'other' || resource.kind === 'text';
        res.writeHead(200, { 'Content-Type': resource.mime, 'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "sandbox; default-src 'none'", 'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(resource.name).replace(/'/g, '%27')}` });
        res.end(bytes); return;
      }
      if (req.method === 'DELETE' && route === '/resources') { await store.remove(workspaceId, id); json(res, 200, { removed: true }); return; }
      if (req.method === 'POST' && ['/register', '/upload'].includes(route)) {
        const data = await body(req, Math.ceil(store.maxFileBytes / 3) * 4 + 4096);
        const common = { workspaceId: string(data.workspaceId), role: role(data.role), ...(data.sourceSessionId === undefined ? {} : { sourceSessionId: string(data.sourceSessionId) }) };
        const resource = route === '/register' ? await store.register({ ...common, path: string(data.path) }) : await store.upload({ ...common, name: string(data.name), base64: string(data.base64) });
        json(res, 201, resource); return;
      }
      throw new SpaceError('NOT_FOUND', '接口不存在或方法不受支持。', 404);
    } catch (error) {
      const failure = error instanceof SpaceError ? error : new SpaceError('INTERNAL_ERROR', '资源库操作失败，请检查文件是否仍可访问。', 500);
      if (!res.headersSent) json(res, failure.status, { error: failure.code, message: failure.message });
      else res.destroy();
    }
  };
}
