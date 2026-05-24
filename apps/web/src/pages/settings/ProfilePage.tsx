import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import {
  useMe,
  useUpdateProfile,
  useChangeEmail,
  useChangePassword,
  useEnable2FA,
  useVerify2FA,
  useDisable2FA,
  useSessions,
  useRevokeSession,
  useRevokeAllOtherSessions,
} from '../../api/hooks/auth';
import { toast } from '../../lib/toast';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input } from '../../components/ui/Input';
import { Icon } from '../../components/icons';

export function ProfilePage() {
  const { data: user, isLoading, isError, error, refetch } = useMe();
  const [enable2FAStep, setEnable2FAStep] = useState<'intro' | 'verify'>('intro');
  const [qrCodeData, setQrCodeData] = useState<{ secret: string; qrCodeUri: string } | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);

  const updateProfile = useUpdateProfile();
  const changeEmail = useChangeEmail();
  const changePassword = useChangePassword();
  const enable2FA = useEnable2FA();
  const verify2FA = useVerify2FA();
  const disable2FA = useDisable2FA();

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title font-medium">Profile</h1>
        <p className="text-small text-foreground-secondary mt-0.5">
          Manage your account settings
        </p>
      </div>

      {/* Profile Info */}
      <Card title="Profile Information">
        <ProfileInfoSection user={user} mutation={updateProfile} />
      </Card>

      {/* Change Email */}
      <Card title="Change Email">
        <ChangeEmailSection mutation={changeEmail} />
      </Card>

      {/* Change Password */}
      <Card title="Change Password">
        <ChangePasswordSection mutation={changePassword} />
      </Card>

      {/* 2FA */}
      <Card title="Two-Factor Authentication">
        {user.twoFactorEnabled ? (
          <Disable2FASection mutation={disable2FA} onConfirmOpen={() => setDisableConfirmOpen(true)} />
        ) : (
          <Enable2FASection
            step={enable2FAStep}
            onIntro={() => {
              enable2FA.mutate(undefined, {
                onSuccess: (data) => {
                  setQrCodeData({ secret: data.secret, qrCodeUri: data.qrCodeUri });
                  setEnable2FAStep('verify');
                },
                onError: (err) => toast.error(`Failed to enable 2FA: ${err.message}`),
              });
            }}
            onVerify={(code: string) => {
              if (!qrCodeData) return;
              verify2FA.mutate(
                { code, secret: qrCodeData.secret },
                {
                  onSuccess: () => {
                    toast.success('2FA enabled successfully');
                    setEnable2FAStep('intro');
                    setQrCodeData(null);
                    refetch();
                  },
                  onError: (err) => toast.error(`Failed to verify 2FA: ${err.message}`),
                }
              );
            }}
            qrCodeData={qrCodeData}
            isLoading={enable2FA.isPending || verify2FA.isPending}
          />
        )}
      </Card>

      {/* Active Sessions */}
      <Card title="Active Sessions">
        <SessionsSection />
      </Card>

      <Modal
        isOpen={disableConfirmOpen}
        onClose={() => {
          setDisableConfirmOpen(false);
          setDisablePassword('');
        }}
        title="Disable 2FA"
        footer={
          <>
            <Button variant="ghost" onClick={() => {
              setDisableConfirmOpen(false);
              setDisablePassword('');
            }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={disable2FA.isPending}
              onClick={() => {
                disable2FA.mutate(
                  { password: disablePassword },
                  {
                    onSuccess: () => {
                      toast.success('2FA disabled');
                      setDisableConfirmOpen(false);
                      setDisablePassword('');
                      refetch();
                    },
                    onError: (err) => toast.error(`Failed to disable 2FA: ${err.message}`),
                  }
                );
              }}
              disabled={!disablePassword}
            >
              Disable 2FA
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-small text-foreground-secondary">
            Enter your current password to disable two-factor authentication.
          </p>
          <Input
            label="Current Password"
            type="password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            placeholder="Enter your password"
          />
        </div>
      </Modal>
    </div>
  );
}

function ProfileInfoSection({
  user,
  mutation,
}: {
  user: { displayName: string | null; email: string; username: string };
  mutation: ReturnType<typeof useUpdateProfile>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName || '');

  return (
    <div className="flex items-end gap-4">
      <div className="flex flex-col gap-1 flex-1">
        <Input
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <Button
        variant="primary"
        loading={mutation.isPending}
        onClick={() => {
          mutation.mutate(
            { displayName },
            {
              onSuccess: () => toast.success('Profile updated'),
              onError: (err) => toast.error(`Failed to update profile: ${err.message}`),
            }
          );
        }}
      >
        Save
      </Button>
    </div>
  );
}

