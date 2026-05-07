import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useDomains } from '../../api/hooks/domains';
import { useWebsite, useWebsites } from '../../api/hooks/websites';
import {
  useDirectoryListing,
  useCreateDirectory,
  useDeleteFile,
  useFileContent,
  useSaveFileContent,
  useRenameFile,
  useChmod,
  useArchive,
  useExtract,
  useDirectoryTree,
  useCopyFile,
  useMoveFile,
  useDirectorySize
} from '../../api/hooks/files';
import type { FileEntry, DirectoryTreeNode } from '../../api/hooks/files';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ImagePreviewModal, VideoPreviewModal, PDFPreviewModal, ArchiveBrowserModal } from '../../components/files/FilePreviewModal';
import { CodeEditor } from '../../components/files/CodeEditor';
import { 
  File, 
  Folder, 
  FolderPlus, 
  Trash2, 
  Edit2, 
  ChevronRight, 
  Download, 
  Upload, 
  Archive, 
  Eye, 
  EyeOff, 
  Key, 
  Copy, 
  X, 
  Check, 
  Search, 
  MoreHorizontal, 
  ArrowLeft, 
  Package,
  FilePlus,
  Scissors,
  ArrowUpDown,
  CheckSquare,
  Square,
  Globe
} from 'lucide-react';

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getIcon(entry: FileEntry) {
  if (entry.isDirectory) return <Folder className="h-5 w-5 text-blue-400" />;
  const ext = entry.name.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, React.ReactNode> = {
    php: <span className="text-purple-400 text-xs font-mono font-bold">PHP</span>,
    js: <span className="text-yellow-400 text-xs font-mono font-bold">JS</span>,
    ts: <span className="text-blue-400 text-xs font-mono font-bold">TS</span>,
    html: <span className="text-orange-400 text-xs font-mono font-bold">HTML</span>,
    css: <span className="text-blue-500 text-xs font-mono font-bold">CSS</span>,
    json: <span className="text-green-400 text-xs font-mono font-bold">JSON</span>,
    sql: <span className="text-red-400 text-xs font-mono font-bold">SQL</span>,
    md: <span className="text-gray-400 text-xs font-mono font-bold">MD</span>,
    jpg: <File className="h-5 w-5 text-green-500" />,
    jpeg: <File className="h-5 w-5 text-green-500" />,
    png: <File className="h-5 w-5 text-green-500" />,
    gif: <File className="h-5 w-5 text-green-500" />,
    svg: <File className="h-5 w-5 text-green-500" />,
    zip: <Archive className="h-5 w-5 text-yellow-500" />,
    tar: <Archive className="h-5 w-5 text-yellow-500" />,
    gz: <Archive className="h-5 w-5 text-yellow-500" />,
    log: <File className="h-5 w-5 text-gray-500" />,
  };
  return icons[ext] || <File className="h-5 w-5 text-muted-foreground" />;
}

