import { useState } from 'react';
import { Plus, Trash2, CheckCircle, Info } from 'lucide-react';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { toast } from '../../lib/toast';
import type { Domain } from '../../api/hooks/domains';

export interface Subdomain {
  id: string;
  name: string;
  documentRoot: string;
  phpVersion: string;
}

export interface SubdomainsSectionProps {
  domain: Domain;
  subdomains: Subdomain[] | undefined;
  onCreateSubdomain: {
    mutate: (
      data: { name: string; documentRoot?: string },
      options?: {
        onSuccess?: (result: any) => void;
        onError?: (e: Error) => void;
      }
    ) => void;
    isPending: boolean;
  };
  onDeleteSubdomain: {
    mutate: (
      id: string,
      options?: {
        onSuccess?: () => void;
        onError?: (e: Error) => void;
      }
    ) => void;
  };
}

const RESERVED_SUBDOMAINS = ['www', 'mail', 'ftp', 'admin', 'root', 'administrator', 'webmail', 'smtp', 'pop', 'ns1', 'ns2', 'webdisk', 'ns', 'mysql', 'pgsql', 'ssh', 'git'];

export function SubdomainsSection({
  domain,
  subdomains,
  onCreateSubdomain,
  onDeleteSubdomain,
}: SubdomainsSectionProps) {
  const [newSubdomain, setNewSubdomain] = useState('');
  const [newSubdomainDocRoot, setNewSubdomainDocRoot] = useState('');
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const [subdomainWarning, setSubdomainWarning] = useState<string | null>(null);
  const [dnsStatus, setDnsStatus] = useState<{ created: boolean; message: string } | null>(null);

  // Compute auto document root for subdomains
  const autoDocRoot = newSubdomain
    ? `/var/www/vhosts/${domain.name}/subdomains/${newSubdomain}`
    : `/var/www/vhosts/${domain.name}/subdomains/{subdomain}`;

  // Validate subdomain name
  const validateSubdomain = (name: string): string | null => {
    if (!name) return null;
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?$/.test(name)) {
      return 'Subdomain must start and end with alphanumeric characters, and contain only letters, numbers, and hyphens';
    }
    if (name.length > 63) {
      return 'Subdomain must be 63 characters or less';
    }
    if (RESERVED_SUBDOMAINS.includes(name.toLowerCase())) {
      return `Warning: "${name.toLowerCase()}" is a reserved name`;
    }
    if (subdomains?.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      return `"${name}" already exists as a subdomain`;
    }
    return null;
  };

  // Handle subdomain input change with validation
  const handleSubdomainChange = (value: string) => {
    setNewSubdomain(value);
    setDnsStatus(null);
    const error = validateSubdomain(value);
    if (error && !RESERVED_SUBDOMAINS.includes(value.toLowerCase()) && !subdomains?.some(s => s.name.toLowerCase() === value.toLowerCase())) {
      setSubdomainError(error);
      setSubdomainWarning(null);
    } else if (RESERVED_SUBDOMAINS.includes(value.toLowerCase())) {
      setSubdomainWarning(`"${value.toLowerCase()}" is a reserved name`);
      setSubdomainError(null);
    } else if (subdomains?.some(s => s.name.toLowerCase() === value.toLowerCase())) {
      setSubdomainError(`"${value}" already exists as a subdomain`);
      setSubdomainWarning(null);
    } else {
      setSubdomainError(null);
      setSubdomainWarning(null);
    }
  };

  // Handle subdomain creation
  const handleCreateSubdomain = () => {
    if (!newSubdomain) return;
    const fullName = `${newSubdomain}.${domain.name}`;
    onCreateSubdomain.mutate(
      { name: newSubdomain, documentRoot: newSubdomainDocRoot || undefined },
      {
        onSuccess: (result: any) => {
          setNewSubdomain('');
          setNewSubdomainDocRoot('');
          setSubdomainError(null);
          setSubdomainWarning(null);
          const dnsMessage = result?.dnsCreated
            ? `DNS record created`
            : `DNS record not created (DNS zone may not exist)`;
          setDnsStatus({ created: result?.dnsCreated ?? false, message: dnsMessage });
          toast.success(`Subdomain ${fullName} created`);
          // Clear DNS status after 5 seconds
          setTimeout(() => setDnsStatus(null), 5000);
        },
        onError: (e: Error) => {
          toast.error(e.message || 'Failed to create subdomain');
          setDnsStatus(null);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Subdomain creation form */}
      <div className="flex gap-3">
        <input
          value={newSubdomain}
          onChange={(e) => handleSubdomainChange(e.target.value)}
          placeholder="Subdomain prefix (e.g., api)"
          className="flex-1 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          value={newSubdomainDocRoot}
          onChange={(e) => setNewSubdomainDocRoot(e.target.value)}
          placeholder={autoDocRoot}
          className="flex-1 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleCreateSubdomain}
          disabled={!newSubdomain || !!subdomainError || onCreateSubdomain.isPending}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      {subdomainError && (
        <p className="text-sm text-destructive">{subdomainError}</p>
      )}
      {subdomainWarning && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400">{subdomainWarning}</p>
      )}
      {dnsStatus && (
        <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${dnsStatus.created ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400' : 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'}`}>
          {dnsStatus.created ? <CheckCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          <span>{dnsStatus.message}</span>
        </div>
      )}
      {subdomains && subdomains.length > 0 ? (
        <ResponsiveTable>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Subdomain</th>
                <th className="px-4 py-2 text-left font-medium">Document Root</th>
                <th className="px-4 py-2 text-left font-medium">PHP</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subdomains.map((sub) => (
                <tr key={sub.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-medium">{sub.name}.{domain.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{sub.documentRoot}</td>
                  <td className="px-4 py-2 text-muted-foreground">{sub.phpVersion}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => onDeleteSubdomain.mutate(sub.id, {
                        onSuccess: () => toast.success(`Subdomain deleted`),
                        onError: (e: Error) => toast.error(e.message || 'Failed to delete subdomain'),
                      })}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      ) : (
        <p className="text-sm text-muted-foreground">No subdomains</p>
      )}
    </div>
  );
}
