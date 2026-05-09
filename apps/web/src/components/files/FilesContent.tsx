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
  useDirectoryTree,
  useCopyFile,
  useMoveFile,
} from '../../api/hooks/files';
import type { FileEntry, DirectoryTreeNode } from '../../api/hooks/files';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ImagePreviewModal, VideoPreviewModal, PDFPreviewModal, ArchiveBrowserModal } from './FilePreviewModal';
import { CodeEditor } from './CodeEditor';
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
  ArrowLeft, 
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

export interface FilesContentProps {
  initialPath?: string; // default: '/' - set to site.documentRoot for site context
}

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

// Note: This is a simplified embeddable version of the FilesPage.
// For full functionality, use the complete FilesPage component.

export function FilesContent({ initialPath = '/' }: FilesContentProps) {
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
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [permissionsTarget, setPermissionsTarget] = useState<{ path: string; mode: string; isDirectory: boolean } | null>(null);
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [pathInput, setPathInput] = useState(currentPath);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);

  // Drag-and-drop state
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Batch rename modal
  const [batchRenameOpen, setBatchRenameOpen] = useState(false);

  // Favorites state
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

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSearch('');
    setDebouncedSearch('');
    setTypeFilter('');
    setSelectedItems(new Set());
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

  const handleDoubleClick = (entry: FileEntry, e: React.MouseEvent) => {
    e.preventDefault();
    if (entry.isDirectory) {
      navigateTo(`${currentPath === '/' ? '' : currentPath}/${entry.name}`);
    } else {
      handleEdit(entry);
    }
  };

  const handleEdit = (entry: FileEntry) => {
    const entryPath = `${currentPath === '/' ? '' : currentPath}/${entry.name}`;
    setEditingFile(selectedDomainId && !activeWebsiteId ? `/${selectedDomainId}${entryPath}` : entryPath);
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

  const handleBatchRename = () => {
    if (selectedItems.size === 0) return;
    setBatchRenameOpen(true);
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
          <button onClick={() => {
            selectedItems.forEach(item => {
              const fp = selectedDomainId && !activeWebsiteId ? `/${selectedDomainId}${item}` : item;
              deleteFile.mutate({ path: fp, domainId: activeDomainId, websiteId: activeWebsiteId });
            });
            setSelectedItems(new Set());
          }} className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/5 px-4 py-2 text-sm hover:bg-destructive/10 text-destructive">
            <Trash2 className="h-4 w-4" /> Delete {selectedItems.size} item(s)
          </button>
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
          </div>
        </div>
      )}

      {/* Main content area - only show when context is selected */}
      {hasContext && (
      <div className="rounded-lg border border-border overflow-hidden">
        {isLoading ? <LoadingSpinner /> : !filtered.length ? (
          <div className="p-12 text-center text-muted-foreground">
            {search ? 'No files match your search' : 'This folder is empty'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-10">
                  <button onClick={toggleSelectAll} className="rounded hover:bg-accent p-1">
                    {selectedItems.size === filtered.length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Size</th>
                <th className="px-4 py-3 text-left font-medium">Modified</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry: FileEntry, i: number) => (
                <tr
                  key={i}
                  draggable
                  onDragStart={(e) => handleDragStart(entry, e)}
                  onDragEnd={() => { setDragSource(null); setDropTarget(null); }}
                  className={`border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer ${selectedItems.has(`${currentPath === '/' ? '' : currentPath}/${entry.name}`) ? 'bg-primary/10' : ''}`}
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
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {entry.isDirectory && (
                        <button onClick={(e) => { e.stopPropagation(); toggleEntryFavorite(entry); }} className="rounded p-1.5 text-muted-foreground hover:bg-accent">
                          <Star className={`h-4 w-4 ${favorites.has(`${currentPath === '/' ? '' : currentPath}/${entry.name}`) ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                        </button>
                      )}
                      {!entry.isDirectory && (
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(entry); }} className="rounded p-1.5 text-muted-foreground hover:bg-accent" title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handlePreview(entry); }} className="rounded p-1.5 text-muted-foreground hover:bg-accent" title="Preview">
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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

// --- Helper Components ---

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
