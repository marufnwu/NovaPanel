import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useDomains } from '../../api/hooks/domains';
import { useWebsite, useWebsites } from '../../api/hooks/sites';
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
import { EmptyState } from '../../components/ui/EmptyState';
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
  Globe,
  RefreshCw,
  LayoutGrid,
  List,
  Info,
  Star,
  GripVertical,
  Type,
  Hash,
  Replace
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

interface RenamePreview {
  oldPath: string;
  newName: string;
}

function BatchRenameModal({ entries, currentPath, domainId, websiteId, onClose }: { 
  entries: FileEntry[]; 
  currentPath: string;
  domainId?: string; 
  websiteId?: string; 
  onClose: () => void;
}) {
  const rename = useRenameFile();
  const [mode, setMode] = useState<'find-replace' | 'prefix' | 'suffix' | 'number'>('find-replace');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [prefixText, setPrefixText] = useState('');
  const [suffixText, setSuffixText] = useState('');
  const [startNumber, setStartNumber] = useState(1);
  const [numberPadding, setNumberPadding] = useState(3);

  // Generate preview of renamed files
  const preview = useMemo<RenamePreview[]>(() => {
    return entries.map((entry, index) => {
      let newName = entry.name;
      
      switch (mode) {
        case 'find-replace':
          if (findText) {
            newName = entry.name.replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replaceText);
          }
          break;
        case 'prefix':
          newName = prefixText + entry.name;
          break;
        case 'suffix':
          const ext = entry.name.includes('.') ? '.' + entry.name.split('.').pop() : '';
          const nameWithoutExt = entry.name.includes('.') ? entry.name.slice(0, -ext.length) : entry.name;
          newName = nameWithoutExt + suffixText + ext;
          break;
        case 'number':
          const extNum = entry.name.includes('.') ? '.' + entry.name.split('.').pop() : '';
          const nameWithoutExtNum = entry.name.includes('.') ? entry.name.slice(0, -extNum.length) : entry.name;
          const numStr = String(startNumber + index).padStart(numberPadding, '0');
          newName = `${nameWithoutExtNum}_${numStr}${extNum}`;
          break;
      }
      
      return { oldPath: entry.name, newName };
    });
  }, [entries, mode, findText, replaceText, prefixText, suffixText, startNumber, numberPadding]);

  const handleRename = () => {
    preview.forEach(p => {
      if (p.oldPath !== p.newName) {
        const oldFullPath = `${currentPath === '/' ? '' : currentPath}/${p.oldPath}`;
        const newFullPath = `${currentPath === '/' ? '' : currentPath}/${p.newName}`;
        rename.mutate({ oldPath: oldFullPath, newPath: newFullPath, domainId, websiteId });
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg max-h-[80vh] flex flex-col">
        <h3 className="mb-4 text-lg font-semibold">Batch Rename ({entries.length} files)</h3>
        
        {/* Mode selector */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button 
            onClick={() => setMode('find-replace')} 
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${mode === 'find-replace' ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            <Replace className="h-4 w-4" /> Find & Replace
          </button>
          <button 
            onClick={() => setMode('prefix')} 
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${mode === 'prefix' ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            <Type className="h-4 w-4" /> Add Prefix
          </button>
          <button 
            onClick={() => setMode('suffix')} 
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${mode === 'suffix' ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            <Type className="h-4 w-4" /> Add Suffix
          </button>
          <button 
            onClick={() => setMode('number')} 
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${mode === 'number' ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            <Hash className="h-4 w-4" /> Sequential #
          </button>
        </div>

        {/* Mode-specific inputs */}
        <div className="mb-4 space-y-3">
          {mode === 'find-replace' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Find</label>
                <input 
                  value={findText} 
                  onChange={(e) => setFindText(e.target.value)} 
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                  placeholder="Text to find..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Replace with</label>
                <input 
                  value={replaceText} 
                  onChange={(e) => setReplaceText(e.target.value)} 
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                  placeholder="Replacement text..."
                />
              </div>
            </>
          )}
          {mode === 'prefix' && (
            <div>
              <label className="mb-1 block text-sm font-medium">Prefix</label>
              <input 
                value={prefixText} 
                onChange={(e) => setPrefixText(e.target.value)} 
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                placeholder="Text to add before filename..."
              />
            </div>
          )}
          {mode === 'suffix' && (
            <div>
              <label className="mb-1 block text-sm font-medium">Suffix</label>
              <input 
                value={suffixText} 
                onChange={(e) => setSuffixText(e.target.value)} 
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                placeholder="Text to add before extension..."
              />
            </div>
          )}
          {mode === 'number' && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">Start at</label>
                <input 
                  type="number"
                  min={0}
                  value={startNumber} 
                  onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)} 
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">Padding (digits)</label>
                <input 
                  type="number"
                  min={1}
                  max={10}
                  value={numberPadding} 
                  onChange={(e) => setNumberPadding(parseInt(e.target.value) || 1)} 
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                />
              </div>
            </div>
          )}
        </div>

        {/* Preview list */}
        <div className="flex-1 overflow-y-auto border rounded-md bg-muted/30 p-3 mb-4 max-h-64">
          <div className="text-xs font-medium text-muted-foreground mb-2">Preview:</div>
          {preview.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-sm py-1">
              <span className="line-through text-muted-foreground truncate flex-1">{p.oldPath}</span>
              <ArrowLeft className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="font-medium truncate flex-1">{p.newName}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button 
            onClick={handleRename} 
            disabled={rename.isPending || (mode === 'find-replace' && !findText)} 
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Rename {entries.length} Files
          </button>
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

function FileTree({ tree, currentPath, onNavigate, expandedNodes, onToggleExpand, favorites, onToggleFavorite, dropTarget, onDrop, onDragOver, onDragLeave }: {
  tree: DirectoryTreeNode | null | undefined;
  currentPath: string;
  onNavigate: (path: string) => void;
  expandedNodes: Set<string>;
  onToggleExpand: (path: string) => void;
  favorites?: Set<string>;
  onToggleFavorite?: (path: string) => void;
  dropTarget?: string | null;
  onDrop?: (path: string) => void;
  onDragOver?: (e: React.DragEvent, path: string) => void;
  onDragLeave?: () => void;
}) {
  if (!tree) return null;

  const renderNode = (node: DirectoryTreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.path);
    const isActive = currentPath === node.path || currentPath.startsWith(node.path + '/');
    const isFavorite = favorites?.has(node.path);
    const isDropping = dropTarget === node.path;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent transition-colors ${isActive ? 'bg-primary/10 text-primary' : ''} ${isDropping ? 'bg-primary/30 ring-2 ring-primary' : ''}`}
          style={{ paddingLeft: `${level * 12 + 12}px` }}
          draggable={node.isDirectory}
          onDragOver={(e) => node.isDirectory && onDragOver?.(e, node.path)}
          onDrop={(e) => { e.preventDefault(); node.isDirectory && onDrop?.(node.path); }}
          onDragLeave={onDragLeave}
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
          <span className="truncate flex-1">{node.name}</span>
          {node.isDirectory && onToggleFavorite && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(node.path); }}
              className="rounded p-0.5 hover:bg-accent"
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className={`h-3 w-3 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
            </button>
          )}
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

function GridView({ items, currentPath, onSelect, onOpen, onContextMenu, selectedItems, onDragStart, onToggleFavorite, favorites }: {
  items: FileEntry[];
  currentPath: string;
  onSelect: (entry: FileEntry) => void;
  onOpen: (entry: FileEntry, e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  selectedItems: Set<string>;
  onDragStart?: (entry: FileEntry, e: React.DragEvent) => void;
  onToggleFavorite?: (entry: FileEntry) => void;
  favorites?: Set<string>;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4 p-4">
      {items.map((entry) => {
        const entryPath = `${currentPath === '/' ? '' : currentPath}/${entry.name}`;
        const isSelected = selectedItems.has(entryPath);
        const isFavorite = favorites?.has(entryPath);
        return (
          <div
            key={entry.name}
            draggable
            onDragStart={(e) => onDragStart?.(entry, e)}
            onClick={() => onSelect(entry)}
            onDoubleClick={(e) => onOpen(entry, e)}
            onContextMenu={(e) => onContextMenu(e, entry)}
            className={`flex flex-col items-center p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors
              ${isSelected ? 'border-primary bg-primary/10' : 'border-border'}`}
          >
            <div className="relative">
              <div className="h-12 w-12 flex items-center justify-center">
                {getIcon(entry)}
              </div>
              {entry.isDirectory && onToggleFavorite && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry); }}
                  className="absolute -top-1 -right-1 rounded-full bg-card p-0.5 hover:bg-accent"
                  title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={`h-3 w-3 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                </button>
              )}
            </div>
            <span className="text-xs text-center mt-2 truncate w-full" title={entry.name}>
              {entry.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {entry.isDirectory ? 'Folder' : formatSize(entry.size)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DetailsPanel({ entry, currentPath, onClose }: { entry: FileEntry; currentPath: string; onClose: () => void }) {
  const entryPath = `${currentPath === '/' ? '' : currentPath}/${entry.name}`;
  const DetailRow = ({ label, value, mono, breakAll }: { label: string; value: string | number; mono?: boolean; breakAll?: boolean }) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono' : ''} ${breakAll ? 'break-all' : ''}`}>{value}</span>
    </div>
  );

  return (
    <div className="w-72 border-l border-border bg-card p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Details</h3>
        <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-4 text-sm">
        <DetailRow label="Name" value={entry.name} />
        <DetailRow label="Type" value={entry.isDirectory ? 'Folder' : (entry.type || 'Unknown')} />
        <DetailRow label="Size" value={entry.isDirectory ? '-' : formatSize(entry.size)} />
        <DetailRow label="Modified" value={new Date(entry.modifiedAt).toLocaleString()} />
        <DetailRow label="Permissions" value={entry.permissions} mono />
        <DetailRow label="Owner" value={entry.owner && entry.group ? `${entry.owner}:${entry.group}` : '-'} />
        <DetailRow label="Path" value={entryPath} mono breakAll />
      </div>
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['/']));
  const [clipboard, setClipboard] = useState<{ items: FileEntry[]; operation: 'copy' | 'cut' } | null>(null);
  const [previewModal, setPreviewModal] = useState<{ type: 'image' | 'video' | 'pdf' | 'archive'; entry: FileEntry } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => (localStorage.getItem('files_viewMode') as 'list' | 'grid') || 'list');
  const [pathInput, setPathInput] = useState(currentPath);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);

  // Phase 3: Drag-and-drop state
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Phase 3: Batch rename modal
  const [batchRenameOpen, setBatchRenameOpen] = useState(false);

  // Phase 3: Favorites state
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const activeWebsiteId = urlWebsiteId || selectedWebsiteId || undefined;
  const activeDomainId = activeWebsiteId ? undefined : (selectedDomainId || undefined);
  const hasContext = !!(activeWebsiteId || activeDomainId);

  const { data: website } = useWebsite(activeWebsiteId || '');

  // Load preferences from localStorage
  useEffect(() => {
    const savedShowHidden = localStorage.getItem('files_showHidden');
    const savedSortBy = localStorage.getItem('files_sortBy');
    const savedSortOrder = localStorage.getItem('files_sortOrder');
    const savedFavorites = localStorage.getItem('files_favorites');
    if (savedShowHidden) setShowHidden(savedShowHidden === 'true');
    if (savedSortBy) setSortBy(savedSortBy as any);
    if (savedSortOrder) setSortOrder(savedSortOrder as any);
    if (savedFavorites) {
      try {
        setFavorites(new Set(JSON.parse(savedFavorites)));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('files_showHidden', String(showHidden));
    localStorage.setItem('files_sortBy', sortBy);
    localStorage.setItem('files_sortOrder', sortOrder);
  }, [showHidden, sortBy, sortOrder]);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('files_favorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  // Save viewMode to localStorage
  useEffect(() => {
    localStorage.setItem('files_viewMode', viewMode);
  }, [viewMode]);

  // Sync pathInput when currentPath changes
  useEffect(() => {
    setPathInput(currentPath);
  }, [currentPath]);

  const { data: listing, isLoading, refetch } = useDirectoryListing(
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

  // Available file types for filtering
  const availableTypes = useMemo(() => {
    const types = new Set(items
      .filter(item => !item.isDirectory)
      .map(item => item.name.split('.').pop()?.toLowerCase())
      .filter(Boolean) as string[]
    );
    return ['', ...Array.from(types).sort()];
  }, [items]);

  // Filtered items with debounced search and type filter
  const filtered = useMemo(() => {
    let result = items;
    if (debouncedSearch) {
      result = result.filter((item: FileEntry) => item.name.toLowerCase().includes(debouncedSearch.toLowerCase()));
    }
    if (typeFilter) {
      result = result.filter((item: FileEntry) => item.name.toLowerCase().endsWith('.' + typeFilter));
    }
    return result;
  }, [items, debouncedSearch, typeFilter]);

  // Handle search with debounce (300ms)
  const handleSearchChange = (value: string) => {
    setSearch(value);
    const timeoutId = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(timeoutId);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input field (except for Escape to clear selection)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key !== 'Escape') return;
      }

      // Skip if typing in search input (except Escape, Ctrl+F)
      if (e.target === searchInputRef.current) {
        if (e.key === 'Escape') {
          e.preventDefault();
          clearSelection();
          searchInputRef.current?.blur();
          return;
        }
        if (e.key === 'F2' || e.key === 'Delete' || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'r' || e.key === 'R') {
          // Allow these shortcuts even in search
        } else {
          return;
        }
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'c':
            e.preventDefault();
            handleCopySelected();
            break;
          case 'v':
            e.preventDefault();
            handlePaste();
            break;
          case 'x':
            e.preventDefault();
            handleCutSelected();
            break;
          case 'a':
            e.preventDefault();
            if (selectedItems.size !== filtered.length) {
              setSelectedItems(new Set(filtered.map(item => `${currentPath === '/' ? '' : currentPath}/${item.name}`)));
            } else {
              setSelectedItems(new Set());
            }
            break;
          case 'f':
            e.preventDefault();
            searchInputRef.current?.focus();
            break;
        }
        return;
      }

      switch (e.key) {
        case 'Delete':
          e.preventDefault();
          handleBulkDelete();
          break;
        case 'F2':
          e.preventDefault();
          startRename();
          break;
        case 'Enter':
          e.preventDefault();
          openSelected();
          break;
        case 'Backspace':
          e.preventDefault();
          navigateUp();
          break;
        case 'Escape':
          e.preventDefault();
          clearSelection();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          refetch();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems, clipboard, filtered, currentPath, items, refetch]);

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSearch('');
    setDebouncedSearch('');
    setTypeFilter('');
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
    // Set selected entry for details panel
    if (!newSelected.has(itemPath)) {
      setSelectedEntry(null);
    } else if (newSelected.size === 1) {
      setSelectedEntry(item);
    } else {
      setSelectedEntry(null);
    }
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

  // Double-click handler to open folders or edit files
  const handleDoubleClick = (entry: FileEntry, e: React.MouseEvent) => {
    e.preventDefault();
    if (entry.isDirectory) {
      navigateTo(`${currentPath === '/' ? '' : currentPath}/${entry.name}`);
    } else {
      handleEdit(entry);
    }
  };

  // Keyboard shortcuts helpers
  const handleCopySelected = () => {
    if (selectedItems.size === 0) return;
    const itemsToCopy = items.filter(item => selectedItems.has(`${currentPath === '/' ? '' : currentPath}/${item.name}`));
    if (itemsToCopy.length > 0) {
      setClipboard({ items: itemsToCopy, operation: 'copy' });
    }
  };

  const handleCutSelected = () => {
    if (selectedItems.size === 0) return;
    const itemsToCut = items.filter(item => selectedItems.has(`${currentPath === '/' ? '' : currentPath}/${item.name}`));
    if (itemsToCut.length > 0) {
      setClipboard({ items: itemsToCut, operation: 'cut' });
    }
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const startRename = () => {
    if (selectedItems.size !== 1) return;
    const itemName = Array.from(selectedItems)[0];
    setRenameTarget(itemName);
  };

  const openSelected = () => {
    if (selectedItems.size !== 1) return;
    const itemPath = Array.from(selectedItems)[0];
    const itemName = itemPath.split('/').pop() || '';
    const item = items.find(i => i.name === itemName);
    if (item) {
      if (item.isDirectory) {
        navigateTo(itemPath);
      } else {
        handleEdit(item);
      }
    }
  };

  const navigateUp = () => {
    const pathParts = currentPath.split('/').filter(Boolean);
    if (pathParts.length === 0) return;
    const parentPath = '/' + pathParts.slice(0, -1).join('/');
    navigateTo(parentPath || '/');
  };

  // Phase 3: Drag-and-drop handlers
  const handleDragStart = (entry: FileEntry, e: React.DragEvent) => {
    const entryPath = `${currentPath === '/' ? '' : currentPath}/${entry.name}`;
    setDragSource(entryPath);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', entryPath);
  };

  const handleDragOver = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragSource && dragSource !== path) {
      setDropTarget(path);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (targetPath: string) => {
    if (dragSource && dragSource !== targetPath) {
      // Determine full paths based on context
      const sourceFullPath = selectedDomainId && !activeWebsiteId ? `/${selectedDomainId}${dragSource}` : dragSource;
      const targetFullPath = selectedDomainId && !activeWebsiteId ? `/${selectedDomainId}${targetPath}` : targetPath;
      
      moveFile.mutate({ 
        sourcePath: sourceFullPath, 
        targetPath: targetFullPath, 
        domainId: activeDomainId, 
        websiteId: activeWebsiteId 
      });
    }
    setDragSource(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDragSource(null);
    setDropTarget(null);
  };

  // Phase 3: Favorites handlers
  const toggleFavorite = (path: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(path)) {
      newFavorites.delete(path);
    } else {
      newFavorites.add(path);
    }
    setFavorites(newFavorites);
  };

  const toggleEntryFavorite = (entry: FileEntry) => {
    const entryPath = `${currentPath === '/' ? '' : currentPath}/${entry.name}`;
    toggleFavorite(entryPath);
  };

  // Phase 3: Batch rename handler
  const handleBatchRename = () => {
    if (selectedItems.size === 0) return;
    setBatchRenameOpen(true);
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  // Determine page header info
  const headerTitle = activeWebsiteId && website ? `File Manager — ${website.name}` : 'File Manager';
  const headerDescription = activeWebsiteId && website
    ? `Browsing files for site: ${website.name} (${website.homeDir})`
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
            <span className="text-muted-foreground">({website?.homeDir})</span>
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
          <input ref={searchInputRef} value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search files... (Ctrl+F)" className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm" />
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
        {/* File type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          {availableTypes.filter(Boolean).map((ext) => (
            <option key={ext} value={ext as string}>.{ext}</option>
          ))}
        </select>
        {/* Refresh button */}
        <button
          onClick={() => refetch()}
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent flex items-center gap-1"
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
        {/* View mode toggle */}
        <button
          onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent flex items-center gap-1"
          title={viewMode === 'list' ? 'Switch to Grid View' : 'Switch to List View'}
        >
          {viewMode === 'list' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
          {viewMode === 'list' ? 'Grid' : 'List'}
        </button>
        {/* Details panel toggle */}
        <button
          onClick={() => setShowDetails(v => !v)}
          className={`rounded-md border px-3 py-2 text-sm hover:bg-accent flex items-center gap-1 ${showDetails ? 'border-primary bg-primary/5' : 'border-border'}`}
          title={showDetails ? 'Hide Details' : 'Show Details'}
        >
          <Info className="h-4 w-4" />
          Details
        </button>
      </div>

      {/* Action buttons - only show when context is selected */}
      {hasContext && (
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
          <>
            <button onClick={handleBulkDelete} className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/5 px-4 py-2 text-sm hover:bg-destructive/10 text-destructive">
              <Trash2 className="h-4 w-4" /> Delete {selectedItems.size} item(s)
            </button>
            {selectedItems.size > 1 && (
              <button onClick={handleBatchRename} className="flex items-center gap-2 rounded-md border border-primary bg-primary/5 px-4 py-2 text-sm hover:bg-primary/10 text-primary">
                <Edit2 className="h-4 w-4" /> Batch Rename
              </button>
            )}
          </>
        )}
      </div>
      )}

      {/* No context selected - show integrated welcome panel */}
      {!hasContext && (
        <div className="rounded-lg border border-border bg-card p-8">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Folder className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">File Manager</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Select a website or domain above to browse and manage server files
            </p>
            <div className="flex justify-center gap-3">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>Choose from websites or domains</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content area with tree and file list - only show when context is selected */}
      {hasContext && (
      <div className="flex gap-4 h-[calc(100vh-20rem)]">
        {/* Left panel - Tree view */}
        <div className="w-64 flex-shrink-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
          <div className="border-b border-border px-4 py-2 bg-muted/50 flex items-center justify-between">
            <span className="text-sm font-medium">Directory Tree</span>
            {favorites.size > 0 && (
              <span className="text-xs text-muted-foreground">{favorites.size} favorite{favorites.size !== 1 ? 's' : ''}</span>
            )}
          </div>
          {/* Favorites quick access section */}
          {favorites.size > 0 && (
            <div className="border-b border-border px-3 py-2 bg-muted/30">
              <div className="text-xs font-medium text-muted-foreground mb-1">Favorites</div>
              <div className="flex flex-wrap gap-1">
                {Array.from(favorites).slice(0, 5).map(fav => (
                  <button
                    key={fav}
                    onClick={() => {
                      const relativePath = selectedDomainId && !activeWebsiteId ? fav.replace(`/${selectedDomainId}`, '') : fav;
                      navigateTo(relativePath || '/');
                    }}
                    className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20"
                  >
                    <Star className="h-3 w-3 fill-primary text-primary" />
                    <span className="truncate max-w-[80px]">{fav.split('/').pop() || fav}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <FileTree 
            tree={tree} 
            currentPath={selectedDomainId && !activeWebsiteId ? `/${selectedDomainId}${currentPath}` : currentPath}
            onNavigate={(path) => {
              const relativePath = selectedDomainId && !activeWebsiteId ? path.replace(`/${selectedDomainId}`, '') : path;
              setCurrentPath(relativePath || '/');
            }}
            expandedNodes={expandedNodes}
            onToggleExpand={toggleExpandNode}
            favorites={new Set(Array.from(favorites).map(f => {
              // Convert favorites to the full path format used in tree
              return selectedDomainId && !activeWebsiteId ? `/${selectedDomainId}${f}` : f;
            }))}
            onToggleFavorite={toggleFavorite}
            dropTarget={dropTarget}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          />
        </div>

        {/* Right panel - File list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editable Path Bar */}
          <div className="mb-3 flex items-center gap-1 text-sm overflow-x-auto border-b border-border pb-2">
            <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onBlur={() => {
                // Validate and navigate on blur
                const newPath = pathInput.startsWith('/') ? pathInput : '/' + pathInput;
                navigateTo(newPath);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const newPath = pathInput.startsWith('/') ? pathInput : '/' + pathInput;
                  navigateTo(newPath);
                }
              }}
              className="flex-1 bg-transparent text-sm font-mono outline-none min-w-0"
              aria-label="Current path"
            />
          </div>

          {/* File table or grid view */}
          {isLoading ? <LoadingSpinner /> : !filtered.length ? (
            <div className="rounded-lg border border-border p-12 text-center text-muted-foreground flex-1 flex items-center justify-center">
              {search ? 'No files match your search' : 'This folder is empty'}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="rounded-lg border border-border overflow-hidden flex-1 overflow-auto">
              <GridView
                items={filtered}
                currentPath={currentPath}
                onSelect={(entry) => {
                  toggleSelectItem(entry);
                  if (selectedItems.size === 0 || selectedItems.size === 1) {
                    setSelectedEntry(entry);
                  }
                }}
                onOpen={handleDoubleClick}
                onContextMenu={handleContextMenu}
                selectedItems={selectedItems}
                onDragStart={handleDragStart}
                onToggleFavorite={toggleEntryFavorite}
                favorites={favorites}
              />
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
                      draggable
                      onDragStart={(e) => handleDragStart(entry, e)}
                      onDragEnd={handleDragEnd}
                      className={`border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer ${selectedItems.has(`${currentPath === '/' ? '' : currentPath}/${entry.name}`) ? 'bg-primary/10' : ''}`}
                      onContextMenu={(e) => handleContextMenu(e, entry)}
                      onClick={() => toggleSelectItem(entry)}
                      onDoubleClick={(e) => handleDoubleClick(entry, e)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); toggleSelectItem(entry); }} className="rounded hover:bg-accent p-1">
                            {selectedItems.has(`${currentPath === '/' ? '' : currentPath}/${entry.name}`) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                          </button>
                          <GripVertical className="h-3 w-3 text-muted-foreground" />
                        </div>
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
                          {entry.isDirectory && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleEntryFavorite(entry); }}
                              className="rounded p-1.5 text-muted-foreground hover:bg-accent"
                              title={favorites.has(`${currentPath === '/' ? '' : currentPath}/${entry.name}`) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              <Star className={`h-4 w-4 ${favorites.has(`${currentPath === '/' ? '' : currentPath}/${entry.name}`) ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                            </button>
                          )}
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

        {/* Details Panel */}
        {showDetails && selectedEntry && (
          <DetailsPanel entry={selectedEntry} currentPath={currentPath} onClose={() => setShowDetails(false)} />
        )}
      </div>
      )}

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
      {batchRenameOpen && (
        <BatchRenameModal
          entries={items.filter(item => selectedItems.has(`${currentPath === '/' ? '' : currentPath}/${item.name}`))}
          currentPath={currentPath}
          domainId={activeDomainId}
          websiteId={activeWebsiteId}
          onClose={() => { setBatchRenameOpen(false); }}
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
