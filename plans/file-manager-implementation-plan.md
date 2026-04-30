# File Manager Implementation Plan

**Based on:** plesk-features-and-flows.md gap analysis  
**Current Status:** ~40% implemented (basic CRUD, permissions, archive/extract)  
**Target Status:** 100% feature parity with plan

---

## Current Implementation Status

### ✅ Already Implemented:
- List directory contents
- Upload files (basic)
- Create directory
- Delete items (file/folder)
- Rename items
- Update permissions (chmod)
- Archive items (tar.gz)
- Extract archive (tar.gz)
- Get file content (for editing)
- Save file content
- Download file stream
- Domain selector
- Breadcrumb navigation
- Search filter
- File type icons
- Context menu (edit, rename, permissions, delete)

### 🔴 Missing Critical Features:
1. **Left panel tree view** - Currently only table view
2. **Create new file** - No UI option to create empty files
3. **Multi-select functionality** - No select all/deselect all
4. **Move/Copy operations** - No drag-drop or cut/paste
5. **File preview modals** - Image, video, PDF, archive preview
6. **Download folder as zip** - Archive backend exists but no UI
7. **Upload zip and auto-extract** - Backend exists but no UI option
8. **Ownership display** - Show user:group for files
9. **Sort functionality** - Sort by name, size, date
10. **Hidden files toggle** - Show/hide dotfiles
11. **Enhanced code editor** - Currently just textarea, needs syntax highlighting

---

## Implementation Phases

### Phase 1: UI Enhancements (Priority: HIGH)
**Estimated Time:** 2-3 days

#### 1.1 Left Panel Tree View
- **Backend Changes:**
  - Add tree structure endpoint in [`files.service.ts`](apps/api/src/modules/files/files.service.ts)
  - Implement `getDirectoryTree(homeDir, relativePath)` method
  - Return hierarchical structure with collapsed/expanded state
  
