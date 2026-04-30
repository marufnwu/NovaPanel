import { X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight, FileText, Play, Pause } from 'lucide-react';
import { useState } from 'react';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  fileName: string;
  size: number;
  dimensions?: { width: number; height: number };
}

export function ImagePreviewModal({ isOpen, onClose, imageUrl, fileName, size, dimensions }: ImagePreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  
  if (!isOpen) return null;

  const formatSize = (bytes: number) => {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="relative max-w-5xl max-h-[90vh] w-full p-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
          <X className="h-6 w-6" />
        </button>
        
        <div className="flex items-center justify-center bg-black/5 rounded-lg overflow-hidden" style={{ height: '80vh' }}>
          <img
            src={imageUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain"
            style={{ transform: `scale(${zoom})` }}
          />
        </div>
        
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/70 rounded-full px-6 py-3 text-white">
          <button onClick={() => setZoom(Math.max(0.25, zoom - 0.25))} className="hover:bg-white/10 rounded-full p-2">
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="text-sm font-mono w-16 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(5, zoom + 0.25))} className="hover:bg-white/10 rounded-full p-2">
            <ZoomIn className="h-5 w-5" />
          </button>
          <div className="w-px h-6 bg-white/30" />
          <span className="text-sm">{fileName}</span>
          <div className="w-px h-6 bg-white/30" />
          <span className="text-sm">{dimensions && `${dimensions.width}x${dimensions.height}`}</span>
          <span className="text-sm">{formatSize(size)}</span>
        </div>
      </div>
    </div>
  );
}

interface VideoPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  fileName: string;
  size: number;
  duration?: number;
  resolution?: { width: number; height: number };
}

export function VideoPreviewModal({ isOpen, onClose, videoUrl, fileName, size, duration, resolution }: VideoPreviewModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationState, setDurationState] = useState(duration || 0);
  
  if (!isOpen) return null;

  const formatSize = (bytes: number) => {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="relative max-w-5xl max-h-[90vh] w-full p-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
          <X className="h-6 w-6" />
        </button>
        
        <div className="flex items-center justify-center bg-black/5 rounded-lg overflow-hidden">
          <video
            src={videoUrl}
            className="max-w-full max-h-[80vh]"
            controls
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDurationState(e.currentTarget.duration)}
          />
        </div>
        
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/70 rounded-full px-6 py-3 text-white">
          <span className="text-sm">{fileName}</span>
          <div className="w-px h-6 bg-white/30" />
          <span className="text-sm">{resolution && `${resolution.width}x${resolution.height}`}</span>
          <span className="text-sm">{formatSize(size)}</span>
          <div className="w-px h-6 bg-white/30" />
          <span className="text-sm font-mono">{formatTime(currentTime)} / {formatTime(durationState)}</span>
        </div>
      </div>
    </div>
  );
}

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  fileName: string;
  size: number;
  pageCount?: number;
}

export function PDFPreviewModal({ isOpen, onClose, pdfUrl, fileName, size, pageCount }: PDFPreviewModalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  
  if (!isOpen) return null;

  const formatSize = (bytes: number) => {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="relative max-w-5xl max-h-[90vh] w-full p-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
          <X className="h-6 w-6" />
        </button>
        
        <div className="flex items-center justify-center bg-white rounded-lg overflow-hidden" style={{ height: '80vh' }}>
          <iframe
            src={pdfUrl}
            className="w-full h-full"
            title={fileName}
          />
        </div>
        
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/70 rounded-full px-6 py-3 text-white">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="hover:bg-white/10 rounded-full p-2 disabled:opacity-50"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-mono w-20 text-center">
            Page {currentPage} {pageCount && `/ ${pageCount}`}
          </span>
          <button
            onClick={() => setCurrentPage(pageCount ? Math.min(pageCount, currentPage + 1) : currentPage + 1)}
            disabled={!!pageCount && currentPage >= pageCount}
            className="hover:bg-white/10 rounded-full p-2 disabled:opacity-50"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="w-px h-6 bg-white/30" />
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="hover:bg-white/10 rounded-full p-2">
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="text-sm font-mono w-16 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(3, zoom + 0.25))} className="hover:bg-white/10 rounded-full p-2">
            <ZoomIn className="h-5 w-5" />
          </button>
          <div className="w-px h-6 bg-white/30" />
          <span className="text-sm">{fileName}</span>
          <div className="w-px h-6 bg-white/30" />
          <span className="text-sm">{formatSize(size)}</span>
          <div className="w-px h-6 bg-white/30" />
          <button onClick={handleDownload} className="hover:bg-white/10 rounded-full p-2">
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ArchiveBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  archivePath: string;
  fileName: string;
  size: number;
}

interface ArchiveEntry {
  name: string;
  size: number;
  isDirectory: boolean;
}

export function ArchiveBrowserModal({ isOpen, onClose, archivePath, fileName, size }: ArchiveBrowserModalProps) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  
  if (!isOpen) return null;

  const formatSize = (bytes: number) => {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleExtractSelected = async () => {
    if (selectedEntries.size === 0) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/v1/files/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ archivePath }),
      });
      onClose();
    } catch (error) {
      console.error('Extract failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractAll = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/v1/files/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ archivePath }),
      });
      onClose();
    } catch (error) {
      console.error('Extract failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-lg border border-border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Archive Contents</h3>
            <p className="text-sm text-muted-foreground">{fileName} • {formatSize(size)}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mb-4 rounded-lg border border-border bg-muted/50 p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Archive preview functionality requires server-side archive listing.
            <br />
            You can extract all files to the current directory.
          </p>
        </div>
        
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={handleExtractAll}
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Extracting...' : 'Extract All'}
          </button>
        </div>
      </div>
    </div>
  );
}
