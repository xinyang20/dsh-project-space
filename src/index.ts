import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-host-webserver';
import type {} from '@deepseek-ai/dsh-session-persistence';
import { WorkspaceId } from '@deepseek-ai/dsh-workspace';
import type { SessionId } from '@deepseek-ai/dsh-session';
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { SpaceStore, SpaceError } from './store.js';
import { createHandler } from './http.js';
import { API, type SpaceInfo } from './shared.js';
import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment';
import type {} from '@deepseek-ai/dsh-client-connection';

export const inject = ['webServer', 'workspaceRegistry', 'sessionPersistence', 'tools', 'attachments', 'connection'];
export function apply(ctx: Context): void {
  const workspaces = (): SpaceInfo[] => ctx.workspaceRegistry.list().map(w => ({ id: w.id, title: w.title, cwd: w.path }));
  const store = new SpaceStore({
    dataDir: path.join(resolveDshHome(), 'dsh-project-space'),
    workspace: async id => { const w = ctx.workspaceRegistry.get(WorkspaceId(id)); return w ? { id: w.id, title: w.title, cwd: w.path } : undefined; },
    sourceSession: async (id, workspace) => {
      const snapshot = await ctx.sessionPersistence.stat(id as SessionId);
      if (!snapshot?.header.cwd) return false;
      return (await realpath(snapshot.header.cwd)) === workspace.cwd;
    },
  });
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: API, handler: createHandler(store, workspaces, req => { const result = ctx.connection.admit(req); return 'rejection' in result ? result.rejection : undefined; }) }));
  async function target(exec: ToolRunContext): Promise<{ workspaceId: string; sourceSessionId: string }> {
    if (!exec.agent) throw new SpaceError('NO_SESSION', '该工具需要工作区会话。');
    const session = exec.agent.session;
    if (!session.header.cwd) throw new SpaceError('NO_WORKSPACE', '请先进入已登记的工作区。');
    const cwd = await realpath(session.header.cwd);
    const workspace = workspaces().find(w => w.cwd === cwd);
    if (!workspace) throw new SpaceError('NO_WORKSPACE', '当前会话目录尚未登记为工作区。');
    return { workspaceId: workspace.id, sourceSessionId: session.id };
  }
  const output = { schema: { type: 'string' as const }, render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }] };
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'space_add_resource', description: 'Register an existing file in the current workspace resource library. Use after producing a document, image, PDF or other deliverable. Registration never copies, moves or deletes the workspace file.',
    parameters: { path: { type: 'string', required: true, description: 'File path inside the current workspace.' }, role: { type: 'string', enum: ['input', 'output'], required: true } }, output,
    execute: async (args, exec) => JSON.stringify(await store.register({ ...await target(exec), path: args.path, role: args.role })),
  })));
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'space_list_resources', description: 'List this workspace reference files and deliverables from all sessions, including resource IDs and missing/changed status.', parameters: {}, output,
    execute: async (_args, exec) => JSON.stringify(await store.list((await target(exec)).workspaceId)),
  })));
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'space_read_resource', description: 'Read a resource by ID in the current workspace. Text is limited to 256 KiB, raster images are returned to vision-capable models. PDFs and other formats return a host path for the native file-reading tools.',
    parameters: { id: { type: 'string', required: true } },
    output: { schema: { type: 'string' }, render: (_args, value) => {
      const result = JSON.parse(value) as { attachment?: ImageAttachmentRef };
      if (result.attachment) return [{ type: 'image', attachment: result.attachment }];
      return [{ type: 'text', text: value }];
    } },
    execute: async (args, exec) => {
      const { resource, bytes, absolutePath } = await store.read((await target(exec)).workspaceId, args.id);
      if (resource.kind === 'image') return JSON.stringify({ name: resource.name, attachment: await ctx.attachments.saveImage({ data: bytes, mediaType: resource.mime as ImageMediaType, name: resource.name }) });
      if (resource.kind === 'text') return JSON.stringify({ name: resource.name, text: bytes.subarray(0, store.maxTextBytes).toString('utf8'), truncated: bytes.length > store.maxTextBytes });
      return JSON.stringify({ name: resource.name, kind: resource.kind, path: absolutePath, note: 'Read this format using the appropriate host file-reading tool.' });
    },
  })));
}
