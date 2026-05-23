import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useSslCertificates, useDeleteCertificate, type SslCertificate } from '../../api/hooks/ssl';
import { Icon } from '../../components/icons';

export function SslPage() {
  const queryClient = useQueryClient();
  const { data: certificates, isLoading } = useSslCertificates();
  const deleteCertificate = useDeleteCertificate();
  const [deleteDomainId, setDeleteDomainId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteDomainId) return;
    try {
      await deleteCertificate.mutateAsync(deleteDomainId);
      setDeleteDomainId(null);
      queryClient.invalidateQueries({ queryKey: ['ssl'] });
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  const getExpiryStatus = (cert: SslCertificate) => {
    if (!cert.daysUntilExpiry) return 'active';
    if (cert.daysUntilExpiry <= 7) return 'expired';
    if (cert.daysUntilExpiry <= 30) return 'pending';
    return 'active';
  };

  const columns = [
    {
      key: 'domain',
      label: 'Domain',
      render: (cert: SslCertificate) => <span className="font-mono font-medium">{cert.domain}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (cert: SslCertificate) => (
        <span className="text-small px-2 py-0.5 bg-background-secondary rounded capitalize">
          {cert.type === 'letsencrypt' ? 'Let\'s Encrypt' : cert.type}
        </span>
      ),
    },
    {
      key: 'issuer',
      label: 'Issuer',
    },
    {
      key: 'expiresAt',
      label: 'Expires',
      render: (cert: SslCertificate) => cert.expiresAt ? new Date(cert.expiresAt).toLocaleDateString() : '—',
    },
    {
      key: 'daysUntilExpiry',
      label: 'Days Left',
      render: (cert: SslCertificate) => {
        const days = cert.daysUntilExpiry;
        if (!days) return '—';
        let color = 'text-foreground-success';
        if (days <= 7) color = 'text-foreground-danger';
        else if (days <= 30) color = 'text-foreground-warning';
        return <span className={color}>{days} days</span>;
      },
    },
    {
      key: 'autoRenew',
      label: 'Auto-Renew',
      render: (cert: SslCertificate) => cert.autoRenew ? <StatusBadge status="active" /> : <StatusBadge status="inactive" />,
    },
    {
      key: 'actions',
      label: '',
      render: (cert: SslCertificate) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="small" icon={<Icon name="icon-refresh" size={15} />}>Renew</Button>
          <Button variant="ghost" size="small" onClick={() => setDeleteDomainId(cert.domainId)} icon={<Icon name="icon-trash" size={15} />}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">SSL Certificates</h1>
        <Button icon={<Icon name="icon-lock" size={16} />}>
          Issue Certificate
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={certificates || []}
        rowKey={(cert) => cert.id}
        emptyState={
          <EmptyState
            icon="icon-lock"
            title="No SSL certificates"
            description="Issue a certificate to secure your domains"
            action={{ label: 'Issue Certificate', onClick: () => {} }}
          />
        }
      />

      <ConfirmDialog
        isOpen={!!deleteDomainId}
        onClose={() => setDeleteDomainId(null)}
        onConfirm={handleDelete}
        title="Delete Certificate"
        description="This will remove the SSL certificate from the domain."
        confirmText="Delete"
        impact="high"
      />
    </div>
  );
}