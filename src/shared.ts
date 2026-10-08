export type ResourceRole = 'input' | 'output';
export type ResourceKind = 'text' | 'image' | 'pdf' | 'other';
export type ResourceStatus = 'available' | 'changed' | 'missing';

export interface SpaceInfo { id: string; title: string; cwd: string }
export interface Resource {
  id: string;
  workspaceId: string;
  name: string;
  role: ResourceRole;
  kind: ResourceKind;
  mime: string;
  size: number;
  addedAt: string;
  sourceSessionId?: string;
  path: string;
  origin: 'workspace' | 'upload';
  status: ResourceStatus;
}
export interface AddResource {
  workspaceId: string;
  path: string;
  role: ResourceRole;
  sourceSessionId?: string;
}
export interface UploadResource {
  workspaceId: string;
  name: string;
  base64: string;
  role: ResourceRole;
  sourceSessionId?: string;
}
export interface Preview { kind: ResourceKind; text?: string; truncated?: boolean; url?: string }
export const API = '/dsh-space/api';
