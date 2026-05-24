import { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  impact?: 'low' | 'medium' | 'high';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  impact = 'low',
  loading = false,
}: ConfirmDialogProps) {
  const [confirmValue, setConfirmValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmValue('');
      if (impact === 'high') {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [isOpen, impact]);

  const canConfirm = impact === 'high' ? confirmValue === 'DELETE' : true;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div
        className={cn(
          'relative w-full max-w-[360px] mx-4 bg-background-primary rounded-xl p-6 animate-fade-in border',
          impact === 'high' ? 'border-foreground-danger' : 'border-border-tertiary'
        )}
      >
        <h2 className="text-card-title font-medium mb-2">{title}</h2>
        {description && (
          <p className="text-small text-foreground-secondary mb-4">{description}</p>
        )}
        {impact === 'high' && (
          <div className="mb-4">
            <label className="text-meta font-medium mb-1 block">Type DELETE to confirm</label>
            <input
              ref={inputRef}
              type="text"
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              className="w-full h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-danger/50"
              placeholder="DELETE"
            />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={!canConfirm || loading}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}