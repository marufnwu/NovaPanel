import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface FileEntry {
  name: string;
  type: string;
  size: number;
  permissions: string;
  modifiedAt: string;
  isDirectory: boolean;
  owner?: string;
  group?: string;
  uid?: number;
  gid?: number;
}

export interface DirectoryListing {
  path: string;
  items: FileEntry[];
}

export interface DirectoryTreeNode {
  name: string;
  path: string;
  type: string;
  isDirectory: boolean;
  isExpanded?: boolean;
  children?: DirectoryTreeNode[];
}

export interface DirectorySize {
  path: string;
  size: number;
  sizeHuman: string;
}

export interface FileOwnership {
  path: string;
  uid: number;
  gid: number;
  user?: string;
  group?: string;
}

/** Build context query params for API calls */
function contextParams(domainId?: string, websiteId?: string): string {
  const params: string[] = [];
  if (websiteId) params.push(`websiteId=${encodeURIComponent(websiteId)}`);
  else if (domainId) params.push(`domainId=${encodeURIComponent(domainId)}`);
  return params.length ? `&${params.join('&')}` : '';
}

export function useDirectoryListing(path: string, domainId?: string, websiteId?: string) {
  const ctx = contextParams(domainId, websiteId);
  return useQuery({
    queryKey: ['files', path, domainId ? { domainId } : undefined, websiteId ? { websiteId } : undefined],
    queryFn: () => api.get<DirectoryListing>(`/files?path=${encodeURIComponent(path)}${ctx}`),
    enabled: !!path,
  });
}

export function useFileContent(path: string, domainId?: string, websiteId?: string) {
  const ctx = contextParams(domainId, websiteId);
  return useQuery({
    queryKey: ['files', 'content', path, domainId ? { domainId } : undefined, websiteId ? { websiteId } : undefined],
    queryFn: () => api.get<{ content: string }>(`/files/content?path=${encodeURIComponent(path)}${ctx}`),
    enabled: !!path,
  });
}

export function useCreateDirectory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { path: string; name: string; domainId?: string; websiteId?: string }) =>
      api.post('/files/mkdir', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { path: string; domainId?: string; websiteId?: string }) => {
      const ctx = contextParams(data.domainId, data.websiteId);
      return api.delete(`/files?path=${encodeURIComponent(data.path)}${ctx}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useRenameFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { oldPath: string; newPath: string; domainId?: string; websiteId?: string }) =>
      api.post('/files/rename', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useSaveFileContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { path: string; content: string; domainId?: string; websiteId?: string }) =>
      api.put('/files/content', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useChmod() {
  return useMutation({
    mutationFn: (data: { path: string; mode: string; domainId?: string; websiteId?: string }) =>
      api.put('/files/permissions', data),
  });
}

export function useArchive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { paths: string[]; name: string; domainId?: string; websiteId?: string }) =>
      api.post('/files/archive', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useExtract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { archivePath: string; targetDir?: string; domainId?: string; websiteId?: string }) =>
      api.post('/files/extract', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useDirectoryTree(path: string, showHidden: boolean = false, domainId?: string, websiteId?: string) {
  const ctx = contextParams(domainId, websiteId);
  return useQuery({
    queryKey: ['files', 'tree', path, showHidden, domainId ? { domainId } : undefined, websiteId ? { websiteId } : undefined],
    queryFn: () => api.get<DirectoryTreeNode>(`/files/tree?path=${encodeURIComponent(path)}&showHidden=${showHidden}${ctx}`),
    enabled: !!path,
  });
}

export function useCopyFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sourcePath: string; targetPath: string; domainId?: string; websiteId?: string }) =>
      api.post('/files/copy', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useMoveFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sourcePath: string; targetPath: string; domainId?: string; websiteId?: string }) =>
      api.post('/files/move', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useDirectorySize(path: string, domainId?: string, websiteId?: string) {
  const ctx = contextParams(domainId, websiteId);
  return useQuery({
    queryKey: ['files', 'size', path, domainId ? { domainId } : undefined, websiteId ? { websiteId } : undefined],
    queryFn: () => api.get<DirectorySize>(`/files/size?path=${encodeURIComponent(path)}${ctx}`),
    enabled: !!path,
  });
}

export function useFileOwnership(path: string, domainId?: string, websiteId?: string) {
  const ctx = contextParams(domainId, websiteId);
  return useQuery({
    queryKey: ['files', 'owner', path, domainId ? { domainId } : undefined, websiteId ? { websiteId } : undefined],
    queryFn: () => api.get<FileOwnership>(`/files/owner?path=${encodeURIComponent(path)}${ctx}`),
    enabled: !!path,
  });
}
