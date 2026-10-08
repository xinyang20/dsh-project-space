import { API, type Resource, type SpaceInfo, type ResourceRole, type Preview } from '../shared.js';

export interface LibrarySnapshot { workspaces: SpaceInfo[]; workspaceId: string; resources: Resource[]; loading: boolean; busy: boolean; error: string }
export async function request<T>(route: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${route}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? `HTTP ${response.status}`);
  return data as T;
}
export function resourceUrl(resource: Resource, download = false): string {
  return `${API}/file?${new URLSearchParams({ workspaceId: resource.workspaceId, id: resource.id, ...(download ? { download: '1' } : {}) })}`;
}
export class Library {
  private value: LibrarySnapshot = { workspaces: [], workspaceId: '', resources: [], loading: false, busy: false, error: '' };
  private listeners = new Set<() => void>();
  private epoch = 0;
  private disposed = false;
  getSnapshot = (): LibrarySnapshot => this.value;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish(update: Partial<LibrarySnapshot>): void {
    if (this.disposed) return;
    this.value = { ...this.value, ...update };
    for (const listener of this.listeners) listener();
  }
  dispose(): void { this.disposed = true; this.epoch++; this.listeners.clear(); }
  error = (error: unknown): void => this.publish({ error: error instanceof Error ? error.message : String(error) });
  async load(workspaceId?: string): Promise<void> {
    const epoch = ++this.epoch;
    this.publish({ loading: true, resources: [], error: '', ...(workspaceId ? { workspaceId } : {}) });
    try {
      const workspaces = await request<SpaceInfo[]>('/workspaces');
      const chosen = workspaceId ?? this.value.workspaceId;
      const id = workspaces.some(w => w.id === chosen) ? chosen : workspaces[0]?.id ?? '';
      const resources = id ? await request<Resource[]>(`/resources?${new URLSearchParams({ workspaceId: id })}`) : [];
      if (epoch === this.epoch) this.publish({ workspaces, workspaceId: id, resources, loading: false });
    } catch (error) { if (epoch === this.epoch) { this.publish({ loading: false }); this.error(error); } }
  }
  async mutate(operation: () => Promise<unknown>): Promise<void> {
    if (this.value.busy) return;
    const id = this.value.workspaceId;
    this.publish({ busy: true, error: '' });
    try { await operation(); await this.load(this.value.workspaceId || id); }
    catch (error) { this.error(error); }
    finally { this.publish({ busy: false }); }
  }
  register(filePath: string, role: ResourceRole, sourceSessionId?: string): Promise<void> {
    const workspaceId = this.value.workspaceId;
    return this.mutate(() => request('/register', { method: 'POST', body: JSON.stringify({ workspaceId, path: filePath, role, sourceSessionId }) }));
  }
  upload(file: File, role: ResourceRole, sourceSessionId?: string): Promise<void> {
    const workspaceId = this.value.workspaceId;
    return this.mutate(async () => {
      if (file.size > 20 * 1024 * 1024) throw new Error('文件超过 20 MiB 上限。');
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('无法读取文件。')); reader.onload = () => resolve(String(reader.result).split(',')[1] ?? ''); reader.readAsDataURL(file); });
      return request('/upload', { method: 'POST', body: JSON.stringify({ workspaceId, name: file.name, base64: data, role, sourceSessionId }) });
    });
  }
  remove(resource: Resource): Promise<void> { return this.mutate(() => request(`/resources?${new URLSearchParams({ workspaceId: resource.workspaceId, id: resource.id })}`, { method: 'DELETE' })); }
}
export function preview(resource: Resource, signal: AbortSignal): Promise<Preview> {
  return request(`/preview?${new URLSearchParams({ workspaceId: resource.workspaceId, id: resource.id })}`, { signal });
}