function ChangeEmailSection({ mutation }: { mutation: ReturnType<typeof useChangeEmail> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      { newEmail: email, password },
      {
        onSuccess: () => {
          toast.success('Email changed — check your inbox to verify');
          setEmail('');
          setPassword('');
        },
        onError: (err) => toast.error(`Failed to change email: ${err.message}`),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <Input label="New Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Input label="Current Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <Button variant="default" loading={mutation.isPending} type="submit" disabled={!email || !password}>
        Change Email
      </Button>
    </form>
  );
}

function ChangePasswordSection({ mutation }: { mutation: ReturnType<typeof useChangePassword> }) {
  const [current, setCurrent] = useState('');
  const [neu, setNeu] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (neu !== confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (neu.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    mutation.mutate(
      { currentPassword: current, newPassword: neu },
      {
        onSuccess: () => {
          toast.success('Password changed');
          setCurrent('');
          setNeu('');
          setConfirm('');
        },
        onError: (err) => toast.error(`Failed to change password: ${err.message}`),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <Input label="Current Password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      <Input label="New Password" type="password" value={neu} onChange={(e) => setNeu(e.target.value)} required />
      <Input label="Confirm New Password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      <Button variant="default" loading={mutation.isPending} type="submit" disabled={!current || !neu || !confirm}>
        Change Password
      </Button>
    </form>
  );
}

function Enable2FASection({
  step,
  onIntro,
  onVerify,
  qrCodeData,
  isLoading,
}: {
  step: 'intro' | 'verify';
  onIntro: () => void;
  onVerify: (code: string) => void;
  qrCodeData: { secret: string; qrCodeUri: string } | null;
  isLoading: boolean;
}) {
  const [code, setCode] = useState('');

  if (step === 'verify' && qrCodeData) {
    return (
      <div className="flex flex-col gap-4 max-w-sm">
        <p className="text-small text-foreground-secondary">
          Scan this QR code with your authenticator app, then enter the 6-digit code to verify.
        </p>
        <div className="p-4 rounded-xl border border-border-tertiary text-center">
          <img src={qrCodeData.qrCodeUri} alt="2FA QR Code" className="w-48 h-48 mx-auto" />
        </div>
        <div className="flex items-center gap-2">
          <Input
            label="Verification Code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="flex-1"
          />
          <Button
            variant="primary"
            loading={isLoading}
            onClick={() => onVerify(code)}
            disabled={code.length < 6}
            className="mt-auto"
          >
            Verify & Enable
          </Button>
        </div>
        <p className="text-meta text-foreground-secondary font-mono">{qrCodeData.secret}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-foreground-secondary">
        Protect your account with two-factor authentication using an authenticator app.
      </p>
      <Button variant="primary" loading={isLoading} onClick={onIntro}>
        Enable 2FA
      </Button>
    </div>
  );
}

function Disable2FASection({
  mutation,
  onConfirmOpen,
}: {
  mutation: ReturnType<typeof useDisable2FA>;
  onConfirmOpen: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-foreground-secondary">
        Two-factor authentication is currently enabled on your account.
      </p>
      <div className="flex items-center gap-2">
        <Icon name="icon-shield-check" size={18} className="text-foreground-success" />
        <span className="text-small font-medium text-foreground-success">2FA Active</span>
      </div>
      <Button variant="danger" onClick={onConfirmOpen}>
        Disable 2FA
      </Button>
    </div>
  );
}

function SessionsSection() {
  const { data: sessions, isLoading, refetch } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAll = useRevokeAllOtherSessions();

  if (isLoading) return <PageSkeleton />;

  const sessionList = sessions || [];

  return (
    <div className="flex flex-col gap-4">
      {sessionList.length === 0 ? (
        <p className="text-small text-foreground-secondary">No active sessions</p>
      ) : (
        <div className="space-y-2">
          {sessionList.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border-tertiary"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-small font-medium">
                    {session.browser} / {session.os}
                  </span>
                  {session.isCurrent && (
                    <span className="text-meta text-foreground-info font-medium">Current</span>
                  )}
                </div>
                <span className="text-small text-foreground-secondary">
                  Last active: {new Date(session.lastAccessedAt).toLocaleString()}
                </span>
              </div>
              {!session.isCurrent && (
                <Button
                  variant="ghost"
                  size="small"
                  loading={revokeSession.isPending}
                  onClick={() => {
                    revokeSession.mutate(session.id, {
                      onSuccess: () => toast.success('Session revoked'),
                      onError: (err) => toast.error(`Failed to revoke session: ${err.message}`),
                    });
                  }}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {sessionList.length > 1 && (
        <Button
          variant="default"
          loading={revokeAll.isPending}
          onClick={() => {
            revokeAll.mutate(undefined, {
              onSuccess: () => {
                toast.success('All other sessions revoked');
                refetch();
              },
              onError: (err) => toast.error(`Failed to revoke sessions: ${err.message}`),
            });
          }}
        >
          Revoke All Other Sessions
        </Button>
      )}
    </div>
  );
}