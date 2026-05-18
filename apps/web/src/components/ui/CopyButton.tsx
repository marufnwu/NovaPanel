import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  variant?: 'ghost' | 'outline' | 'default';
}

export function CopyButton({ value, label = 'Copy', className = '', variant = 'ghost' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const baseClasses = 'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors';
  const variantClasses = {
    ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
    outline: 'border border-border hover:bg-accent',
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  };

  return (
    <button
      onClick={handleCopy}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      title={copied ? 'Copied!' : label}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-500" />
          <span className="text-green-500">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}