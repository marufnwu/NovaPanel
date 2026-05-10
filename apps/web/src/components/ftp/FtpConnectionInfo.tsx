import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { FtpAccount } from '../../api/hooks/ftp';

interface FtpConnectionInfoProps {
  account: FtpAccount;
  serverIp?: string;
}

export function FtpConnectionInfo({ account, serverIp = 'your-server-ip' }: FtpConnectionInfoProps) {
  const [copied, setCopied] = useState(false);

  const info = [
    { label: 'Host', value: serverIp },
    { label: 'Port (FTP)', value: '21' },
    { label: 'Port (FTPS)', value: '990' },
    { label: 'Username', value: account.username },
    { label: 'Home Dir', value: account.homeDir },
    { label: 'Mode', value: account.readonly ? 'Read-only' : 'Read + Write' },
  ];

  const copyAll = () => {
    const text = `Host: ${serverIp}\nPort: 21\nUsername: ${account.username}\nPassword: [your-password]`;
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