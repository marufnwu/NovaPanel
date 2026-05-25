import { useCallback, useState } from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '../icons';

interface UploadZoneProps {
  onUpload: (file: File) => void;
  isUploading?: boolean;
  uploadProgress?: number;
  accept?: string;
  disabled?: boolean;
  className?: string;
}

export function UploadZone({
  onUpload,
  isUploading = false,
  uploadProgress = 0,
  accept,
  disabled = false,
  className,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
      setDragError(null);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragError(null);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onUpload(files[0]);
    }
  }, [disabled, onUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  }, [onUpload]);

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-lg p-6 transition-colors',
        isDragging
          ? 'border-foreground-info bg-foreground-info/5'
          : 'border-border-tertiary hover:border-foreground-secondary',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />

      <div className="flex flex-col items-center gap-3 text-center pointer-events-none">
        {isUploading ? (
          <>
            <div className="w-12 h-12 rounded-full border-4 border-foreground-info border-t-transparent animate-spin" />
            <div className="space-y-1">
              <p className="text-small font-medium text-foreground-primary">Uploading...</p>
              <p className="text-meta text-foreground-secondary">{uploadProgress}% complete</p>
            </div>
            <div className="w-full max-w-[200px] h-1.5 bg-background-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground-info transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <Icon
              name="icon-upload"
              size={32}
              className="text-foreground-secondary"
            />
            <div className="space-y-1">
              <p className="text-small font-medium text-foreground-primary">
                {isDragging ? 'Drop file here' : 'Drag and drop a file or click to browse'}
              </p>
              <p className="text-meta text-foreground-tertiary">
                {accept ? `Accepted: ${accept}` : 'Any file type allowed'}
              </p>
            </div>
          </>
        )}
      </div>

      {dragError && (
        <p className="mt-2 text-meta text-foreground-danger text-center">{dragError}</p>
      )}
    </div>
  );
}