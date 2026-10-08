import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-workspace';
import type {} from '@deepseek-ai/dsh-host-webserver';
import type { ToolExecutionInput } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-client-connection';
import { SessionId } from '@deepseek-ai/dsh-session';
import type { ToolCallId } from '@deepseek-ai/dsh-llm';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const inject = ['workspaceRegistry', 'agents', 'webServer', 'tools', 'connection'];
export async function apply(ctx: Context): Promise<void> {
  const root = path.resolve(process.env.DSH_SPACE_TEST_ROOT!);
  const projects = [path.join(root, 'project-a'), path.join(root, 'project-b')];
  const result: { workspaceId: string; sessionId: string; path: string }[] = [];
  const agents: NonNullable<ToolExecutionInput['agent']>[] = [];
  for (let i = 0; i < projects.length; i++) {
    await mkdir(projects[i], { recursive: true });
    const workspace = await ctx.workspaceRegistry.create(projects[i], i === 0 ? '设计研究' : '另一个项目');
    const handle = await ctx.agents.create({ sessionId: SessionId(randomUUID()), meta: { cwd: projects[i] } });
    agents.push(handle.agent);
    await workspace.attachSession(handle.agent.session.id);
    ctx.effect(() => () => handle.dispose());
    result.push({ workspaceId: workspace.id, sessionId: handle.agent.session.id, path: projects[i] });
  }
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify(result, null, 2));
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/dsh-space-test/tool', handler: async (req, res) => {
    if (req.socket.remoteAddress !== '127.0.0.1' || !/^(localhost|127\.0\.0\.1)(?::\d+)?$/.test(req.headers.host ?? '') || req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) { res.writeHead(403).end(); return; }
    const admission = ctx.connection.admit(req);
    if ('rejection' in admission) { res.writeHead(admission.rejection).end(); return; }
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') { res.writeHead(415).end(); return; }
    let bytes = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) { bytes += chunk.length; if (bytes > 16384) { res.writeHead(413).end(); return; } chunks.push(Buffer.from(chunk)); }
    let data: { name?: unknown; arguments?: unknown; project?: unknown };
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); }
    catch { res.writeHead(400).end(); return; }
    const project = data.project ?? 0;
    if (typeof data.name !== 'string' || !['space_add_resource', 'space_list_resources', 'space_read_resource'].includes(data.name) || typeof project !== 'number' || !Number.isInteger(project) || !agents[project] || (data.arguments !== undefined && (!data.arguments || typeof data.arguments !== 'object' || Array.isArray(data.arguments)))) { res.writeHead(400).end(); return; }
    const outcome = await ctx.tools.execute({ callId: randomUUID() as ToolCallId, name: data.name, arguments: data.arguments as Record<string, unknown> ?? {}, agent: agents[project], signal: new AbortController().signal });
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(outcome));
  } }));
}
