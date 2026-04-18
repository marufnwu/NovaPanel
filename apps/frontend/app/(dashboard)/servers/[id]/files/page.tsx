'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'link';
  size: number;
  modifiedAt: string | null;
  permissions: string;
}

export default function FilesPage() {
  const params = useParams();
  const serverId = params.id as string;

  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editor state
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New directory dialog
  const [newDirName, setNewDirName] = useState('');
  const [showNewDir, setShowNewDir] = useState(false);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<{ path: string; entries: FileEntry[] }>(
        `/servers/${serverId}/files?path=${encodeURIComponent(path)}`,
      );
      setCurrentPath(data.path);
      setEntries(data.entries);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    loadDirectory('/');
  }, [loadDirectory]);

  async function navigateTo(path: string) {
    setEditingFile(null);
    await loadDirectory(path);
  }

  async function openFile(path: string) {
    setEditLoading(true);
    setEditingFile(path);
    try {
      const data = await api.get<{ content: string }>(
        `/servers/${serverId}/files/content?path=${encodeURIComponent(path)}`,
      );
      setEditContent(data.content);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      setEditingFile(null);
    } finally {
      setEditLoading(false);
    }
  }

  async function saveFile() {
    if (!editingFile) return;
    setSaving(true);
    try {
      await api.put(`/servers/${serverId}/files/content`, {
        path: editingFile,
        content: editContent,
      });
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(path: string, type: string) {
    const label = type === 'directory' ? 'directory' : 'file';
    if (!confirm(`Delete ${label} "${path.split('/').pop()}"?`)) return;
    try {
      await api.delete(`/servers/${serverId}/files?path=${encodeURIComponent(path)}&type=${type}`);
      loadDirectory(currentPath);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }

  async function handleCreateDir() {
    if (!newDirName.trim()) return;
    const fullPath = currentPath === '/' ? `/${newDirName}` : `${currentPath}/${newDirName}`;
    try {
      await api.post(`/servers/${serverId}/files/mkdir`, { path: fullPath });
      setShowNewDir(false);
      setNewDirName('');
      loadDirectory(currentPath);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  }

  function downloadFileUrl(path: string) {
    const token = getAccessToken();
    return `/api/v1/servers/${serverId}/files/download?path=${encodeURIComponent(path)}`;
  }

  // Breadcrumb
  const pathParts = currentPath.split('/').filter(Boolean);

  if (editingFile) {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
          <div className="flex items-center gap-2">
            <button onClick={() => setEditingFile(null)} className="text-sm text-muted-foreground hover:text-foreground">
              ← Back
            </button>
            <span className="text-sm font-mono">{editingFile}</span>
          </div>
          <button
            onClick={saveFile}
            disabled={saving || editLoading}
            className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {editLoading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading file...</div>
        ) : (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="flex-1 w-full p-4 font-mono text-sm bg-zinc-900 text-zinc-100 resize-none focus:outline-none"
            spellCheck={false}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">File Manager</h2>
        <button
          onClick={() => setShowNewDir(true)}
          className="rounded-md border border-input px-3 py-1 text-sm hover:bg-muted"
        >
          New Folder
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        <button onClick={() => navigateTo('/')} className="text-muted-foreground hover:text-foreground">/</button>
        {pathParts.map((part, i) => {
          const path = '/' + pathParts.slice(0, i + 1).join('/');
          return (
            <span key={path} className="flex items-center gap-1">
              <span className="text-muted-foreground">/</span>
              <button onClick={() => navigateTo(path)} className="text-muted-foreground hover:text-foreground">
                {part}
              </button>
            </span>
          );
        })}
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {/* New Directory Dialog */}
      {showNewDir && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newDirName}
            onChange={(e) => setNewDirName(e.target.value)}
            placeholder="folder-name"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateDir()}
          />
          <button onClick={handleCreateDir} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">Create</button>
          <button onClick={() => { setShowNewDir(false); setNewDirName(''); }} className="text-sm text-muted-foreground">Cancel</button>
        </div>
      )}

      {/* File List */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground w-24">Size</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground w-44">Modified</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentPath !== '/' && (
                <tr className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => navigateTo(currentPath.split('/').slice(0, -1).join('/') || '/')}>
                  <td className="px-4 py-2 text-muted-foreground">..</td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2" />
                </tr>
              )}
              {entries.map((entry) => (
                <tr key={entry.path} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <button
                      onClick={() => entry.type === 'directory' ? navigateTo(entry.path) : openFile(entry.path)}
                      className="text-left hover:underline"
                    >
                      <span className="mr-2">{entry.type === 'directory' ? '📁' : entry.type === 'link' ? '🔗' : '📄'}</span>
                      {entry.name}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{entry.type === 'directory' ? '-' : formatSize(entry.size)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{entry.modifiedAt ? new Date(entry.modifiedAt).toLocaleString() : '-'}</td>
                  <td className="px-4 py-2 text-right">
                    {entry.type === 'file' && (
                      <>
                        <a
                          href={`/api/v1/servers/${serverId}/files/download?path=${encodeURIComponent(entry.path)}`}
                          className="text-xs text-muted-foreground hover:text-foreground mr-2"
                        >
                          Download
                        </a>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(entry.path, entry.type)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Empty directory</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function getAccessToken(): string {
  // Access token is stored in memory in the api-client module
  // For download links, we'll use a simple approach
  return '';
}
