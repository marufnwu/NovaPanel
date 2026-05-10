import { useState } from 'react';
import { X } from 'lucide-react';

interface CloudflareDnsFormProps {
  domainName: string;
  initialData?: { type: string; name: string; content: string; proxied: boolean; ttl: number };
  onSubmit: (data: { type: string; name: string; content: string; proxied: boolean; ttl: number }) => void;
  onCancel: () => void;
}

export function CloudflareDnsForm({ domainName, initialData, onSubmit, onCancel }: CloudflareDnsFormProps) {
  const [record, setRecord] = useState(initialData || { type: 'A', name: '', content: '', proxied: false, ttl: 1 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(record);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg space-y-4"
      >
        <h2 className="text-lg font-semibold">Add DNS Record</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Type</label>
          <select
            value={record.type}
            onChange={(e) => setRecord({ ...record, type: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            value={record.name}
            onChange={(e) => setRecord({ ...record, name: e.target.value })}
            placeholder="@ or subdomain"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Content</label>
          <input
            value={record.content}
            onChange={(e) => setRecord({ ...record, content: e.target.value })}
            placeholder="IP address or hostname"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        {(record.type === 'A' || record.type === 'AAAA' || record.type === 'CNAME') && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={record.proxied}
              onChange={(e) => setRecord({ ...record, proxied: e.target.checked })}
              className="rounded"
            />{' '}
            Proxied through Cloudflare
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Create
          </button>
        </div>
      </form>
    </div>
  );
}