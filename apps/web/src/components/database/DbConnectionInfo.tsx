import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface DbConnectionInfoProps {
  host: string;
  port: number;
  database: string;
  username?: string;
}

export function DbConnectionInfo({ host, port, database, username }: DbConnectionInfoProps) {
  const [copied, setCopied] = useState(false);
  
  const info = [
    { label: 'Host', value: host },
    { label: 'Port', value: String(port) },
    { label: 'Database', value: database },
    ...(username ? [{ label: 'Username', value: username }] : []),
  ];

  const copyAll = () => {
    const text = info.map(i => `${i.label}: ${i.value}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-medium">Connection Information</h4>
        <button onClick={copyAll} className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs hover:bg-accent">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy All'}
        </button>
      </div>
      <div className="grid gap-2 text-sm">
        {info.map(item => (
          <div key={item.label} className="flex justify-between">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-mono font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}