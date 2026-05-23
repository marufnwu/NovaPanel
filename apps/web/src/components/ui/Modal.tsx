import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '../icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'small' | 'medium' | 'large';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, size = 'medium', children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      panelRef.current?.focus();
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    small: 'max-w-[320px]',
    medium: 'max-w-[480px]',
    large: 'max-w-[640px]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative w-full mx-4 bg-background-primary border border-border-tertiary rounded-xl p-6 animate-fade-in',
          'focus:outline-none',
          sizes[size]
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-card-title font-medium">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-background-tertiary rounded-md"
            aria-label="Close"
          >
            <Icon name="icon-x" size={18} />
          </button>
        </div>
        <div className="mb-4">{children}</div>
        {footer && <div className="flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}