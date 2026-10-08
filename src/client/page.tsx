import React, { useEffect, useRef, useState } from 'react';
import type { InjectFace, PropsRuntime, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { Resource, ResourceKind, ResourceRole, Preview } from '../shared.js';
import { Library, preview, resourceUrl } from './controller.js';

export interface PageInjected {
  hooks: { library: Library };
  sourceSession: () => string | undefined;
  reuse: (resource: Resource) => Promise<void>;
  openSource: (id: string) => void;
  back: () => void;
  load: (id?: string) => Promise<void>;
  register: Library['register'];
  upload: Library['upload'];
  remove: Library['remove'];
}
type PageProps = PropsRuntime<'main'> & InjectFace<PageInjected> & PropsLocale<'dsh-space'>;
type Translator = PageProps['t'];
const size = (bytes: number): string => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
function Icon({ name, size = 16 }: { name: 'folder' | 'back' | 'refresh' | 'plus' | 'upload' | 'search' | 'reuse' | 'close'; size?: number }) {
  const paths = { folder: 'M3 7V5a1 1 0 0 1 1-1h6l2 3h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7h9', back: 'M19 12H5m6-6-6 6 6 6', refresh: 'M20 7v5h-5m5-5a8 8 0 1 0 0 10', plus: 'M12 5v14M5 12h14', upload: 'M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4', search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', reuse: 'M5 7h10a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H5m4-4-4 4 4 4', close: 'm6 6 12 12M18 6 6 18' };
  return <svg className="dsp-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
function FileGlyph() { return <svg viewBox="0 0 52 64" fill="none" aria-hidden="true"><path d="M8 2h23l13 13v43a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z" fill="white" stroke="currentColor" strokeWidth="1.5" /><path d="M31 2v10a3 3 0 0 0 3 3h10" fill="#e8f1ff" stroke="currentColor" strokeWidth="1.5" /><path d="M14 30h20M14 37h20M14 44h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>; }
const format = (resource: Resource): string => resource.name.match(/\.([a-z0-9]{1,6})$/i)?.[1].toUpperCase() ?? (resource.kind === 'text' ? 'TEXT' : resource.kind.toUpperCase());
function ResourcePreview({ resource, t }: { resource: Resource; t: Translator }) {
  const [value, setValue] = useState<Preview>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setValue(undefined); setError('');
    preview(resource, controller.signal).then(setValue).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [resource]);
  if (error) return <p role="alert">{error}</p>;
  if (!value) return <p>{t('loading')}</p>;
  if (value.kind === 'image') return <img src={resourceUrl(resource)} alt={resource.name} />;
  if (value.kind === 'pdf') return <iframe src={resourceUrl(resource)} title={resource.name} />;
  if (value.kind === 'text') return <><pre>{value.text}</pre>{value.truncated && <p className="dsp-muted">{t('truncate')}</p>}</>;
  return <p>{t('noPreview')}</p>;
}
function Detail({ resource, t, reuse, openSource, remove, close, busy }: { resource: Resource; t: Translator; reuse: PageInjected['reuse']; openSource: PageInjected['openSource']; remove: () => void; close: () => void; busy: boolean }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current!;
    node.querySelector<HTMLElement>('button')?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const controls = [...node.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],iframe')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    node.addEventListener('keydown', keys);
    return () => { node.removeEventListener('keydown', keys); previous?.focus(); };
  }, [close]);
  return <div className="dsp-modal" onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialog} className="dsp-dialog" role="dialog" aria-modal="true" aria-label={resource.name}>
      <div className="dsp-dialog-header"><h2 id="dsp-detail-title">{resource.name}</h2><button onClick={close}>{t('close')}</button></div>
      <div className="dsp-dialog-content"><div className="dsp-preview"><ResourcePreview resource={resource} t={t} /></div>
        <aside className="dsp-details"><span className={`dsp-role ${resource.role}`}>{t(resource.role)}</span><p className="dsp-muted">{size(resource.size)} · {t(resource.kind)}</p>
          <dl><dt>{resource.origin === 'upload' ? t('storedCopy') : t('projectPath')}</dt><dd className="dsp-path">{resource.path}</dd><dt>{t('added')}</dt><dd>{new Date(resource.addedAt).toLocaleString()}</dd><dt>{t('source')}</dt><dd>{resource.sourceSessionId ? <button onClick={() => { close(); openSource(resource.sourceSessionId!); }}>{t('source')}</button> : t('noSource')}</dd><dt>{t('available')}</dt><dd>{t(resource.status)}</dd></dl>
          <div className="dsp-actions"><button className="dsp-primary" disabled={busy || resource.status === 'missing'} onClick={() => { close(); void reuse(resource); }}>{t('reuse')}</button><a className="dsp-button" href={resourceUrl(resource, true)} download={resource.name}>{t('download')}</a><button className="dsp-danger" disabled={busy} onClick={remove}>{t('remove')}</button></div>
          <p className="dsp-muted dsp-foot">{t('removeHint')}</p>
        </aside></div>
    </div>
  </div>;
}
export function SpacePage(props: PageProps) {
  const { t } = props;
  const library = props.useLibrary(value => value);
  const [role, setRole] = useState<ResourceRole | 'all'>('all');
  const [kind, setKind] = useState<ResourceKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<'register' | 'upload' | undefined>();
  const [addRole, setAddRole] = useState<ResourceRole>('input');
  const [filePath, setFilePath] = useState('');
  const [selected, setSelected] = useState<Resource>();
  const fileInput = useRef<HTMLInputElement>(null);
  const source = props.sourceSession;
  const workspace = library.workspaces.find(w => w.id === library.workspaceId);
  const visible = library.resources.filter(r => (role === 'all' || r.role === role) && (kind === 'all' || r.kind === kind) && `${r.name} ${r.path}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const close = React.useCallback(() => setSelected(undefined), []);
  return <section className="dsp" aria-label={t('panel')}><div className="dsp-shell">
    <div className="dsp-top"><div><div className="dsp-eyebrow"><span>PROJECT SPACE</span><span className="dsp-eyebrow-dot" aria-hidden="true" /><span>{t('tools')}</span></div><h1>{t('title')}</h1><p className="dsp-muted">{t('subtitle')}</p></div><button className="dsp-back" onClick={props.back}><Icon name="back" />{t('back')}</button></div>
    <div className="dsp-project"><div className="dsp-project-info"><div className="dsp-workspace-icon"><Icon name="folder" size={23} /></div><div className="dsp-project-text"><label htmlFor="dsp-workspace">{t('workspace')}</label><div><select id="dsp-workspace" value={library.workspaceId} disabled={library.busy} onChange={event => { setSelected(undefined); void props.load(event.target.value); }}>{library.workspaces.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}</select></div><div className="dsp-path dsp-project-path dsp-muted" title={workspace?.cwd}>{workspace?.cwd ?? t('noWorkspace')}</div></div></div><div className="dsp-top-actions"><button onClick={() => void props.load()} disabled={library.busy || library.loading}><Icon name="refresh" />{t('refresh')}</button><button onClick={() => { setForm('register'); setAddRole('output'); }} disabled={!workspace || library.busy}><Icon name="plus" />{t('register')}</button><button className="dsp-primary" onClick={() => { setForm('upload'); setAddRole('input'); }} disabled={!workspace || library.busy}><Icon name="upload" />{t('upload')}</button></div></div>
    {library.error && <div className="dsp-notice" role="alert">{library.error}</div>}
    {form && <form className="dsp-form" onSubmit={event => { event.preventDefault(); if (filePath) void props.register(filePath, addRole, source()); }}>
      <div className="dsp-controls"><strong>{t(form)}</strong><select aria-label={t('purpose')} value={addRole} onChange={event => setAddRole(event.target.value as ResourceRole)}><option value="input">{t('input')}</option><option value="output">{t('output')}</option></select><button type="button" aria-label={t('cancel')} onClick={() => setForm(undefined)}><Icon name="close" /></button></div>
      {form === 'register' ? <><label htmlFor="dsp-path">{t('path')}</label><input id="dsp-path" type="text" value={filePath} onChange={event => setFilePath(event.target.value)} placeholder="output/report.md" required /><button className="dsp-primary" disabled={library.busy || !filePath}>{t('add')}</button></> : <><input ref={fileInput} aria-label={t('upload')} type="file" disabled={library.busy} onChange={event => { const file = event.target.files?.[0]; if (file) void props.upload(file, addRole, source()); event.target.value = ''; }} /><p className="dsp-muted">{t('uploadHint')}</p></>}
    </form>}
    <div className="dsp-tabs">{(['all', 'input', 'output'] as const).map(tab => <button key={tab} aria-pressed={role === tab} onClick={() => setRole(tab)}>{t(tab)} <span className="dsp-tab-count">{library.resources.filter(r => tab === 'all' || r.role === tab).length}</span></button>)}</div>
    <div className="dsp-controls"><div className="dsp-search"><Icon name="search" /><input aria-label={t('search')} placeholder={t('search')} value={query} onChange={event => setQuery(event.target.value)} /></div><select aria-label={t('anyKind')} value={kind} onChange={event => setKind(event.target.value as ResourceKind | 'all')}><option value="all">{t('anyKind')}</option>{(['text', 'image', 'pdf', 'other'] as const).map(k => <option key={k} value={k}>{t(k)}</option>)}</select><span className="dsp-muted dsp-resource-count">{visible.length} {t('count')}</span></div>
    {library.loading ? <p role="status">{t('loading')}</p> : visible.length === 0 ? <div className="dsp-blank"><div className="dsp-blank-icon"><Icon name="folder" size={28} /></div><h2>{library.resources.length ? t('noMatch') : t('empty')}</h2><p className="dsp-muted">{t('emptyHint')}</p><p className="dsp-muted dsp-foot">{t('toolHint')}</p></div> : <div className="dsp-grid">{visible.map(resource => <article className="dsp-card" key={resource.id}><button className="dsp-card-open" aria-label={`${t('preview')} ${resource.name}`} onClick={() => setSelected(resource)}><div className="dsp-thumb" data-kind={resource.kind}>{resource.kind === 'image' && resource.status !== 'missing' ? <img src={resourceUrl(resource)} alt="" loading="lazy" /> : <FileGlyph />}<span className="dsp-file-format">{format(resource)}</span></div><div className="dsp-card-body"><div className="dsp-name" title={resource.name}>{resource.name}</div><div className="dsp-card-meta dsp-muted"><span>{size(resource.size)}</span><span>{new Date(resource.addedAt).toLocaleDateString()}</span></div>{resource.status !== 'available' && <div className="dsp-state">{t(resource.status)}</div>}</div></button><div className="dsp-card-footer"><span className={`dsp-role ${resource.role}`}>{t(resource.role)}</span><button disabled={library.busy || resource.status === 'missing'} onClick={() => void props.reuse(resource)}><Icon name="reuse" size={13} />{t('reuse')}</button></div></article>)}</div>}
    <p className="dsp-muted dsp-foot">{t('help')}</p>
    {selected && <Detail resource={selected} t={t} busy={library.busy} reuse={props.reuse} openSource={props.openSource} remove={() => { close(); void props.remove(selected); }} close={close} />}
  </div></section>;
}
