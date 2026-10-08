import { constants } from 'node:fs';
import { mkdir, open, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AddResource, Preview, Resource, ResourceKind, SpaceInfo, UploadResource } from './shared.js';

type StoredResource = Omit<Resource, 'status'> & { modifiedAt: number; storedPath: string };
interface Index { version: 1; resources: StoredResource[] }
export class SpaceError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export interface StoreOptions {
  dataDir: string;
  workspace: (id: string) => Promise<SpaceInfo | undefined>;
  sourceSession: (id: string, workspace: SpaceInfo) => Promise<boolean>;
  maxFileBytes?: number;
  maxTextBytes?: number;
}
export function contained(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel !== '' && !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel);
}
function identifier(value: string): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new SpaceError('INVALID_ID', '无效的资源或工作区标识。');
  return value;
}
function classify(name: string): { kind: ResourceKind; mime: string } {
  const ext = path.extname(name).toLowerCase();
  const images: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
  if (images[ext]) return { kind: 'image', mime: images[ext] };
  if (ext === '.pdf') return { kind: 'pdf', mime: 'application/pdf' };
  if (['.md', '.txt', '.csv', '.json', '.yaml', '.yml', '.js', '.ts', '.tsx', '.py', '.html', '.svg', '.css', '.log'].includes(ext)) return { kind: 'text', mime: 'text/plain; charset=utf-8' };
  return { kind: 'other', mime: 'application/octet-stream' };
}
export class SpaceStore {
  readonly maxFileBytes: number;
  readonly maxTextBytes: number;
  private tails = new Map<string, Promise<unknown>>();
  private dataDir: string;
  constructor(private options: StoreOptions) {
    this.dataDir = path.resolve(options.dataDir);
    this.maxFileBytes = options.maxFileBytes ?? 20 * 1024 * 1024;
    this.maxTextBytes = options.maxTextBytes ?? 256 * 1024;
  }
  async workspace(id: string): Promise<SpaceInfo> {
    identifier(id);
    const workspace = await this.options.workspace(id);
    if (!workspace) throw new SpaceError('WORKSPACE_NOT_FOUND', '工作区不存在或已移除。', 404);
    return { ...workspace, cwd: await realpath(workspace.cwd) };
  }
  private async source(id: string | undefined, workspace: SpaceInfo): Promise<void> {
    if (!id) return;
    identifier(id);
    if (!await this.options.sourceSession(id, workspace)) throw new SpaceError('SESSION_MISMATCH', '来源会话不属于这个工作区。');
  }
  private indexPath(workspaceId: string): string { return path.join(this.dataDir, 'spaces', identifier(workspaceId), 'index.json'); }
  private async index(workspaceId: string): Promise<Index> {
    try {
      const data: unknown = JSON.parse(await readFile(this.indexPath(workspaceId), 'utf8'));
      if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('resources' in data) || !Array.isArray(data.resources)) throw new Error('invalid index');
      for (const r of data.resources) {
        if (!r || typeof r !== 'object' || typeof r.id !== 'string' || r.workspaceId !== workspaceId || typeof r.storedPath !== 'string' || typeof r.name !== 'string' || !['input', 'output'].includes(r.role) || !['workspace', 'upload'].includes(r.origin)) throw new Error('invalid resource');
        identifier(r.id);
        if (typeof r.path !== 'string' || typeof r.addedAt !== 'string' || !Number.isFinite(Date.parse(r.addedAt)) || !Number.isSafeInteger(r.size) || r.size < 0 || !Number.isFinite(r.modifiedAt) || r.kind !== classify(r.name).kind || r.mime !== classify(r.name).mime || (r.sourceSessionId !== undefined && typeof r.sourceSessionId !== 'string')) throw new Error('invalid resource metadata');
      }
      return data as Index;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, resources: [] };
      throw new SpaceError('INDEX_CORRUPT', '资源索引损坏，已停止写入以保留原数据。', 500);
    }
  }
  private async save(workspaceId: string, index: Index): Promise<void> {
    const file = this.indexPath(workspaceId);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(index, null, 2), { mode: 0o600, flag: 'wx' });
      await rename(temporary, file);
    } finally { await unlink(temporary).catch(() => {}); }
  }
  private async mutate<T>(workspaceId: string, action: () => Promise<T>): Promise<T> {
    identifier(workspaceId);
    const previous = this.tails.get(workspaceId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(action);
    this.tails.set(workspaceId, next);
    try { return await next; }
    finally { if (this.tails.get(workspaceId) === next) this.tails.delete(workspaceId); }
  }
  private async checked(root: string, file: string): Promise<string> {
    const canonicalRoot = await realpath(root);
    const absolute = path.resolve(root, file);
    if (!contained(canonicalRoot, absolute)) throw new SpaceError('PATH_OUTSIDE_WORKSPACE', '只能登记该工作区内的文件。', 403);
    const canonical = await realpath(absolute).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') throw new SpaceError('FILE_MISSING', '文件已不存在。', 404);
      throw error;
    });
    if (!contained(canonicalRoot, canonical)) throw new SpaceError('PATH_OUTSIDE_WORKSPACE', '文件的真实路径位于工作区之外。', 403);
    const info = await stat(canonical);
    if (!info.isFile()) throw new SpaceError('NOT_A_FILE', '请选择普通文件。');
    if (info.size > this.maxFileBytes) throw new SpaceError('FILE_TOO_LARGE', `文件超过 ${Math.floor(this.maxFileBytes / 1024 / 1024)} MiB 上限。`, 413);
    return canonical;
  }
  private async location(resource: StoredResource, workspace: SpaceInfo): Promise<string> {
    const root = resource.origin === 'workspace' ? workspace.cwd : path.join(this.dataDir, 'uploads', resource.workspaceId);
    return this.checked(root, resource.storedPath);
  }
  private async public(resource: StoredResource, workspace: SpaceInfo): Promise<Resource> {
    let status: Resource['status'] = 'available';
    try {
      const info = await stat(await this.location(resource, workspace));
      if (info.size !== resource.size || info.mtimeMs !== resource.modifiedAt) status = 'changed';
    } catch { status = 'missing'; }
    const { storedPath: _, modifiedAt: __, ...rest } = resource;
    return { ...rest, status };
  }
  async list(workspaceId: string): Promise<Resource[]> {
    const workspace = await this.workspace(workspaceId);
    return Promise.all((await this.index(workspaceId)).resources.map(r => this.public(r, workspace)));
  }
  async register(input: AddResource): Promise<Resource> {
    if (typeof input.path !== 'string' || !input.path.trim() || input.path.includes('\0')) throw new SpaceError('INVALID_PATH', '请填写工作区文件路径。');
    if (!['input', 'output'].includes(input.role)) throw new SpaceError('INVALID_ROLE', '请选择输入资料或生成成果。');
    return this.mutate(input.workspaceId, async () => {
      const workspace = await this.workspace(input.workspaceId);
      await this.source(input.sourceSessionId, workspace);
      const file = await this.checked(workspace.cwd, input.path);
      const relative = path.relative(workspace.cwd, file);
      const index = await this.index(input.workspaceId);
      const duplicate = index.resources.find(r => r.origin === 'workspace' && r.storedPath === relative && r.role === input.role);
      if (duplicate) return this.public(duplicate, workspace);
      const info = await stat(file);
      const resource: StoredResource = { id: randomUUID(), workspaceId: input.workspaceId, name: path.basename(file), role: input.role, ...classify(file), size: info.size, addedAt: new Date().toISOString(), ...(input.sourceSessionId ? { sourceSessionId: input.sourceSessionId } : {}), path: relative, storedPath: relative, origin: 'workspace', modifiedAt: info.mtimeMs };
      index.resources.unshift(resource);
      await this.save(input.workspaceId, index);
      return this.public(resource, workspace);
    });
  }
  async upload(input: UploadResource): Promise<Resource> {
    if (typeof input.name !== 'string' || !input.name || input.name.length > 200 || /[\x00-\x1f\/\\]/.test(input.name) || input.name === '.' || input.name === '..') throw new SpaceError('INVALID_NAME', '文件名称无效。');
    if (typeof input.base64 !== 'string' || input.base64.length > Math.ceil(this.maxFileBytes / 3) * 4 || input.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)) throw new SpaceError('INVALID_UPLOAD', '文件编码无效或超过上传上限。', 413);
    if (!['input', 'output'].includes(input.role)) throw new SpaceError('INVALID_ROLE', '资源用途无效。');
    const bytes = Buffer.from(input.base64, 'base64');
    if (bytes.length > this.maxFileBytes) throw new SpaceError('FILE_TOO_LARGE', '文件超过上传上限。', 413);
    return this.mutate(input.workspaceId, async () => {
      const workspace = await this.workspace(input.workspaceId);
      await this.source(input.sourceSessionId, workspace);
      const index = await this.index(input.workspaceId);
      const id = randomUUID();
      const directory = path.join(this.dataDir, 'uploads', input.workspaceId);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      // Keep the original name in metadata; bound the physical filename across filesystems.
      const extension = path.extname(input.name);
      const storedPath = id + (/^\.[a-z0-9]{1,12}$/i.test(extension) ? extension : '');
      const file = path.join(directory, storedPath);
      await writeFile(file, bytes, { mode: 0o600, flag: 'wx' });
      try {
        const info = await stat(file);
        const resource: StoredResource = { id, workspaceId: input.workspaceId, name: input.name, role: input.role, ...classify(input.name), size: bytes.length, addedAt: new Date().toISOString(), ...(input.sourceSessionId ? { sourceSessionId: input.sourceSessionId } : {}), path: input.name, storedPath, origin: 'upload', modifiedAt: info.mtimeMs };
        index.resources.unshift(resource);
        await this.save(input.workspaceId, index);
        return this.public(resource, workspace);
      } catch (error) { await unlink(file).catch(() => {}); throw error; }
    });
  }
  async remove(workspaceId: string, id: string): Promise<void> {
    identifier(id);
    await this.mutate(workspaceId, async () => {
      await this.workspace(workspaceId);
      const index = await this.index(workspaceId);
      if (!index.resources.some(r => r.id === id)) throw new SpaceError('RESOURCE_NOT_FOUND', '资源不存在。', 404);
      index.resources = index.resources.filter(r => r.id !== id);
      await this.save(workspaceId, index);
    });
  }
  async read(workspaceId: string, id: string): Promise<{ resource: Resource; bytes: Buffer; absolutePath: string }> {
    identifier(id);
    const workspace = await this.workspace(workspaceId);
    const stored = (await this.index(workspaceId)).resources.find(r => r.id === id);
    if (!stored) throw new SpaceError('RESOURCE_NOT_FOUND', '资源不存在。', 404);
    const file = await this.location(stored, workspace);
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > this.maxFileBytes) throw new SpaceError('FILE_TOO_LARGE', '文件不可读取或超过上限。', 413);
      const bytes = await handle.readFile();
      if (bytes.length > this.maxFileBytes) throw new SpaceError('FILE_TOO_LARGE', '读取期间文件超过上限。', 413);
      await this.location(stored, workspace);
      return { resource: await this.public(stored, workspace), bytes, absolutePath: file };
    } finally { await handle.close(); }
  }
  async preview(workspaceId: string, id: string): Promise<Preview> {
    const { resource, bytes } = await this.read(workspaceId, id);
    if (resource.kind === 'text') return { kind: 'text', text: bytes.subarray(0, this.maxTextBytes).toString('utf8'), truncated: bytes.length > this.maxTextBytes };
    return { kind: resource.kind };
  }
}
