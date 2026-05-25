import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useFileContent, useSaveFileContent } from '../../api/hooks/files';
import { toast } from '../../lib/toast';

interface FileEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  onSave?: () => void;
}

const BINARY_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv',
  '.exe', '.dll', '.so', '.dylib',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.db', '.sqlite', '.sql',
];

function isBinaryFile(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return BINARY_EXTENSIONS.some(binExt => ext === binExt || filename.endsWith(ext));
}

export function FileEditorModal({ isOpen, onClose, filePath, onSave }: FileEditorModalProps) {
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const fileName = filePath.split('/').pop() || filePath;

  const { data, isLoading, error } = useFileContent(filePath);
  const saveFile = useSaveFileContent();

  useEffect(() => {
    if (data?.content !== undefined) {
      setContent(data.content);
      setIsDirty(false);
    }
  }, [data]);

  useEffect(() => {
    if (!isOpen) {
      setContent('');
      setIsDirty(false);
    }
  }, [isOpen]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      await saveFile.mutateAsync({
        path: filePath,
        content,
      });
      setIsDirty(false);
      toast.success('File saved successfully');
      onSave?.();
      onClose();
    } catch (err: any) {
      toast.error(`Failed to save file: ${err.message}`);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const isBinary = isBinaryFile(fileName);
  const canEdit = !isBinary;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Edit: ${fileName}`}
      size="large"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          {canEdit && (
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saveFile.isPending}
              disabled={!isDirty}
            >
              Save
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* File path display */}
        <div className="text-meta text-foreground-secondary bg-background-secondary px-3 py-2 rounded-md font-mono truncate">
          {filePath}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-foreground-info border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-foreground-danger">
            <span>Failed to load file</span>
            <span className="text-meta">{error.message}</span>
          </div>
        ) : isBinary ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-foreground-secondary">
            <span className="text-large">Cannot preview binary file</span>
            <span className="text-meta">Binary files cannot be edited in the browser</span>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={handleContentChange}
            className="w-full h-96 p-3 font-mono text-small bg-background-primary border border-border-tertiary rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-foreground-info/50 focus:border-foreground-info"
            placeholder="File content..."
            spellCheck={false}
          />
        )}

        {isDirty && canEdit && (
          <div className="text-meta text-foreground-info">
            Unsaved changes
          </div>
        )}
      </div>
    </Modal>
  );
}