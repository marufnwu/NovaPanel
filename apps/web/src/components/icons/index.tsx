import * as TablerIcons from '@tabler/icons-react';

export type IconName =
  | 'icon-host'
  | 'icon-sun'
  | 'icon-moon'
  | 'icon-database'
  | 'icon-undo'
  | 'icon-document'
  | 'icon-clock'
  | 'icon-download'
  | 'icon-server'
  | 'icon-shield'
  | 'icon-shield-check'
  | 'icon-backup'
  | 'icon-terminal'
  | 'icon-folder'
  | 'icon-world'
  | 'icon-dns'
  | 'icon-lock'
  | 'icon-mail'
  | 'icon-upload'
  | 'icon-chart'
  | 'icon-file-text'
  | 'icon-box'
  | 'icon-list'
  | 'icon-clipboard'
  | 'icon-settings'
  | 'icon-bell'
  | 'icon-webhook'
  | 'icon-key'
  | 'icon-puzzle'
  | 'icon-credit-card'
  | 'icon-building'
  | 'icon-user'
  | 'icon-search'
  | 'icon-plus'
  | 'icon-edit'
  | 'icon-trash'
  | 'icon-refresh'
  | 'icon-check'
  | 'icon-x'
  | 'icon-arrow-right'
  | 'icon-arrow-left'
  | 'icon-chevron-right'
  | 'icon-chevron-down'
  | 'icon-external-link'
  | 'icon-copy'
  | 'icon-eye'
  | 'icon-eye-off'
  | 'icon-menu'
  | 'icon-more-vertical'
  | 'icon-play'
  | 'icon-pause'
  | 'icon-stop'
  | 'icon-refresh-cw'
  | 'icon-power'
  | 'icon-info'
  | 'icon-alert-triangle'
  | 'icon-alert-circle'
  | 'icon-check-circle'
  | 'icon-x-circle'
  | 'icon-cloud'
  | 'icon-users'
  | 'icon-activity'
  | 'icon-trending-up';

const iconMap: Record<IconName, React.FC<{ size?: number; className?: string }>> = {
  'icon-host': TablerIcons.IconWorld as any,
  'icon-sun': TablerIcons.IconSun as any,
  'icon-moon': TablerIcons.IconMoon as any,
  'icon-database': TablerIcons.IconDatabase as any,
  'icon-undo': TablerIcons.IconArrowBackUp as any,
  'icon-document': TablerIcons.IconFileText as any,
  'icon-clock': TablerIcons.IconClock as any,
  'icon-download': TablerIcons.IconDownload as any,
  'icon-server': TablerIcons.IconServer as any,
  'icon-shield': TablerIcons.IconShield as any,
  'icon-shield-check': TablerIcons.IconShieldCheck as any,
  'icon-backup': TablerIcons.IconArchive as any,
  'icon-terminal': TablerIcons.IconTerminal as any,
  'icon-folder': TablerIcons.IconFolder as any,
  'icon-world': TablerIcons.IconWorld as any,
  'icon-dns': TablerIcons.IconPointer as any,
  'icon-lock': TablerIcons.IconLock as any,
  'icon-mail': TablerIcons.IconMail as any,
  'icon-upload': TablerIcons.IconUpload as any,
  'icon-chart': TablerIcons.IconChartBar as any,
  'icon-file-text': TablerIcons.IconFileText as any,
  'icon-box': TablerIcons.IconBox as any,
  'icon-list': TablerIcons.IconList as any,
  'icon-clipboard': TablerIcons.IconClipboardList as any,
  'icon-settings': TablerIcons.IconSettings as any,
  'icon-bell': TablerIcons.IconBell as any,
  'icon-webhook': TablerIcons.IconWebhook as any,
  'icon-key': TablerIcons.IconKey as any,
  'icon-puzzle': TablerIcons.IconPuzzle as any,
  'icon-credit-card': TablerIcons.IconCreditCard as any,
  'icon-building': TablerIcons.IconBuilding as any,
  'icon-user': TablerIcons.IconUser as any,
  'icon-search': TablerIcons.IconSearch as any,
  'icon-plus': TablerIcons.IconPlus as any,
  'icon-edit': TablerIcons.IconEdit as any,
  'icon-trash': TablerIcons.IconTrash as any,
  'icon-refresh': TablerIcons.IconRefresh as any,
  'icon-check': TablerIcons.IconCheck as any,
  'icon-x': TablerIcons.IconX as any,
  'icon-arrow-right': TablerIcons.IconArrowRight as any,
  'icon-arrow-left': TablerIcons.IconArrowLeft as any,
  'icon-chevron-right': TablerIcons.IconChevronRight as any,
  'icon-chevron-down': TablerIcons.IconChevronDown as any,
  'icon-external-link': TablerIcons.IconExternalLink as any,
  'icon-copy': TablerIcons.IconCopy as any,
  'icon-eye': TablerIcons.IconEye as any,
  'icon-eye-off': TablerIcons.IconEyeOff as any,
  'icon-menu': TablerIcons.IconMenu as any,
  'icon-more-vertical': TablerIcons.IconDotsVertical as any,
  'icon-play': TablerIcons.IconPlayerPlay as any,
  'icon-pause': TablerIcons.IconPlayerPause as any,
  'icon-stop': TablerIcons.IconPlayerStop as any,
  'icon-refresh-cw': TablerIcons.IconRefresh as any,
  'icon-power': TablerIcons.IconPower as any,
  'icon-info': TablerIcons.IconInfoCircle as any,
  'icon-alert-triangle': TablerIcons.IconAlertTriangle as any,
  'icon-alert-circle': TablerIcons.IconAlertCircle as any,
  'icon-check-circle': TablerIcons.IconCircleCheck as any,
  'icon-x-circle': TablerIcons.IconCircleX as any,
  'icon-cloud': TablerIcons.IconCloud as any,
  'icon-users': TablerIcons.IconUsers as any,
  'icon-activity': TablerIcons.IconActivity as any,
  'icon-trending-up': TablerIcons.IconTrendingUp as any,
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className }: IconProps) {
  const IconComponent = iconMap[name];
  if (!IconComponent) {
    return null;
  }
  return <IconComponent size={size} className={className} />;
}