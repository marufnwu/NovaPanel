import { useState } from 'react';
import {
  User,
  Lock,
  Shield,
  Monitor,
  Key,
  Copy,
  Check,
  Trash2,
  LogOut,
  Loader2,
  AlertTriangle,
  QrCode,
  Eye,
  EyeOff,
  Plus,
  ChevronDown,
  ChevronUp,
  Activity,
  Download,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import {
  useChangePassword,
  useChangeEmail,
  useUpdateProfile,
  useEnable2FA,
  useVerify2FA,
  useDisable2FA,
  useSessions,
  useRevokeSession,
  useRevokeAllOtherSessions,
} from '../../api/hooks/auth';
import {
  useTokens,
  useCreateToken,
  useRevokeToken,
  useTokenUsage,
  type ApiToken,
  type CreatedApiToken,
} from '../../api/hooks/tokens';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

// ============================================================
// Types
// ============================================================

type ProfileTab = 'profile' | 'security' | 'api-tokens';

// ============================================================
// Initials Avatar
// ============================================================

function InitialsAvatar({ name, size = 'lg' }: { name: string; size?: 'sm' | 'lg' | 'xl' }) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-sm',
    lg: 'h-16 w-16 text-xl',
    xl: 'h-24 w-24 text-3xl',
  };

  const initials = name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ring-2 ring-background shadow-md`}>
      {initials || 'A'}
    </div>
  );
}

// ============================================================
// Tab Navigation
// ============================================================

function TabNav({ activeTab, onTabChange }: { activeTab: ProfileTab; onTabChange: (t: ProfileTab) => void }) {
  const tabs: Array<{ id: ProfileTab; label: string; icon: any }> = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'api-tokens', label: 'API Tokens', icon: Key },
  ];

  return (
    <div className="flex items-center gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <tab.icon className="h-4 w-4" /> {tab.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Profile Section
// ============================================================

function ProfileSection() {
  const { user } = useAuthStore();
  const updateProfile = useUpdateProfile();
  const changeEmail = useChangeEmail();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [emailPassword, setEmailPassword] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaved(false);
    updateProfile.mutate({ displayName }, {
      onSuccess: () => {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
      },
    });
  };

  const handleEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSaved(false);
    changeEmail.mutate({ newEmail, password: emailPassword }, {
      onSuccess: () => {
        setEmailSaved(true);
        setEmailPassword('');
        setTimeout(() => setEmailSaved(false), 3000);
      },
    });
  };

  const profileDisplayName = user?.displayName || user?.username || 'Admin';

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-4 mb-6">
        <InitialsAvatar name={profileDisplayName} size="lg" />
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <User className="h-5 w-5" /> Profile Information
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
        </div>
      </div>

      <form onSubmit={handleProfileSave} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Username</label>
            <input
              type="text"
              value={user?.username || ''}
              disabled
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Admin"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={updateProfile.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {updateProfile.isPending ? 'Saving...' : profileSaved ? '✓ Saved' : 'Save Profile'}
        </button>
      </form>

      <hr className="my-6 border-border" />

      <h4 className="text-sm font-semibold">Change Email</h4>
      <form onSubmit={handleEmailChange} className="mt-3 space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">New Email</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Current Password</label>
          <div className="relative">
            <input
              type={showEmailPassword ? 'text' : 'password'}
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-10"
              required
            />
            <button type="button" onClick={() => setShowEmailPassword(!showEmailPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {(changeEmail.error as any) && (
          <p className="text-sm text-destructive">{(changeEmail.error as any).message}</p>
        )}
        <button
          type="submit"
          disabled={changeEmail.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {changeEmail.isPending ? 'Changing...' : emailSaved ? '✓ Changed' : 'Change Email'}
        </button>
      </form>
    </div>
  );
}

// ============================================================
// Password Section
// ============================================================

function PasswordSection() {
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return;
    setPasswordChanged(false);
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setPasswordChanged(true);
          setTimeout(() => setPasswordChanged(false), 3000);
        },
      }
    );
  };

  const passwordsMatch = newPassword === confirmPassword;
  const passwordLongEnough = newPassword.length >= 8;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Lock className="h-5 w-5" /> Change Password
      </h3>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Current Password</label>
          <div className="relative">
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-10"
              required
            />
            <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">New Password</label>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-10"
              required
              minLength={8}
            />
            <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {newPassword && !passwordLongEnough && (
            <p className="text-xs text-destructive">Password must be at least 8 characters</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-10"
              required
            />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {confirmPassword && !passwordsMatch && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
        </div>

        {(changePassword.error as any) && (
          <p className="text-sm text-destructive">{(changePassword.error as any).message}</p>
        )}

        <button
          type="submit"
          disabled={changePassword.isPending || !passwordsMatch || !passwordLongEnough}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {changePassword.isPending
            ? 'Changing...'
            : passwordChanged
            ? '✓ Password Changed'
            : 'Change Password'}
        </button>
      </form>
    </div>
  );
}

// ============================================================
// 2FA Section
// ============================================================

function TwoFactorSection() {
  const { user } = useAuthStore();
  const enable2FA = useEnable2FA();
  const verify2FA = useVerify2FA();
  const disable2FA = useDisable2FA();

  const [verifyCode, setVerifyCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisablePassword, setShowDisablePassword] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleEnable = () => {
    enable2FA.mutate();
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enable2FA.data?.secret) return;
    verify2FA.mutate(
      { code: verifyCode, secret: enable2FA.data.secret },
      {
        onSuccess: () => {
          setVerifyCode('');
          setShowBackupCodes(true);
        },
      }
    );
  };

  const handleDisable = (e: React.FormEvent) => {
    e.preventDefault();
    disable2FA.mutate(
      { password: disablePassword },
      {
        onSuccess: () => {
          setDisablePassword('');
        },
      }
    );
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (user?.twoFactorEnabled && !showBackupCodes) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Shield className="h-5 w-5" /> Two-Factor Authentication
        </h3>
        <div className="mt-4 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            Enabled
          </span>
          <span className="text-sm text-muted-foreground">
            Your account is protected with 2FA
          </span>
        </div>

        <hr className="my-4 border-border" />

        <h4 className="text-sm font-semibold text-destructive">Disable 2FA</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          This will remove two-factor authentication from your account. Enter your password to confirm.
        </p>
        <form onSubmit={handleDisable} className="mt-3 space-y-3">
          <div className="relative w-full max-w-xs">
            <input
              type={showDisablePassword ? 'text' : 'password'}
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-10"
              required
            />
            <button type="button" onClick={() => setShowDisablePassword(!showDisablePassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showDisablePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {(disable2FA.error as any) && (
            <p className="text-sm text-destructive">{(disable2FA.error as any).message}</p>
          )}
          <button
            type="submit"
            disabled={disable2FA.isPending}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {disable2FA.isPending ? 'Disabling...' : 'Disable 2FA'}
          </button>
        </form>
      </div>
    );
  }

  if (showBackupCodes && enable2FA.data?.backupCodes) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Key className="h-5 w-5" /> Backup Recovery Codes
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Store these codes in a safe place. Each code can only be used once to sign in if you lose access to your authenticator.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-md bg-muted p-4 font-mono text-sm">
          {enable2FA.data.backupCodes.map((code) => (
            <div key={code} className="flex items-center justify-between gap-2">
              <span>{code}</span>
              <button
                type="button"
                onClick={() => copyCode(code)}
                className="text-muted-foreground hover:text-foreground"
              >
                {copiedCode === code ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowBackupCodes(false)}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Done
        </button>
      </div>
    );
  }

  if (enable2FA.data?.qrCodeUri) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Shield className="h-5 w-5" /> Set Up Two-Factor Authentication
        </h3>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <div className="flex justify-center">
              <div className="rounded-lg border border-border bg-white p-4">
                <QrCode className="h-48 w-48 text-black" />
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  QR: {enable2FA.data.qrCodeUri.substring(0, 40)}...
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">
                Enter the 6-digit code from your authenticator
              </label>
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-center text-lg font-mono tracking-widest focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>
            {(verify2FA.error as any) && (
              <p className="text-sm text-destructive">{(verify2FA.error as any).message}</p>
            )}
            <button
              type="submit"
              disabled={verify2FA.isPending || verifyCode.length !== 6}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {verify2FA.isPending ? 'Verifying...' : 'Verify & Enable'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Shield className="h-5 w-5" /> Two-Factor Authentication
      </h3>
      <div className="mt-4 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
          Not Enabled
        </span>
        <span className="text-sm text-muted-foreground">
          Add an extra layer of security to your account
        </span>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-md bg-muted p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
        <div className="text-sm text-muted-foreground">
          <p>Two-factor authentication adds an additional layer of security by requiring a code from your phone when signing in.</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleEnable}
        disabled={enable2FA.isPending}
        className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {enable2FA.isPending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Enabling...
          </span>
        ) : (
          'Enable 2FA'
        )}
      </button>
    </div>
  );
}

// ============================================================
// Sessions Section
// ============================================================

function SessionsSection() {
  const { data: sessions, isLoading } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAll = useRevokeAllOtherSessions();

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Monitor className="h-5 w-5" /> Active Sessions
        </h3>
        {sessions && sessions.length > 1 && (
          <button
            type="button"
            onClick={() => revokeAll.mutate()}
            disabled={revokeAll.isPending}
            className="flex items-center gap-1 rounded-md border border-destructive px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Revoke All Other
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-4 flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sessions && sessions.length > 0 ? (
        <div className="mt-4 divide-y divide-border">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <Monitor className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {session.browser} on {session.os}
                    </p>
                    {session.isCurrent && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last active {new Date(session.lastAccessedAt).toLocaleDateString()} ·
                    Created {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {!session.isCurrent && (
                <button
                  type="button"
                  onClick={() => revokeSession.mutate(session.id)}
                  disabled={revokeSession.isPending}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  title="Revoke session"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No active sessions found.</p>
      )}
    </div>
  );
}

// ============================================================
// API Tokens Section (Full featured)
// ============================================================

const ALL_PERMISSIONS = [
  { id: 'domains', label: 'Domains' },
  { id: 'databases', label: 'Databases' },
  { id: 'files', label: 'Files' },
  { id: 'ssl', label: 'SSL' },
  { id: 'backups', label: 'Backups' },
  { id: 'dns', label: 'DNS' },
  { id: 'mail', label: 'Mail' },
  { id: 'ftp', label: 'FTP' },
  { id: 'settings', label: 'Settings' },
];

const EXPIRY_OPTIONS = [
  { value: '30d' as const, label: '30 Days' },
  { value: '90d' as const, label: '90 Days' },
  { value: '1y' as const, label: '1 Year' },
  { value: 'never' as const, label: 'Never' },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// Create Token Modal
function CreateTokenModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (token: CreatedApiToken) => void;
}) {
  const [name, setName] = useState('');
  const [expiresIn, setExpiresIn] = useState<'30d' | '90d' | '1y' | 'never'>('never');
  const [permissions, setPermissions] = useState<string[]>([]);
  const createToken = useCreateToken();

  const togglePermission = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const selectAll = () => setPermissions(ALL_PERMISSIONS.map((p) => p.id));
  const selectNone = () => setPermissions([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || permissions.length === 0) return;

    const result = await createToken.mutateAsync({
      name: name.trim(),
      expiresIn,
      permissions,
    });
    onCreated(result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Generate New API Token</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <EyeOff className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Token Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., CI/CD Pipeline, Monitoring Script"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              A descriptive name to identify this token
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Expiration</label>
            <div className="flex flex-wrap gap-2">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExpiresIn(opt.value)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    expiresIn === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Permissions</label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-xs text-primary hover:underline">
                  Select All
                </button>
                <span className="text-muted-foreground">|</span>
                <button type="button" onClick={selectNone} className="text-xs text-primary hover:underline">
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ALL_PERMISSIONS.map((perm) => (
                <label
                  key={perm.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    permissions.includes(perm.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                    className="rounded border-border"
                  />
                  {perm.label}
                </label>
              ))}
            </div>
          </div>

          {createToken.error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {createToken.error.message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || permissions.length === 0 || createToken.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {createToken.isPending ? 'Generating...' : 'Generate Token'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Token Created Modal
function TokenCreatedModal({
  token,
  onClose,
}: {
  token: CreatedApiToken;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(token.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([token.token], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${token.name.replace(/\s+/g, '-').toLowerCase()}-api-token.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <Check className="h-5 w-5 text-green-500" />
          <h2 className="text-lg font-semibold">Token Created Successfully</h2>
        </div>

        <div className="mb-4 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
            <div className="text-sm text-yellow-700 dark:text-yellow-400">
              <strong>Important:</strong> Copy this token now. You won't be able to see it again.
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">
            Token — <span className="text-muted-foreground">{token.name}</span>
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs font-mono">
              {token.token}
            </code>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              {copied ? (
                <><Check className="h-4 w-4 text-green-500" /> Copied!</>
              ) : (
                <><Copy className="h-4 w-4" /> Copy</>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
              title="Download as .txt file"
            >
              <Download className="h-4 w-4" /> Download
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Expires:</span>{' '}
            {token.expiresAt ? formatDate(token.expiresAt) : 'Never'}
          </div>
          <div>
            <span className="text-muted-foreground">Permissions:</span>{' '}
            {token.permissions.join(', ')}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Revoke Confirmation Dialog
function RevokeConfirmDialog({
  token,
  onConfirm,
  onCancel,
  isPending,
}: {
  token: ApiToken;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold">Revoke API Token</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Are you sure you want to revoke the token <strong>"{token.name}"</strong>?
          Any applications using this token will lose access immediately.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            {isPending ? 'Revoking...' : 'Revoke Token'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Token Usage Panel
function TokenUsagePanel({ tokenId }: { tokenId: string }) {
  const { data: usage, isLoading } = useTokenUsage(tokenId);

  if (isLoading) {
    return (
      <div className="px-4 py-6 text-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!usage || usage.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        No usage recorded for this token yet.
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Method</th>
              <th className="px-3 py-2 text-left font-medium">Path</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">IP</th>
              <th className="px-3 py-2 text-left font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {usage.slice(0, 20).map((entry) => (
              <tr key={entry.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                      entry.method === 'GET'
                        ? 'bg-blue-500/10 text-blue-600'
                        : entry.method === 'POST'
                          ? 'bg-green-500/10 text-green-600'
                          : entry.method === 'PUT'
                            ? 'bg-yellow-500/10 text-yellow-600'
                            : entry.method === 'DELETE'
                              ? 'bg-red-500/10 text-red-600'
                              : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {entry.method}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{entry.path}</td>
                <td className="px-3 py-2">
                  <span
                    className={`text-xs ${
                      entry.statusCode < 300
                        ? 'text-green-600'
                        : entry.statusCode < 400
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}
                  >
                    {entry.statusCode}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{entry.ipAddress || '—'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {formatRelativeTime(entry.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {usage.length > 20 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Showing last 20 of {usage.length} entries
        </p>
      )}
    </div>
  );
}

