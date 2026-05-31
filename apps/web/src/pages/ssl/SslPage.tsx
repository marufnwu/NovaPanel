import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import {
  useSslCertificates,
  useDeleteCertificate,
  useRenewCertificate,
  useIssueLetsEncrypt,
  useToggleAutoRenew,
  useCertDetails,
  useValidateChain,
  useCheckMixedContent,
  useUpdateHsts,
  useUpdateOcspStapling,
  type SslCertificate,
} from '../../api/hooks/ssl';
import { toast } from '../../lib/toast';
import { Icon } from '../../components/icons';
import { useDomains } from '../../api/hooks/domains';

type CertModalType = 'issue' | 'details' | 'validate' | 'mixed';

export function SslPage() {
  const queryClient = useQueryClient();
  const { data: certificates, isLoading, isError, error, refetch } = useSslCertificates();
  const deleteCertificate = useDeleteCertificate();
  const renewCertificate = useRenewCertificate();
  const issueLetsEncrypt = useIssueLetsEncrypt();
  const toggleAutoRenew = useToggleAutoRenew();
  const validateChain = useValidateChain();
  const checkMixedContent = useCheckMixedContent();
  const updateHsts = useUpdateHsts();
  const updateOcspStapling = useUpdateOcspStapling();

  const [deleteTarget, setDeleteTarget] = useState<SslCertificate | null>(null);
  const [selectedCert, setSelectedCert] = useState<SslCertificate | null>(null);
  const [modalType, setModalType] = useState<CertModalType | null>(null);
  const [renewConfirmOpen, setRenewConfirmOpen] = useState<SslCertificate | null>(null);

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const columns = [
    {
      key: 'domain',
      label: 'Domain',
      render: (cert: SslCertificate) => (
        <span className="font-mono font-medium">{cert.domain}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (cert: SslCertificate) => (
        <span className="text-small px-2 py-0.5 bg-background-secondary rounded capitalize">
          {cert.type === 'letsencrypt' ? "Let's Encrypt" : cert.type}
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
      render: (cert: SslCertificate) =>
        cert.expiresAt ? new Date(cert.expiresAt).toLocaleDateString() : '—',
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
      render: (cert: SslCertificate) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleAutoRenew.mutate(
              { domainId: cert.domainId, autoRenew: !cert.autoRenew },
              {
                onSuccess: () =>
                  toast.success(
                    `Auto-renew ${cert.autoRenew ? 'disabled' : 'enabled'} for ${cert.domain}`
                  ),
                onError: (err) =>
                  toast.error(`Failed to toggle auto-renew: ${err.message}`),
              }
            );
          }}
          disabled={toggleAutoRenew.isPending}
          className="text-left"
        >
          {cert.autoRenew ? (
            <StatusBadge status="active" />
          ) : (
            <StatusBadge status="inactive" />
          )}
        </button>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (cert: SslCertificate) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="small"
            icon={<Icon name="icon-refresh" size={15} />}
            onClick={(e) => {
              e.stopPropagation();
              setRenewConfirmOpen(cert);
            }}
          >
            Renew
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCert(cert);
              setModalType('details');
            }}
          >
            Details
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(cert);
            }}
            icon={<Icon name="icon-trash" size={15} />}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-medium">SSL Certificates</h1>
        <Button
          icon={<Icon name="icon-lock" size={16} />}
          onClick={() => setModalType('issue')}
        >
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
            action={{ label: 'Issue Certificate', onClick: () => setModalType('issue') }}
          />
        }
      />

      {/* Issue Certificate Modal */}
      <IssueCertModal
        isOpen={modalType === 'issue'}
        onClose={() => setModalType(null)}
        mutation={issueLetsEncrypt}
      />

      {/* Certificate Details Modal */}
      {selectedCert && modalType === 'details' && (
        <CertDetailsModal
          isOpen
          onClose={() => {
            setSelectedCert(null);
            setModalType(null);
          }}
          cert={selectedCert}
          validateMutation={validateChain}
          mixedContentMutation={checkMixedContent}
          hstsMutation={updateHsts}
          ocspMutation={updateOcspStapling}
        />
      )}

      {/* Renew Confirm */}
      <ConfirmDialog
        isOpen={!!renewConfirmOpen}
        onClose={() => setRenewConfirmOpen(null)}
        onConfirm={() => {
          if (!renewConfirmOpen) return;
          renewCertificate.mutate(renewConfirmOpen.domainId, {
            onSuccess: () => {
              toast.success(`Certificate renewal started for ${renewConfirmOpen.domain}`);
              setRenewConfirmOpen(null);
            },
            onError: (err) =>
              toast.error(`Failed to renew certificate: ${err.message}`),
          });
        }}
        title="Renew Certificate"
        description={`Renew SSL certificate for "${renewConfirmOpen?.domain}"? This may take a few minutes.`}
        confirmText="Renew"
        impact="medium"
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteCertificate.mutate(deleteTarget.domainId, {
            onSuccess: () => {
              toast.success('Certificate deleted');
              setDeleteTarget(null);
              queryClient.invalidateQueries({ queryKey: ['ssl'] });
            },
            onError: (err) => toast.error(`Failed to delete: ${err.message}`),
          });
        }}
        title="Delete Certificate"
        description="This will remove the SSL certificate from the domain."
        confirmText="Delete"
        impact="high"
        loading={deleteCertificate.isPending}
      />
    </div>
  );
}