- **Frontend Changes in [`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx):**
  - Add left panel component (30% width)
  - Render tree structure with expand/collapse icons
  - Sync tree expansion state with current path
  - Highlight current path in tree

#### 1.2 Multi-Select Functionality
- **Backend:** No changes needed (batch operations already supported)
  
- **Frontend Changes:**
  - Add checkbox column to file table
  - Add "Select All" checkbox in header
  - Add bulk action toolbar (visible when items selected)
  - Bulk actions: Delete, Archive, Move, Copy
  - Implement selection state management

#### 1.3 Sort Functionality
- **Backend:**
  - Add `sort` parameter to [`listDirectory()`](apps/api/src/modules/files/files.service.ts:25)
  - Support: name, size, modified, type
  - Support direction: asc, desc
  
- **Frontend:**
  - Add sort dropdown in toolbar
  - Persist sort preference in localStorage
  - Apply sort to filtered items

#### 1.4 Hidden Files Toggle
- **Backend:**
  - Add `showHidden` parameter to [`listDirectory()`](apps/api/src/modules/files/files.service.ts:25)
  - Filter out entries starting with `.` when false
  
- **Frontend:**
  - Add toggle button in toolbar
  - Persist preference in localStorage
  - Show "Show hidden files" / "Hide hidden files"

### Phase 2: File Operations (Priority: HIGH)
**Estimated Time:** 2-3 days

#### 2.1 Move/Copy Operations
- **Backend Changes in [`files.service.ts`](apps/api/src/modules/files/files.service.ts):**
  - Add `copyItem(homeDir, sourcePath, targetPath)` method
  - Add `moveItem(homeDir, sourcePath, targetPath)` method
  - Validate paths (no traversal, target exists)
  - Use `cp` and `mv` commands via executor
  
- **Frontend Changes:**
  - Add clipboard state for cut/copy operations
  - Add "Paste" button in toolbar (enabled when clipboard has items)
  - Visual indicator for cut vs copy
  - Show "Paste here" indicator in folders on hover

#### 2.2 Download Folder as Zip
- **Backend:** Already implemented via [`archiveItems()`](apps/api/src/modules/files/files.service.ts:121)
  
- **Frontend Changes:**
  - Add "Download as Zip" button for directories
  - Show download progress for large folders
  - Use existing download endpoint with archive parameter

#### 2.3 Upload Zip and Auto-Extract
- **Backend:** Already implemented via [`extractArchive()`](apps/api/src/modules/files/files.service.ts:141)
  
- **Frontend Changes:**
  - Detect zip files in upload
  - Show "Extract after upload" checkbox
  - Auto-extract to current directory
  - Show extraction progress

### Phase 3: Preview Modals (Priority: MEDIUM)
**Estimated Time:** 2-3 days

#### 3.1 Image Preview Modal
- **Frontend Changes:**
  - Add preview modal component
  - Support formats: jpg, jpeg, png, gif, svg, webp
  - Show image at full resolution
  - Add zoom controls (+/-)
  - Show file info: dimensions, size, type
  - Download button in modal

#### 3.2 Video Preview Modal
- **Frontend Changes:**
  - Add video player modal
  - Support formats: mp4, webm, mkv, avi
  - HTML5 video player
  - Play/pause controls
  - Show file info: duration, size, resolution

#### 3.3 PDF Preview Modal
- **Frontend Changes:**
  - Add PDF viewer modal
  - Use PDF.js or browser PDF viewer
  - Page navigation
  - Zoom controls
  - Download button

#### 3.4 Archive Browser Modal
- **Frontend Changes:**
  - Add archive preview modal
  - List contents of zip/tar/gz archives
  - Extract individual files from archive
  - Extract all option

### Phase 4: Enhanced Code Editor (Priority: MEDIUM)
**Estimated Time:** 2-3 days

#### 4.1 Replace Textarea with CodeMirror
- **Frontend Changes:**
  - Install CodeMirror: `pnpm add @uiw/react-codemirror @codemirror/lang-*`
  - Replace textarea in [`FileEditor`](apps/web/src/pages/files/FilesPage.tsx:42) component
  - Add syntax highlighting for: php, js, ts, html, css, json, xml, yaml
  - Add line numbers
  - Add minimap
  - Add search/replace in editor
  - Add bracket matching
  - Add auto-indentation

### Phase 5: Additional Features (Priority: LOW)
**Estimated Time:** 1-2 days

#### 5.1 Ownership Display
- **Backend Changes in [`files.service.ts`](apps/api/src/modules/files/files.service.ts):**
  - Add `stat` call to get uid/gid
  - Resolve username/groupname from uid/gid
  - Include in file item response
  
- **Frontend Changes:**
  - Add "Owner" column to file table
  - Show "user:group" format
  - Add tooltip with numeric uid/gid

#### 5.2 Disk Usage per Folder
- **Backend Changes:**
  - Add `getDirectorySize(homeDir, relativePath)` method
  - Use `du -sh` command for accurate size
  - Cache results for performance
  
- **Frontend Changes:**
  - Show folder size in tree view
  - Show size in breadcrumb path
  - Add "Calculate size" button for large folders

---

## Backend API Changes Required

### New Endpoints in [`files.routes.ts`](apps/api/src/modules/files/files.routes.ts):

```typescript
// GET /files/tree - Get directory tree structure
fastify.get('/files/tree', async (req) => {
  const { path: relativePath = '/', domainId } = req.query as { path?: string; domainId?: string };
  const homeDir = domainId ? `/var/www/vhosts/${domainId}` : DEFAULT_HOME_DIR;
  return { success: true, data: await service.getDirectoryTree(homeDir, relativePath) };
});

// POST /files/copy - Copy file/folder
fastify.post('/files/copy', async (req) => {
  const { sourcePath, targetPath, domainId } = req.body as { sourcePath: string; targetPath: string; domainId?: string };
  const homeDir = domainId ? `/var/www/vhosts/${domainId}` : DEFAULT_HOME_DIR;
  return { success: true, data: await service.copyItem(homeDir, sourcePath, targetPath) };
});

// POST /files/move - Move file/folder
fastify.post('/files/move', async (req) => {
  const { sourcePath, targetPath, domainId } = req.body as { sourcePath: string; targetPath: string; domainId?: string };
  const homeDir = domainId ? `/var/www/vhosts/${domainId}` : DEFAULT_HOME_DIR;
  return { success: true, data: await service.moveItem(homeDir, sourcePath, targetPath) };
});

// GET /files/size - Get directory size
fastify.get('/files/size', async (req) => {
  const { path: relativePath, domainId } = req.query as { path?: string; domainId?: string };
  const homeDir = domainId ? `/var/www/vhosts/${domainId}` : DEFAULT_HOME_DIR;
  return { success: true, data: await service.getDirectorySize(homeDir, relativePath) };
});

// GET /files/owner - Get file ownership info
fastify.get('/files/owner', async (req) => {
  const { path: relativePath, domainId } = req.query as { path?: string; domainId?: string };
  const homeDir = domainId ? `/var/www/vhosts/${domainId}` : DEFAULT_HOME_DIR;
  return { success: true, data: await service.getFileOwnership(homeDir, relativePath) };
});
```

### Updated [`listDirectory()`](apps/api/src/modules/files/files.service.ts:25) signature:

```typescript
async listDirectory(
  homeDir: string, 
  relativePath: string = '/',
  options?: {
    showHidden?: boolean;
    sortBy?: 'name' | 'size' | 'modified' | 'type';
    sortOrder?: 'asc' | 'desc';
  }
): Promise<FileItem[]>
```

---

## Frontend Component Changes

### New Components to Create:

1. **`FileTree.tsx`** - Left panel tree view
2. **`FilePreviewModal.tsx`** - Image/video/PDF/archive preview
3. **`CodeEditor.tsx`** - Enhanced CodeMirror editor
4. **`BulkActionsToolbar.tsx`** - Multi-select actions
5. **`SortDropdown.tsx`** - Sort controls

### Modified Components:

1. **[`FilesPage.tsx`](apps/web/src/pages/files/FilesPage.tsx)** - Add new features
2. **[`FileEditor`](apps/web/src/pages/files/FilesPage.tsx:42)** - Replace with CodeMirror

---

## Testing Checklist

### Phase 1 Testing:
- [ ] Tree view expands/collapses correctly
- [ ] Tree syncs with current path
- [ ] Multi-select works with keyboard (Ctrl+A)
- [ ] Sort persists across navigation
- [ ] Hidden files toggle works correctly
- [ ] Search filters correctly with all options

### Phase 2 Testing:
- [ ] Copy operation preserves permissions
- [ ] Move operation updates all references
- [ ] Paste works in same and different directories
- [ ] Download folder creates valid zip
- [ ] Zip upload auto-extracts correctly
- [ ] Large file uploads show progress

### Phase 3 Testing:
- [ ] Image preview loads quickly
- [ ] Video preview plays smoothly
- [ ] PDF viewer renders correctly
- [ ] Archive browser lists contents
- [ ] Preview modals close on escape key

### Phase 4 Testing:
- [ ] Syntax highlighting works for all languages
- [ ] Line numbers sync with scroll
- [ ] Search/replace works correctly
- [ ] Auto-indentation works
- [ ] Large files don't freeze editor

### Phase 5 Testing:
- [ ] Ownership displays correctly
- [ ] Large folder sizes calculated accurately
- [ ] Size cache invalidates when files change

---

## Dependencies to Add

```json
{
  "dependencies": {
    "@codemirror/lang-php": "^6.0.1",
    "@codemirror/lang-javascript": "^6.0.1",
    "@codemirror/lang-htmlmixed": "^6.0.1",
    "@codemirror/lang-css": "^6.0.1",
    "@codemirror/lang-xml": "^6.0.1",
    "@codemirror/lang-yaml": "^6.0.1",
    "@codemirror/lang-json": "^6.0.1",
    "@uiw/react-codemirror": "^4.21.0",
    "react-pdf": "^7.7.0"
  }
}
```

---

## Implementation Order

1. **Week 1:**
   - Phase 1.1: Tree view
   - Phase 1.3: Sort functionality
   - Phase 1.4: Hidden files toggle
   - Backend API changes for tree, sort, hidden

2. **Week 2:**
   - Phase 1.2: Multi-select
   - Phase 2.1: Move/Copy operations
   - Phase 2.2: Download folder as zip
   - Phase 2.3: Upload zip auto-extract
   - Backend API changes for copy, move, size

3. **Week 3:**
   - Phase 3.1: Image preview
   - Phase 3.2: Video preview
   - Phase 3.3: PDF preview
   - Phase 3.4: Archive browser

4. **Week 4:**
   - Phase 4.1: CodeMirror integration
   - Phase 5.1: Ownership display
   - Phase 5.2: Disk usage per folder

5. **Week 5:**
   - Integration testing
   - Bug fixes
   - Documentation

---

**Total Estimated Time:** 4-5 weeks

**Next Steps:**
1. Start with Phase 1.1 (Tree view) - highest priority UI enhancement
2. Implement backend API changes first, then frontend
3. Test each phase before moving to next
4. Get user feedback on UI/UX improvements

---

*Plan created: 2026-04-27*