// Token Row
function TokenRow({
  token,
  onRevoke,
}: {
  token: ApiToken;
  onRevoke: (token: ApiToken) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const expired = isExpired(token.expiresAt);

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center gap-4 px-4 py-3">
        <div className={`flex-shrink-0 ${expired ? 'text-muted-foreground' : 'text-primary'}`}>
          <Key className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{token.name}</span>
            {expired && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                Expired
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Created {formatRelativeTime(token.createdAt)}
            </span>
            <span>
              {token.expiresAt ? `Expires ${formatDate(token.expiresAt)}` : 'No expiry'}
            </span>
            <span>Last used {formatRelativeTime(token.lastUsedAt)}</span>
          </div>
        </div>
        <div className="hidden items-center gap-1 lg:flex">
          {token.permissions.slice(0, 4).map((perm) => (
            <span
              key={perm}
              className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize"
            >
              {perm}
            </span>
          ))}
          {token.permissions.length > 4 && (
            <span className="text-xs text-muted-foreground">
              +{token.permissions.length - 4}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="View usage"
          >
            <Activity className="h-3.5 w-3.5" />
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onRevoke(token)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Revoke token"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border bg-muted/20">
          <div className="px-4 py-2">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Recent API Calls — {token.name}
            </h4>
          </div>
          <TokenUsagePanel tokenId={token.id} />
        </div>
      )}
    </div>
  );
}

// API Tokens Tab Content
function ApiTokensTabContent() {
  const { data: tokens, isLoading } = useTokens();
  const revokeToken = useRevokeToken();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedApiToken | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    await revokeToken.mutateAsync(revokeTarget.id);
    setRevokeTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-medium">About API Tokens</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              API tokens allow external applications to interact with the panel programmatically.
              Tokens are shown only once at creation — store them securely.
              Each token's permissions control which API endpoints it can access.
            </p>
          </div>
        </div>
      </div>

      {/* Token List */}
      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="py-12">
            <LoadingSpinner />
          </div>
        ) : !tokens || tokens.length === 0 ? (
          <div className="py-12 text-center">
            <Key className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-2 text-sm font-medium">No API tokens</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Generate a token to start using the API programmatically.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> Generate Token
            </button>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="border-b border-border bg-muted/30 px-4 py-2">
              <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                <span className="w-5" />
                <span className="flex-1">Token</span>
                <span className="hidden lg:block">Permissions</span>
                <span>Actions</span>
              </div>
            </div>
            {/* Token rows */}
            {tokens.map((token) => (
              <TokenRow
                key={token.id}
                token={token}
                onRevoke={setRevokeTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Token Modal */}
      {showCreateModal && (
        <CreateTokenModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(token) => {
            setShowCreateModal(false);
            setCreatedToken(token);
          }}
        />
      )}

      {/* Token Created Modal */}
      {createdToken && (
        <TokenCreatedModal
          token={createdToken}
          onClose={() => setCreatedToken(null)}
        />
      )}

      {/* Revoke Confirmation */}
      {revokeTarget && (
        <RevokeConfirmDialog
          token={revokeTarget}
          onConfirm={handleRevoke}
          onCancel={() => setRevokeTarget(null)}
          isPending={revokeToken.isPending}
        />
      )}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export function ProfilePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Profile & Settings" 
        description="Manage your account profile, security settings, and API access" 
        actions={
          <button
            onClick={() => setActiveTab('api-tokens')}
            className="flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10 transition-colors"
          >
            <Key className="h-4 w-4" />
            Manage API Tokens
          </button>
        }
      />

      {/* Forced Password Change Notice */}
      {user?.mustChangePassword && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
          <div>
            <h3 className="text-sm font-semibold text-yellow-800">Password Change Required</h3>
            <p className="mt-1 text-sm text-yellow-700">
              Your account requires a password change. Please update your password below to continue using the panel securely.
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'profile' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <ProfileSection />
          </div>
        )}
        
        {activeTab === 'security' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <PasswordSection />
              <TwoFactorSection />
            </div>
            <div>
              <SessionsSection />
            </div>
          </div>
        )}
        
        {activeTab === 'api-tokens' && (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Key className="h-5 w-5" /> API Tokens
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage API tokens for programmatic access to the panel
              </p>
            </div>
            <button
              onClick={() => {
                const modal = document.query('[data-create-token-modal]');
                if (modal) (modal as any).showModal?.() || document.querySelector('.modal-trigger')?.click();
              }}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Generate Token
            </button>
          </div>
        )}
      </div>

      {/* Full API Tokens Section */}
      {activeTab === 'api-tokens' && <ApiTokensTabContent />}
    </div>
  );
}