function IssueCertModal({
  isOpen,
  onClose,
  mutation,
}: {
  isOpen: boolean;
  onClose: () => void;
  mutation: ReturnType<typeof useIssueLetsEncrypt>;
}) {
  const { data: domains } = useDomains();
  const [domainId, setDomainId] = useState('');
  const [email, setEmail] = useState('');
  const [sanDomains, setSanDomains] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainId || !email) return;
    mutation.mutate(
      {
        domainId,
        email,
        sanDomains: sanDomains
          ? sanDomains.split(',').map((s) => s.trim())
          : undefined,
      },
      {
        onSuccess: () => {
          toast.success('SSL certificate issuance started');
          onClose();
          setDomainId('');
          setEmail('');
          setSanDomains('');
        },
        onError: (err) => toast.error(`Failed to issue certificate: ${err.message}`),
      }
    );
  };

  const domainOptions = domains?.map((d) => ({ value: d.id, label: d.name })) || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Issue SSL Certificate"
      size="medium"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={handleSubmit}
            disabled={!domainId || !email}
          >
            Issue Certificate
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-meta font-medium">Domain</label>
          <select
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
            className="h-[34px] px-3 text-small rounded-md border border-border-tertiary bg-background-primary focus:outline-none focus:ring-2 focus:ring-foreground-info/50"
          >
            <option value="">Select domain</option>
            {domainOptions.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          required
        />
        <Input
          label="Additional Domains (SANs)"
          value={sanDomains}
          onChange={(e) => setSanDomains(e.target.value)}
          placeholder="www.example.com, blog.example.com"
        />
      </form>
    </Modal>
  );
}

