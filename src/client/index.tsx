import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type {} from '@deepseek-ai/dsh-client-ui-session/client';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types';
import type { Resource, ResourceRole } from '../shared.js';
import { Library } from './controller.js';
import { SpacePage, type PageInjected } from './page.js';
import { css } from './style.js';
import { zh, en, type Key } from './locales.js';

declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { 'dsh-space': Key } }
declare module '@deepseek-ai/dsh-api-session-controller/client' { interface SessionReferenceSourceMap { spaceResource: unknown } }
const PANEL = 'dsh-project-space' as MainPanelId;
export const inject = ['slots', 'layout', 'locale', 'sessions', 'uiWorkspace', 'conversation', 'uiSession'];
function SpaceIcon(props: PropsRuntime<'sidebar.panellist'>) { return <svg width={props.size} height={props.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 7h7l2 2h9v11H3z" /><path d="M3 7V4h7l2 3h7v2" /></svg>; }
interface Actions { load: (id?: string) => Promise<void>; register: Library['register']; upload: Library['upload']; remove: Library['remove'] }
// The component derives both injected actions and framework selector hooks from the registration face.
type Face = PageInjected & Actions;
function Page(props: PropsRuntime<'main'> & InjectFace<Face> & import('@deepseek-ai/dsh-client-ui-slots').PropsLocale<'dsh-space'>) { return <SpacePage {...props} />; }
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('dsh-space', 'zh', zh));
  ctx.effect(() => ctx.locale.register('dsh-space', 'en', en));
  ctx.effect(() => { const style = document.createElement('style'); style.textContent = css; document.head.append(style); return () => style.remove(); });
  const library = new Library();
  ctx.effect(() => () => library.dispose());
  const current = () => Object.values(ctx.sessions.list.getSnapshot().byId).find(row => (row.retainedBy.mainView ?? 0) > 0);
  const sourceSession = () => { const row = current(); const workspace = library.getSnapshot().workspaces.find(w => w.id === library.getSnapshot().workspaceId); return row?.cwd === workspace?.cwd ? row?.id : undefined; };
  const insert = (id: SessionId, resource: Resource): void => {
    const scope = ctx.sessions.scope(id);
    if (!scope) throw new Error('会话尚未准备好，请稍后重试。');
    const input = ctx.conversation.input.for(scope);
    const snapshot = input.state.getSnapshot();
    const text = `${snapshot.draft ? '\n' : ''}请使用项目资源 ${JSON.stringify(resource.name)}（资源 ID：${resource.id}）。通过 space_read_resource 读取该资源。`;
    if (snapshot.phase !== 'plain') throw new Error('输入框正在提交或执行命令，请稍后再引用。');
    if (snapshot.occurrences.length) throw new Error('请先发送或清空输入框中的结构化引用，再添加资源引用。');
    input.setDraft(snapshot.draft + text);
  };
  const face: Face = {
    hooks: { library }, sourceSession,
    load: id => library.load(id), register: (file, role: ResourceRole, session) => library.register(file, role, session), upload: (file, role, session) => library.upload(file, role, session), remove: resource => library.remove(resource),
    reuse: async resource => {
      try {
        const workspace = library.getSnapshot().workspaces.find(w => w.id === resource.workspaceId);
        if (!workspace) throw new Error('工作区已移除。');
        const row = current();
        if (row?.cwd === workspace.cwd) { insert(row.id, resource); ctx.layout.selectPanel(null); ctx.conversation.input.for(ctx.sessions.scope(row.id)!).focus(); }
        else await ctx.uiWorkspace.openWorkspace(resource.workspaceId as WorkspaceId, id => insert(id, resource));
      } catch (error) { library.error(error); }
    },
    openSource: id => { ctx.uiWorkspace.openSession(id as SessionId); },
    back: () => ctx.layout.selectPanel(null),
  };
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL, locale: 'dsh-space', inject: () => face }, Page));
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL, order: 35, label: () => ctx.locale.bind('dsh-space')('panel') }, SpaceIcon));
  void library.load();
}
