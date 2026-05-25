import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { UploadZone } from '../../components/ui/UploadZone';
import {
  useDirectoryListing,
  useCreateDirectory,
  useDeleteFile,
  useRenameFile,
  useUploadFile,
  type FileEntry,
} from '../../api/hooks/files';
import { Icon } from '../../components/icons';
import { cn } from '../../lib/utils';
import { toast } from '../../lib/toast';
import { FileEditorModal } from './FileEditorModal';
import { PermissionsModal } from './PermissionsModal';

export function FilesPage() {
  const queryClient = useQueryClient();
  const [currentPath, setCurrentPath] = useState('/');
  const [showCreateDir, setShowCreateDir] = useState(false);
  const [newDirName, setNewDirName] = useState('');
  const [deletePath, setDeletePath] = useState<string | null>(null);
  const [renamePath, setRenamePath] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [editFilePath, setEditFilePath] = useState<string | null>(null);
  const [permissionsPath, setPermissionsPath] = useState<{ path: string; permissions: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: listing, isLoading } = useDirectoryListing(currentPath);
  const createDirectory = useCreateDirectory();
  const deleteFile = useDeleteFile();
  const renameFile = useRenameFile();
  const uploadFile = useUploadFile();

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const handleNavigateUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      setCurrentPath('/' + parts.join('/'));
    }
  };

  const handleCreateDirectory = async () => {
    try {
      await createDirectory.mutateAsync({
        path: currentPath,
        name: newDirName,
      });
      setShowCreateDir(false);
      setNewDirName('');
      queryClient.invalidateQueries({ queryKey: ['files'] });
      toast.success('Directory created');
    } catch (err: any) {
      toast.error(`Failed to create directory: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!deletePath) return;
    try {
      await deleteFile.mutateAsync({ path: deletePath });
      setDeletePath(null);
      queryClient.invalidateQueries({ queryKey: ['files'] });
      toast.success('File or folder deleted');
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
    }
  };

  const handleRename = async () => {
    if (!renamePath || !newName) return;
    try {
      await renameFile.mutateAsync({
        oldPath: renamePath,
        newPath: currentPath + '/' + newName,
      });
      setRenamePath(null);
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['files'] });
      toast.success('File renamed');
    } catch (err: any) {
      toast.error(`Failed to rename: ${err.message}`);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: '/', path: '/' }];
    let accumulated = '';
    for (const part of parts) {
      accumulated += '/' + part;
      breadcrumbs.push({ name: part, path: accumulated });
    }
    return breadcrumbs;
  };

  const openRenameModal = (item: FileEntry) => {
    setRenamePath(currentPath + '/' + item.name);
    setNewName(item.name);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">File Manager</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setShowUpload(true)}
            icon={<Icon name="icon-upload" size={16} />}
          >
            Upload
          </Button>
          <Button
            variant="default"
            onClick={() => setShowCreateDir(true)}
            icon={<Icon name="icon-folder" size={16} />}
          >
            New Folder
          </Button>
        </div>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="small"
              onClick={handleNavigateUp}
              disabled={currentPath === '/'}
              icon={<Icon name="icon-arrow-left" size={15} />}
            >
              Back
            </Button>
            <div className="flex items-center gap-1 flex-1 overflow-x-auto">
              {getBreadcrumbs().map((crumb, index) => (
                <span key={crumb.path} className="flex items-center">
                  {index > 0 && <span className="text-foreground-tertiary mx-1">/</span>}
                  <button
                    onClick={() => handleNavigate(crumb.path)}
                    className={cn(
                      'text-small hover:text-foreground-primary transition-colors',
                      crumb.path === currentPath
                        ? 'text-foreground-primary font-medium'
                        : 'text-foreground-secondary'
                    )}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-background-secondary rounded animate-pulse" />
              ))}
            </div>
          ) : listing?.items && listing.items.length > 0 ? (
            <div className="border border-border-tertiary rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-tertiary bg-background-secondary">
                    <th className="text-left px-4 py-2 text-section-label uppercase tracking-wide text-foreground-tertiary text-small">
                      Name
                    </th>
                    <th className="text-left px-4 py-2 text-section-label uppercase tracking-wide text-foreground-tertiary text-small w-[100px]">
                      Size
                    </th>
                    <th className="text-left px-4 py-2 text-section-label uppercase tracking-wide text-foreground-tertiary text-small w-[180px]">
                      Modified
                    </th>
                    <th className="text-left px-4 py-2 text-section-label uppercase tracking-wide text-foreground-tertiary text-small w-[100px]">
                      Permissions
                    </th>
                    <th className="text-right px-4 py-2 text-section-label uppercase tracking-wide text-foreground-tertiary text-small w-[100px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {listing.items.map((item) => (
                    <tr
                      key={item.name}
                      className="border-b border-border-tertiary last:border-0 hover:bg-background-secondary transition-colors"
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => item.isDirectory && handleNavigate(currentPath + '/' + item.name)}
                          className={cn(
                            'flex items-center gap-2 text-small',
                            item.isDirectory
                              ? 'text-foreground-primary hover:text-foreground-info cursor-pointer'
                              : 'text-foreground-secondary'
                          )}
                        >
                          <Icon
                            name={item.isDirectory ? 'icon-folder' : 'icon-file-text'}
                            size={16}
                            className={item.isDirectory ? 'text-foreground-info' : 'text-foreground-tertiary'}
                          />
                          <span className="font-mono">{item.name}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-small text-foreground-secondary">
                        {item.isDirectory ? '—' : formatSize(item.size)}
                      </td>
                      <td className="px-4 py-3 text-small text-foreground-secondary">
                        {formatDate(item.modifiedAt)}
                      </td>
                      <td className="px-4 py-3 text-small font-mono text-foreground-secondary">
                        {item.permissions}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {!item.isDirectory && (
                            <Button
                              variant="ghost"
                              size="small"
                              onClick={() => setEditFilePath(currentPath + '/' + item.name)}
                              icon={<Icon name="icon-edit" size={15} />}
                            >
                              Edit
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="small"
                            onClick={() => setPermissionsPath({ path: currentPath + '/' + item.name, permissions: item.permissions })}
                            icon={<Icon name="icon-lock" size={15} />}
                          >
                            Permissions
                          </Button>
                          <Button
                            variant="ghost"
                            size="small"
                            onClick={() => openRenameModal(item)}
                            icon={<Icon name="icon-edit" size={15} />}
                          >
                            Rename
                          </Button>
                          <Button
                            variant="ghost"
                            size="small"
                            onClick={() => setDeletePath(currentPath + '/' + item.name)}
                            icon={<Icon name="icon-trash" size={15} />}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="icon-folder"
              title="Empty directory"
              description="This folder is empty or does not exist"
              action={{ label: 'Create Folder', onClick: () => setShowCreateDir(true) }}
            />
          )}
        </div>
      </Card>

      <Modal
        isOpen={showCreateDir}
        onClose={() => setShowCreateDir(false)}
        title="Create Folder"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateDir(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateDirectory} loading={createDirectory.isPending}>
              Create
            </Button>
          </>
        }
      >
        <Input
          label="Folder Name"
          value={newDirName}
          onChange={(e) => setNewDirName(e.target.value)}
          placeholder="new-folder"
        />
      </Modal>

      <Modal
        isOpen={!!renamePath}
        onClose={() => setRenamePath(null)}
        title="Rename"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenamePath(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRename} loading={renameFile.isPending}>
              Rename
            </Button>
          </>
        }
      >
        <Input
          label="New Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="new-name"
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deletePath}
        onClose={() => setDeletePath(null)}
        onConfirm={handleDelete}
        title="Delete File or Folder"
        description="This action cannot be undone."
        confirmText="Delete"
        impact="high"
      />

      <Modal
        isOpen={showUpload}
        onClose={() => {
          setShowUpload(false);
          setUploadProgress(0);
        }}
        title="Upload File"
        size="medium"
      >
        <UploadZone
          onUpload={async (file) => {
            try {
              await uploadFile.mutateAsync({
                file,
                path: currentPath,
                onProgress: setUploadProgress,
              });
              toast.success(`Uploaded ${file.name}`);
              setShowUpload(false);
              setUploadProgress(0);
              queryClient.invalidateQueries({ queryKey: ['files'] });
            } catch (err: any) {
              toast.error(`Upload failed: ${err.message}`);
              setUploadProgress(0);
            }
          }}
          isUploading={uploadFile.isPending}
          uploadProgress={uploadProgress}
          disabled={uploadFile.isPending}
        />
      </Modal>

      <FileEditorModal
        isOpen={!!editFilePath}
        onClose={() => setEditFilePath(null)}
        filePath={editFilePath || ''}
        onSave={() => queryClient.invalidateQueries({ queryKey: ['files'] })}
      />

      <PermissionsModal
        isOpen={!!permissionsPath}
        onClose={() => setPermissionsPath(null)}
        filePath={permissionsPath?.path || ''}
        currentPermissions={permissionsPath?.permissions || '755'}
        onSave={() => queryClient.invalidateQueries({ queryKey: ['files'] })}
      />
    </div>
  );
}