function FileEditorWrapper({ path, domainId, websiteId, onBack }: { path: string; domainId?: string; websiteId?: string; onBack: () => void }) {
  const { data, isLoading } = useFileContent(path, domainId, websiteId);
  const saveContent = useSaveFileContent();

  const handleSave = async (content: string) => {
    await saveContent.mutateAsync({ path, content, domainId, websiteId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <CodeEditor
      path={path}
      content={data?.content || ''}
      onSave={handleSave}
      onBack={onBack}
    />
  );
}

function PermissionsModal({ path, currentMode, isDirectory, domainId, websiteId, onClose }: { path: string; currentMode: string; isDirectory: boolean; domainId?: string; websiteId?: string; onClose: () => void }) {
  const chmod = useChmod();
  const [mode, setMode] = useState(currentMode.replace(/^0/, ''));
  const [recursive, setRecursive] = useState(false);

  const parseMode = (m: string) => {
    const padded = m.padStart(3, '0');
    const o = parseInt(padded[0] || '0', 8);
    const g = parseInt(padded[1] || '0', 8);
    const w = parseInt(padded[2] || '0', 8);
    return {
      owner: { read: !!(o & 4), write: !!(o & 2), execute: !!(o & 1) },
      group: { read: !!(g & 4), write: !!(g & 2), execute: !!(g & 1) },
      other: { read: !!(w & 4), write: !!(w & 2), execute: !!(w & 1) },
    };
  };

  const perms = parseMode(mode);

  const updateModeFromPerms = (newPerms: typeof perms) => {
    const o = (newPerms.owner.read ? 4 : 0) + (newPerms.owner.write ? 2 : 0) + (newPerms.owner.execute ? 1 : 0);
    const g = (newPerms.group.read ? 4 : 0) + (newPerms.group.write ? 2 : 0) + (newPerms.group.execute ? 1 : 0);
    const w = (newPerms.other.read ? 4 : 0) + (newPerms.other.write ? 2 : 0) + (newPerms.other.execute ? 1 : 0);
    setMode(`${o}${g}${w}`);
  };

  const togglePerm = (scope: 'owner' | 'group' | 'other', perm: 'read' | 'write' | 'execute') => {
    const newPerms = {
      ...perms,
      [scope]: { ...perms[scope], [perm]: !perms[scope][perm] },
    };
    updateModeFromPerms(newPerms);
  };

  const handleOctalChange = (value: string) => {
    const sanitized = value.replace(/[^0-7]/g, '').slice(0, 3);
    setMode(sanitized);
  };

  const presets = [
    { label: '644 (rw-r--r--)', value: '644' },
    { label: '755 (rwxr-xr-x)', value: '755' },
    { label: '600 (rw-------)', value: '600' },
    { label: '400 (r--------)', value: '400' },
    { label: '666 (rw-rw-rw-)', value: '666' },
  ];

  const isValidMode = /^[0-7]{3}$/.test(mode);

  const handleApply = () => {
    chmod.mutate({ path, mode: mode.padStart(3, '0'), domainId, websiteId }, { onSuccess: onClose });
  };

  const PermCheckbox = ({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) => (
    <label className="flex items-center justify-center gap-1 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded border-border"
      />
      <span className="text-xs text-muted-foreground sr-only">{label}</span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold">Change Permissions</h3>

        {/* Checkbox Grid */}
        <div className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left font-medium pb-2 pr-4"></th>
                <th className="text-center font-medium pb-2 px-2">Read</th>
                <th className="text-center font-medium pb-2 px-2">Write</th>
                <th className="text-center font-medium pb-2 px-2">Execute</th>
              </tr>
            </thead>
            <tbody>
              {(['owner', 'group', 'other'] as const).map((scope) => (
                <tr key={scope}>
                  <td className="py-1.5 pr-4 font-medium capitalize">{scope}</td>
                  <td className="py-1.5 px-2 text-center">
                    <PermCheckbox
                      checked={perms[scope].read}
                      onChange={() => togglePerm(scope, 'read')}
                      label={`${scope} read`}
                    />
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <PermCheckbox
                      checked={perms[scope].write}
                      onChange={() => togglePerm(scope, 'write')}
                      label={`${scope} write`}
                    />
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <PermCheckbox
                      checked={perms[scope].execute}
                      onChange={() => togglePerm(scope, 'execute')}
                      label={`${scope} execute`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Octal input */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">Octal value</label>
          <input
            value={mode}
            onChange={(e) => handleOctalChange(e.target.value)}
            maxLength={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            placeholder="e.g. 755"
          />
          {!isValidMode && mode.length > 0 && (
            <p className="mt-1 text-xs text-destructive">Enter a valid octal value (000-777)</p>
          )}
        </div>

        {/* Presets */}
        <div className="mb-4 space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Quick presets</span>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.value}
                onClick={() => setMode(p.value)}
                className={`rounded-md border px-2.5 py-1 text-xs hover:bg-accent ${
                  mode === p.value ? 'border-primary bg-primary/5 text-primary' : 'border-border'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recursive checkbox for directories */}
        {isDirectory && (
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={recursive}
                onChange={(e) => setRecursive(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Apply recursively</span>
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleApply} disabled={chmod.isPending || !isValidMode} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Apply</button>
        </div>
      </div>
    </div>
  );
}

function RenameModal({ path, domainId, websiteId, onClose }: { path: string; domainId?: string; websiteId?: string; onClose: () => void }) {
  const rename = useRenameFile();
  const name = path.split('/').pop() || '';
  const [newName, setNewName] = useState(name);
  const dir = path.substring(0, path.length - name.length);

  const handleRename = () => {
    if (!newName.trim() || newName === name) return;
    rename.mutate({ oldPath: path, newPath: dir + newName, domainId, websiteId }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold">Rename</h3>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-4" autoFocus />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleRename} disabled={rename.isPending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Rename</button>
        </div>
      </div>
    </div>
  );
}

function UploadModal({ domainId, websiteId, currentPath, onClose }: { domainId?: string; websiteId?: string; currentPath: string; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [autoExtract, setAutoExtract] = useState(false);

  const contextParam = websiteId ? `websiteId=${encodeURIComponent(websiteId)}` : domainId ? `domainId=${encodeURIComponent(domainId)}` : '';

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);
      setProgress(((i + 1) / files.length) * 100);
      const uploadUrl = `/api/v1/files/upload?path=${encodeURIComponent(currentPath)}${contextParam ? `&${contextParam}` : ''}`;
      await fetch(uploadUrl, { method: 'POST', body: formData, headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      
      // Auto-extract if enabled and file is an archive
      if (autoExtract && (file.name.endsWith('.zip') || file.name.endsWith('.tar.gz'))) {
        const extractData: Record<string, string> = {
          archivePath: `${currentPath === '/' ? '' : currentPath}/${file.name}`,
        };
        if (websiteId) extractData.websiteId = websiteId;
        else if (domainId) extractData.domainId = domainId;
        await fetch('/api/v1/files/extract', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify(extractData)
        });
      }
    }
    setUploading(false);
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Upload Files</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
          className="cursor-pointer rounded-lg border-2 border-dashed border-border p-8 text-center hover:border-primary/50"
        >
          <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Click or drag files here to upload</p>
        </div>
        <input ref={fileInputRef} type="file" multiple onChange={(e) => handleUpload(e.target.files)} className="hidden" />
        <div className="mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoExtract} onChange={(e) => setAutoExtract(e.target.checked)} className="rounded" />
            <span className="text-sm">Auto-extract archives after upload</span>
          </label>
        </div>
        {uploading && <div className="mt-4 h-2 rounded-full bg-primary/20"><div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>}
      </div>
    </div>
  );
}

function NewFolderModal({ currentPath, domainId, websiteId, onClose }: { currentPath: string; domainId?: string; websiteId?: string; onClose: () => void }) {
  const mkdir = useCreateDirectory();
  const [name, setName] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    mkdir.mutate({ path: currentPath, name, domainId, websiteId }, { onSuccess: () => { onClose(); setName(''); } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold">New Folder</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="folder_name" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-4" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleCreate} disabled={mkdir.isPending || !name.trim()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Create</button>
        </div>
      </div>
    </div>
  );
}

function NewFileModal({ currentPath, domainId, websiteId, onClose }: { currentPath: string; domainId?: string; websiteId?: string; onClose: () => void }) {
  const saveContent = useSaveFileContent();
  const [name, setName] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    saveContent.mutate({ path: `${currentPath === '/' ? '' : currentPath}/${name}`, content: '', domainId, websiteId }, { onSuccess: () => { onClose(); setName(''); } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold">New File</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="file_name.ext" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-4" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button onClick={handleCreate} disabled={saveContent.isPending || !name.trim()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Create</button>
        </div>
      </div>
    </div>
  );
}

function ContextMenu({ entry, x, y, onClose, onEdit, onRename, onPermissions, onDelete, onCopy, onCut, onPreview }: {
  entry: FileEntry;
  x: number;
  y: number;
  onClose: () => void;
  onEdit: () => void;
  onRename: () => void;
  onPermissions: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="fixed z-50 rounded-lg border border-border bg-card shadow-lg py-1 text-sm min-w-[180px]" style={{ left: x, top: y }}>
      {!entry.isDirectory && <button onClick={() => { onEdit(); onClose(); }} className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-2"><Eye className="h-4 w-4" /> View/Edit</button>}
      <button onClick={() => { onPreview(); onClose(); }} className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-2"><Eye className="h-4 w-4" /> Preview</button>
      <button onClick={() => { onCopy(); onClose(); }} className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-2"><Copy className="h-4 w-4" /> Copy</button>
      <button onClick={() => { onCut(); onClose(); }} className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-2"><Scissors className="h-4 w-4" /> Cut</button>
      <button onClick={() => { onRename(); onClose(); }} className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-2"><Edit2 className="h-4 w-4" /> Rename</button>
      <button onClick={() => { onPermissions(); onClose(); }} className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-2"><Key className="h-4 w-4" /> Permissions</button>
      <hr className="my-1 border-border" />
      <button onClick={() => { onDelete(); onClose(); }} className="w-full px-4 py-2 text-left hover:bg-destructive/10 text-destructive flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete</button>
    </div>
  );
}

function FileTree({ tree, currentPath, onNavigate, expandedNodes, onToggleExpand }: {
  tree: DirectoryTreeNode | null | undefined;
  currentPath: string;
  onNavigate: (path: string) => void;
  expandedNodes: Set<string>;
  onToggleExpand: (path: string) => void;
}) {
  if (!tree) return null;

  const renderNode = (node: DirectoryTreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.path);
    const isActive = currentPath === node.path || currentPath.startsWith(node.path + '/');

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent ${isActive ? 'bg-primary/10 text-primary' : ''}`}
          style={{ paddingLeft: `${level * 12 + 12}px` }}
          onClick={() => {
            if (node.isDirectory) {
              onToggleExpand(node.path);
              if (!isExpanded) onNavigate(node.path);
            } else {
              onNavigate(node.path);
            }
          }}
        >
          {node.isDirectory && (
            <ChevronRight 
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
            />
          )}
          {node.isDirectory ? <Folder className="h-4 w-4 text-blue-400" /> : <File className="h-4 w-4 text-muted-foreground" />}
          <span className="truncate">{node.name}</span>
        </div>
        {node.isDirectory && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {renderNode(tree)}
    </div>
  );
}

export function FilesPage() {
  // Read URL query params for websiteId (website-scoped browsing)
  const urlWebsiteId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('websiteId') || undefined;
  }, []);

  const { data: domains } = useDomains();
  const { data: websites } = useWebsites();

  // When websiteId is in URL, use website context; otherwise use website/domain selector
  const [selectedWebsiteId, setSelectedWebsiteId] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [currentPath, setCurrentPath] = useState('/');
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [permissionsTarget, setPermissionsTarget] = useState<{ path: string; mode: string; isDirectory: boolean } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ entry: FileEntry; x: number; y: number } | null>(null);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['/']));
  const [clipboard, setClipboard] = useState<{ items: FileEntry[]; operation: 'copy' | 'cut' } | null>(null);
  const [previewModal, setPreviewModal] = useState<{ type: 'image' | 'video' | 'pdf' | 'archive'; entry: FileEntry } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const activeWebsiteId = urlWebsiteId || selectedWebsiteId || undefined;
  const activeDomainId = activeWebsiteId ? undefined : (selectedDomainId || undefined);
  const hasContext = !!(activeWebsiteId || activeDomainId);

  const { data: website } = useWebsite(activeWebsiteId || '');

  // Load preferences from localStorage
  useEffect(() => {
    const savedShowHidden = localStorage.getItem('files_showHidden');
    const savedSortBy = localStorage.getItem('files_sortBy');
    const savedSortOrder = localStorage.getItem('files_sortOrder');
    if (savedShowHidden) setShowHidden(savedShowHidden === 'true');
    if (savedSortBy) setSortBy(savedSortBy as any);
    if (savedSortOrder) setSortOrder(savedSortOrder as any);
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('files_showHidden', String(showHidden));
    localStorage.setItem('files_sortBy', sortBy);
    localStorage.setItem('files_sortOrder', sortOrder);
  }, [showHidden, sortBy, sortOrder]);

  const { data: listing, isLoading } = useDirectoryListing(
    selectedDomainId && !activeWebsiteId ? `/${selectedDomainId}${currentPath}` : currentPath,
    activeDomainId,
    activeWebsiteId
  );
  const { data: tree } = useDirectoryTree(
    selectedDomainId && !activeWebsiteId ? `/${selectedDomainId}` : '/',
    showHidden,
    activeDomainId,
    activeWebsiteId
  );
  const deleteFile = useDeleteFile();
  const copyFile = useCopyFile();
  const moveFile = useMoveFile();

  const fullPath = selectedDomainId && !activeWebsiteId ? `/${selectedDomainId}${currentPath}` : currentPath;
  const items: FileEntry[] = listing?.items || [];

  const filtered = search
    ? items.filter((item: FileEntry) => item.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSearch('');
    setSelectedItems(new Set());
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ entry, x: e.clientX, y: e.clientY });
  };

  const handleEdit = (entry: FileEntry) => {
    const entryPath = `${currentPath === '/' ? '' : currentPath}/${entry.name}`;
    setEditingFile(selectedDomainId && !activeWebsiteId ? `/${selectedDomainId}${entryPath}` : entryPath);
  };

  const handleDelete = (entry: FileEntry) => {
    const entryPath = `${currentPath === '/' ? '' : currentPath}/${entry.name}`;
    const fp = selectedDomainId && !activeWebsiteId ? `/${selectedDomainId}${entryPath}` : entryPath;
    setDeleteConfirm({
      open: true,
      title: entry.isDirectory ? 'Delete Directory' : 'Delete File',
      message: `This will permanently delete '${entry.name}'${entry.isDirectory ? ' and all its contents' : ''}. This cannot be undone.`,
      onConfirm: () => deleteFile.mutate({ path: fp, domainId: activeDomainId, websiteId: activeWebsiteId }),
    });
  };

  const handleBulkDelete = () => {
    if (selectedItems.size === 0) return;
    setDeleteConfirm({
      open: true,
      title: 'Delete Multiple Items',
      message: `This will permanently delete ${selectedItems.size} item(s). This cannot be undone.`,
      onConfirm: () => {
        selectedItems.forEach(item => {
          const fp = selectedDomainId && !activeWebsiteId ? `/${selectedDomainId}${item}` : item;
          deleteFile.mutate({ path: fp, domainId: activeDomainId, websiteId: activeWebsiteId });
        });
        setSelectedItems(new Set());
      },
    });
  };

  const handleCopy = (entry: FileEntry) => {
    setClipboard({ items: [entry], operation: 'copy' });
  };

  const handleCut = (entry: FileEntry) => {
    setClipboard({ items: [entry], operation: 'cut' });
  };

  const handlePaste = () => {
    if (!clipboard) return;
    clipboard.items.forEach(item => {
      const sourcePath = `${currentPath === '/' ? '' : currentPath}/${item.name}`;
      const targetPath = currentPath;
      if (clipboard.operation === 'copy') {
        copyFile.mutate({ sourcePath, targetPath, domainId: activeDomainId, websiteId: activeWebsiteId });
      } else {
        moveFile.mutate({ sourcePath, targetPath, domainId: activeDomainId, websiteId: activeWebsiteId });
      }
    });
    setClipboard(null);
  };

  const handleDownloadFolder = (entry: FileEntry) => {
    const entryPath = `${currentPath === '/' ? '' : currentPath}/${entry.name}`;
    const ctxParam = activeWebsiteId ? `websiteId=${encodeURIComponent(activeWebsiteId)}` : activeDomainId ? `domainId=${encodeURIComponent(activeDomainId)}` : '';
    window.location.href = `/api/v1/files/download?path=${encodeURIComponent(entryPath)}${ctxParam ? `&${ctxParam}` : ''}`;
  };

  const handlePreview = (entry: FileEntry) => {
    const ext = entry.name.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
    const videoExts = ['mp4', 'webm', 'mkv', 'avi'];
    const pdfExts = ['pdf'];
    const archiveExts = ['zip', 'tar', 'gz', 'rar', '7z'];

    if (imageExts.includes(ext)) {
      setPreviewModal({ type: 'image', entry });
    } else if (videoExts.includes(ext)) {
      setPreviewModal({ type: 'video', entry });
    } else if (pdfExts.includes(ext)) {
      setPreviewModal({ type: 'pdf', entry });
    } else if (archiveExts.includes(ext)) {
      setPreviewModal({ type: 'archive', entry });
    }
  };

  const getFileUrl = (entry: FileEntry) => {
    const entryPath = `${currentPath === '/' ? '' : currentPath}/${entry.name}`;
    const ctxParam = activeWebsiteId ? `websiteId=${encodeURIComponent(activeWebsiteId)}` : activeDomainId ? `domainId=${encodeURIComponent(activeDomainId)}` : '';
    return `/api/v1/files/download?path=${encodeURIComponent(entryPath)}${ctxParam ? `&${ctxParam}` : ''}`;
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filtered.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filtered.map(item => `${currentPath === '/' ? '' : currentPath}/${item.name}`)));
    }
  };

  const toggleSelectItem = (item: FileEntry) => {
    const itemPath = `${currentPath === '/' ? '' : currentPath}/${item.name}`;
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemPath)) {
      newSelected.delete(itemPath);
    } else {
      newSelected.add(itemPath);
    }
    setSelectedItems(newSelected);
  };

  const toggleExpandNode = (path: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedNodes(newExpanded);
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  // Determine page header info
  const headerTitle = activeWebsiteId && website ? `File Manager — ${website.name}` : 'File Manager';
  const headerDescription = activeWebsiteId && website
    ? `Browsing files for website: ${website.name} (${website.documentRoot})`
    : 'Browse and manage server files';

  if (editingFile) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <FileEditorWrapper path={editingFile} domainId={activeDomainId} websiteId={activeWebsiteId} onBack={() => setEditingFile(null)} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={headerTitle} description={headerDescription} />

      {/* Context selector and toolbar */}
      <div className="mb-4 flex gap-3 flex-wrap">
        {activeWebsiteId ? (
          /* Website context badge — shown when websiteId is in URL */
          <div className="flex items-center gap-2 rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm">
            <Globe className="h-4 w-4 text-primary" />
            <span className="font-medium">{website?.name || 'Loading...'}</span>
            <span className="text-muted-foreground">({website?.documentRoot})</span>
          </div>
        ) : (
          /* Website selector + Domain selector (when no URL websiteId) */
          <div className="flex items-center gap-2">
            {/* Website selector dropdown */}
            <select
              value={selectedWebsiteId}
              onChange={(e) => {
                setSelectedWebsiteId(e.target.value);
                setSelectedDomainId(''); // Clear domain when website selected
                setCurrentPath('/');
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select website...</option>
              {websites?.map((w: any) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <span className="text-muted-foreground text-sm">or</span>
            {/* Domain selector dropdown */}
            <select
              value={selectedDomainId}
              onChange={(e) => {
                setSelectedDomainId(e.target.value);
                setSelectedWebsiteId(''); // Clear website when domain selected
                setCurrentPath('/');
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select domain...</option>
              {domains?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files..." className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm" />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="name">Sort by Name</option>
          <option value="size">Sort by Size</option>
          <option value="modified">Sort by Date</option>
          <option value="type">Sort by Type</option>
        </select>
        <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent flex items-center gap-1">
          <ArrowUpDown className="h-4 w-4" /> {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
        </button>
        <button onClick={() => setShowHidden(!showHidden)} className={`rounded-md border px-3 py-2 text-sm hover:bg-accent flex items-center gap-1 ${showHidden ? 'border-primary bg-primary/5' : 'border-border'}`}>
          {showHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {showHidden ? 'Hidden' : 'Show Hidden'}
        </button>
      </div>

      {/* Action buttons */}
      <div className="mb-4 flex gap-3 flex-wrap">
        <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
          <FolderPlus className="h-4 w-4" /> New Folder
        </button>
        <button onClick={() => setShowNewFile(true)} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
          <FilePlus className="h-4 w-4" /> New File
        </button>
        <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
          <Upload className="h-4 w-4" /> Upload
        </button>
        {clipboard && (
          <button onClick={handlePaste} className="flex items-center gap-2 rounded-md border border-primary bg-primary/5 px-4 py-2 text-sm hover:bg-primary/10 text-primary">
            <Copy className="h-4 w-4" /> Paste {clipboard.items.length} item(s)
          </button>
        )}
        {selectedItems.size > 0 && (
          <button onClick={handleBulkDelete} className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/5 px-4 py-2 text-sm hover:bg-destructive/10 text-destructive">
            <Trash2 className="h-4 w-4" /> Delete {selectedItems.size} item(s)
          </button>
        )}
      </div>

      {/* Main content area with tree and file list */}
      <div className="flex gap-4 h-[calc(100vh-20rem)]">
        {/* Left panel - Tree view */}
        <div className="w-64 flex-shrink-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
          <div className="border-b border-border px-4 py-2 bg-muted/50">
            <span className="text-sm font-medium">Directory Tree</span>
          </div>
          <FileTree 
            tree={tree} 
            currentPath={selectedDomainId && !activeWebsiteId ? `/${selectedDomainId}${currentPath}` : currentPath}
            onNavigate={(path) => {
              const relativePath = selectedDomainId && !activeWebsiteId ? path.replace(`/${selectedDomainId}`, '') : path;
              setCurrentPath(relativePath || '/');
            }}
            expandedNodes={expandedNodes}
            onToggleExpand={toggleExpandNode}
          />
        </div>

        {/* Right panel - File list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Breadcrumb */}
          <div className="mb-3 flex items-center gap-1 text-sm overflow-x-auto border-b border-border pb-2">
            <button onClick={() => navigateTo('/')} className="text-muted-foreground hover:text-foreground whitespace-nowrap">/</button>
            {pathParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1 whitespace-nowrap">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <button onClick={() => navigateTo('/' + pathParts.slice(0, i + 1).join('/'))} className={`${i === pathParts.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {part}
                </button>
              </span>
            ))}
            {selectedDomainId && !activeWebsiteId && <span className="text-muted-foreground ml-2">/ {selectedDomainId}</span>}
          </div>

          {/* File table */}
          {isLoading ? <LoadingSpinner /> : !filtered.length ? (
            <div className="rounded-lg border border-border p-12 text-center text-muted-foreground flex-1 flex items-center justify-center">
              {search ? 'No files match your search' : 'This folder is empty'}
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium w-10">
                      <button onClick={toggleSelectAll} className="rounded hover:bg-accent p-1">
                        {selectedItems.size === filtered.length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Size</th>
                    <th className="px-4 py-3 text-left font-medium">Modified</th>
                    <th className="px-4 py-3 text-left font-medium">Owner</th>
                    <th className="px-4 py-3 text-left font-medium">Permissions</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry: FileEntry, i: number) => (
                    <tr
                      key={i}
                      className={`border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer ${selectedItems.has(`${currentPath === '/' ? '' : currentPath}/${entry.name}`) ? 'bg-primary/10' : ''}`}
                      onContextMenu={(e) => handleContextMenu(e, entry)}
                      onClick={() => toggleSelectItem(entry)}
                    >
                      <td className="px-4 py-3">
                        <button onClick={(e) => { e.stopPropagation(); toggleSelectItem(entry); }} className="rounded hover:bg-accent p-1">
                          {selectedItems.has(`${currentPath === '/' ? '' : currentPath}/${entry.name}`) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {getIcon(entry)}
                          <span className="font-medium">{entry.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {entry.isDirectory ? <span className="text-blue-400">Folder</span> : formatSize(entry.size)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(entry.modifiedAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {entry.owner && entry.group ? (
                          <span className="text-muted-foreground" title={`UID: ${entry.uid}, GID: ${entry.gid}`}>
                            {entry.owner}:{entry.group}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{entry.permissions}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {entry.isDirectory ? (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); navigateTo(`${currentPath === '/' ? '' : currentPath}/${entry.name}`); }} className="rounded p-1.5 text-muted-foreground hover:bg-accent" title="Open">
                                <ChevronRight className="h-4 w-4" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDownloadFolder(entry); }} className="rounded p-1.5 text-muted-foreground hover:bg-accent" title="Download as Zip">
                                <Download className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(entry); }} className="rounded p-1.5 text-muted-foreground hover:bg-accent" title="Edit">
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals — pass context (websiteId or domainId) */}
      {showUpload && hasContext && (
        <UploadModal
          domainId={activeDomainId}
          websiteId={activeWebsiteId}
          currentPath={currentPath}
          onClose={() => setShowUpload(false)}
        />
      )}
      {showNewFolder && hasContext && (
        <NewFolderModal
          currentPath={currentPath}
          domainId={activeDomainId}
          websiteId={activeWebsiteId}
          onClose={() => setShowNewFolder(false)}
        />
      )}
      {showNewFile && hasContext && (
        <NewFileModal
          currentPath={currentPath}
          domainId={activeDomainId}
          websiteId={activeWebsiteId}
          onClose={() => setShowNewFile(false)}
        />
      )}
      {renameTarget && (
        <RenameModal
          path={renameTarget}
          domainId={activeDomainId}
          websiteId={activeWebsiteId}
          onClose={() => setRenameTarget(null)}
        />
      )}
      {permissionsTarget && (
        <PermissionsModal
          path={permissionsTarget.path}
          currentMode={permissionsTarget.mode}
          isDirectory={permissionsTarget.isDirectory}
          domainId={activeDomainId}
          websiteId={activeWebsiteId}
          onClose={() => setPermissionsTarget(null)}
        />
      )}
      {contextMenu && (
        <ContextMenu
          entry={contextMenu.entry}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onEdit={() => handleEdit(contextMenu.entry)}
          onRename={() => setRenameTarget(`${currentPath === '/' ? '' : currentPath}/${contextMenu.entry.name}`)}
          onPermissions={() => setPermissionsTarget({ path: `${currentPath === '/' ? '' : currentPath}/${contextMenu.entry.name}`, mode: contextMenu.entry.permissions, isDirectory: contextMenu.entry.isDirectory })}
          onDelete={() => handleDelete(contextMenu.entry)}
          onCopy={() => handleCopy(contextMenu.entry)}
          onCut={() => handleCut(contextMenu.entry)}
          onPreview={() => handlePreview(contextMenu.entry)}
        />
      )}
      
      {/* Preview Modals */}
      {previewModal && previewModal.type === 'image' && (
        <ImagePreviewModal
          isOpen={!!previewModal}
          onClose={() => setPreviewModal(null)}
          imageUrl={getFileUrl(previewModal.entry)}
          fileName={previewModal.entry.name}
          size={previewModal.entry.size}
        />
      )}
      {previewModal && previewModal.type === 'video' && (
        <VideoPreviewModal
          isOpen={!!previewModal}
          onClose={() => setPreviewModal(null)}
          videoUrl={getFileUrl(previewModal.entry)}
          fileName={previewModal.entry.name}
          size={previewModal.entry.size}
        />
      )}
      {previewModal && previewModal.type === 'pdf' && (
        <PDFPreviewModal
          isOpen={!!previewModal}
          onClose={() => setPreviewModal(null)}
          pdfUrl={getFileUrl(previewModal.entry)}
          fileName={previewModal.entry.name}
          size={previewModal.entry.size}
        />
      )}
      {previewModal && previewModal.type === 'archive' && (
        <ArchiveBrowserModal
          isOpen={!!previewModal}
          onClose={() => setPreviewModal(null)}
          archivePath={`${currentPath === '/' ? '' : currentPath}/${previewModal.entry.name}`}
          fileName={previewModal.entry.name}
          size={previewModal.entry.size}
        />
      )}
      <ConfirmDialog
        open={deleteConfirm.open}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        variant="danger"
        onConfirm={() => { deleteConfirm.onConfirm(); setDeleteConfirm(prev => ({ ...prev, open: false })); }}
        onCancel={() => setDeleteConfirm(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}