function CertDetailsModal({
  isOpen,
  onClose,
  cert,
  validateMutation,
  mixedContentMutation,
  hstsMutation,
  ocspMutation,
}: {
  isOpen: boolean;
  onClose: () => void;
  cert: SslCertificate;
  validateMutation: ReturnType<typeof useValidateChain>;
  mixedContentMutation: ReturnType<typeof useCheckMixedContent>;
  hstsMutation: ReturnType<typeof useUpdateHsts>;
  ocspMutation: ReturnType<typeof useUpdateOcspStapling>;
}) {
  const [tab, setTab] = useState<'info' | 'validate' | 'hsts'>('info');
  const [hstsEnabled, setHstsEnabled] = useState(cert.hstsEnabled || false);
  const [hstsMaxAge, setHstsMaxAge] = useState(cert.hstsMaxAge || 31536000);
  const [ocspEnabled, setOcspEnabled] = useState(cert.ocspStapling || false);

  const { data: details, isLoading: detailsLoading } = useCertDetails(cert.domainId);
  const [validateResult, setValidateResult] = useState<any>(null);
  const [mixedResult, setMixedResult] = useState<any>(null);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`SSL Details — ${cert.domain}`}
      size="medium"
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="border-b border-border-tertiary">
          <nav className="flex gap-1">
            {(['info', 'validate', 'hsts'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-2 text-small capitalize',
                  tab === t
                    ? 'text-foreground-primary font-medium'
                    : 'text-foreground-secondary'
                )}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>

        {tab === 'info' && (
          <div className="flex flex-col gap-3">
            <DetailRow label="Issuer" value={cert.issuer} />
            <DetailRow label="Type" value={cert.type} />
            <DetailRow label="Expires" value={cert.expiresAt ? new Date(cert.expiresAt).toLocaleString() : '—'} />
            <DetailRow label="Issued At" value={cert.issuedAt ? new Date(cert.issuedAt).toLocaleString() : '—'} />
            <DetailRow label="Fingerprint" value={cert.fingerprint || '—'} mono />
            <DetailRow label="Auto Renew" value={cert.autoRenew ? 'Yes' : 'No'} />
            <DetailRow label="OCSP Stapling" value={cert.ocspStapling ? 'Enabled' : 'Disabled'} />
            <DetailRow label="HSTS" value={cert.hstsEnabled ? `Enabled (max-age=${cert.hstsMaxAge})` : 'Disabled'} />
            <DetailRow label="SANs" value={cert.sanDomains?.join(', ') || '—'} mono />
          </div>
        )}

        {tab === 'validate' && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Button
                variant="default"
                size="small"
                loading={validateMutation.isPending}
                onClick={() => {
                  validateMutation.mutate(cert.domainId, {
                    onSuccess: (data) => setValidateResult(data),
                    onError: (err) => toast.error(`Validation failed: ${err.message}`),
                  });
                }}
              >
                Validate Chain
              </Button>
              <Button
                variant="default"
                size="small"
                loading={mixedContentMutation.isPending}
                onClick={() => {
                  mixedContentMutation.mutate(cert.domainId, {
                    onSuccess: (data) => setMixedResult(data),
                    onError: (err) => toast.error(`Check failed: ${err.message}`),
                  });
                }}
              >
                Check Mixed Content
              </Button>
            </div>
            {validateResult && (
              <div className="p-3 rounded-lg border border-border-tertiary">
                <p className="text-small font-medium mb-1">
                  Chain Validation:{' '}
                  {validateResult.valid ? (
                    <span className="text-foreground-success">Valid</span>
                  ) : (
                    <span className="text-foreground-danger">Invalid</span>
                  )}
                </p>
                {validateResult.issues?.length > 0 && (
                  <ul className="text-small text-foreground-secondary mt-1">
                    {validateResult.issues.map((issue: string, i: number) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {mixedResult && (
              <div className="p-3 rounded-lg border border-border-tertiary">
                <p className="text-small font-medium mb-1">
                  Mixed Content:{' '}
                  {mixedResult.totalIssues === 0 ? (
                    <span className="text-foreground-success">None found</span>
                  ) : (
                    <span className="text-foreground-danger">{mixedResult.totalIssues} issue(s) found</span>
                  )}
                </p>
                {mixedResult.issues?.slice(0, 5).map((issue: any, i: number) => (
                  <p key={i} className="text-small text-foreground-secondary font-mono">
                    {issue.type} — {issue.resourceUrl}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'hsts' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hstsEnabled}
                onChange={(e) => setHstsEnabled(e.target.checked)}
                className="accent-foreground-info"
              />
              <label className="text-small">Enable HSTS</label>
            </div>
            {hstsEnabled && (
              <>
                <Input
                  label="Max Age (seconds)"
                  type="number"
                  value={hstsMaxAge}
                  onChange={(e) => setHstsMaxAge(Number(e.target.value))}
                />
              </>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ocspEnabled}
                onChange={(e) => setOcspEnabled(e.target.checked)}
                className="accent-foreground-info"
              />
              <label className="text-small">Enable OCSP Stapling</label>
            </div>
            <Button
              variant="primary"
              loading={hstsMutation.isPending || ocspMutation.isPending}
              onClick={() => {
                hstsMutation.mutate(
                  { domainId: cert.domainId, enabled: hstsEnabled, maxAge: hstsMaxAge, includeSubdomains: true },
                  {
                    onSuccess: () => toast.success('HSTS settings updated'),
                    onError: (err) => toast.error(`Failed to update HSTS: ${err.message}`),
                  }
                );
                ocspMutation.mutate(
                  { domainId: cert.domainId, enabled: ocspEnabled },
                  {
                    onSuccess: () => toast.success('OCSP stapling updated'),
                    onError: (err) => toast.error(`Failed to update OCSP: ${err.message}`),
                  }
                );
              }}
            >
              Save HSTS & OCSP Settings
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-meta text-foreground-secondary">{label}</span>
      <span className={`text-small ${mono ? 'font-mono' : ''} text-right`}>{value}</span>
    </div>
  );
}