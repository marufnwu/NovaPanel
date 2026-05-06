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
import { useCreateToken } from '../../api/hooks/tokens';
import { PageHeader } from '../../components/ui/PageHeader';

// --- Initials Avatar ---
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

// --- Profile Section ---
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
      {/* Profile Header with Avatar */}
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

// --- Password Section ---
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

// --- 2FA Section ---
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

  // If 2FA is already enabled
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

  // If backup codes are being shown
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

  // If 2FA setup is in progress (enable2FA was called and returned data)
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

  // Default: 2FA not enabled, show enable button
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

// --- Sessions Section ---
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

// --- API Token Section ---
function ApiTokenSection() {
  const generateToken = useCreateToken();
  const [tokenName, setTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    generateToken.mutate({ name: tokenName, expiresIn: 'never', permissions: ['read'] }, {
      onSuccess: (data) => {
        setGeneratedToken(data.token);
        setTokenName('');
      },
    });
  };

  const copyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Key className="h-5 w-5" /> API Tokens
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Generate tokens for API access. Tokens are shown only once.
      </p>

      {generatedToken && (
        <div className="mt-4 rounded-md bg-green-50 border border-green-200 p-4">
          <p className="text-sm font-medium text-green-800">Token generated successfully!</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-3 py-2 text-xs font-mono break-all border">
              {generatedToken}
            </code>
            <button
              type="button"
              onClick={copyToken}
              className="rounded-md p-2 hover:bg-green-100"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-green-700">
            Copy this token now. You won't be able to see it again.
          </p>
        </div>
      )}

      <form onSubmit={handleGenerate} className="mt-4 flex gap-3">
        <input
          type="text"
          value={tokenName}
          onChange={(e) => setTokenName(e.target.value)}
          placeholder="Token name (e.g., CI/CD Pipeline)"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          required
        />
        <button
          type="submit"
          disabled={generateToken.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {generateToken.isPending ? 'Generating...' : 'Generate'}
        </button>
      </form>
    </div>
  );
}

// --- Main Page ---
export function ProfilePage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & Security" description="Manage your account settings and security" />

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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ProfileSection />
          <PasswordSection />
        </div>
        <div className="space-y-6">
          <TwoFactorSection />
          <SessionsSection />
          <ApiTokenSection />
        </div>
      </div>
    </div>
  );
}
