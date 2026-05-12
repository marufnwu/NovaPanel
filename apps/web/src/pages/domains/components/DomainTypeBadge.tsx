export type DomainType = 'primary' | 'addon' | 'parked' | 'subdomain' | 'redirect' | 'mail-only';

const domainTypeConfig: Record<DomainType, { label: string; className: string }> = {
  primary: { label: 'P', className: 'bg-[#3b82f6]/10 text-[#3b82f6]' },
  addon: { label: 'A', className: 'bg-[#22c55e]/10 text-[#22c55e]' },
  parked: { label: 'PK', className: 'bg-[#6b7280]/10 text-[#6b7280]' },
  subdomain: { label: 'S', className: 'bg-[#f97316]/10 text-[#f97316]' },
  redirect: { label: 'R', className: 'bg-[#a855f7]/10 text-[#a855f7]' },
  'mail-only': { label: 'M', className: 'bg-[#14b8a6]/10 text-[#14b8a6]' },
};

export function DomainTypeBadge({ type }: { type: DomainType }) {
  const config = domainTypeConfig[type] || domainTypeConfig.primary;

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

export default DomainTypeBadge;
