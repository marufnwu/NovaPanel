'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface TeamUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'team' | 'profile'>('team');
  const [members, setMembers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (tab === 'team') loadMembers();
  }, [tab]);

  async function loadMembers() {
    setLoading(true);
    try {
      const res = await api.get<{ ok: boolean; data: TeamUser[] }>('/settings/team');
      setMembers(res.data);
    } catch {
      // Settings endpoints may not exist yet
    } finally {
      setLoading(false);
    }
  }

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.post('/settings/team/invite', { email: inviteEmail, role: inviteRole });
      setSuccess(`Invited ${inviteEmail}`);
      setInviteEmail('');
      loadMembers();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function updateRole(userId: string, role: string) {
    try {
      await api.put(`/settings/team/${userId}`, { role });
      loadMembers();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function removeMember(userId: string) {
    if (!confirm('Remove this team member?')) return;
    try {
      await api.delete(`/settings/team/${userId}`);
      loadMembers();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Team management and preferences</p>
      </div>

      <div className="flex gap-1 border-b">
        {(['team', 'profile'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'team' ? 'Team' : 'Profile'}
          </button>
        ))}
      </div>

      {tab === 'team' && (
        <div className="space-y-4">
          {isAdmin && (
            <form onSubmit={inviteMember} className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="font-medium">Invite Team Member</h3>
              {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}
              <div className="flex gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="colleague@example.com"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Invite
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No team members found.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Role</th>
                    <th className="text-left p-3 font-medium">Joined</th>
                    {isAdmin && <th className="text-left p-3 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-muted/30">
                      <td className="p-3">{member.email}</td>
                      <td className="p-3">
                        {isAdmin && member.id !== user?.id ? (
                          <select
                            value={member.role}
                            onChange={(e) => updateRole(member.id, e.target.value)}
                            className="rounded border border-input bg-background px-2 py-1 text-xs"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className="capitalize rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{member.role}</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{new Date(member.createdAt).toLocaleDateString()}</td>
                      {isAdmin && (
                        <td className="p-3">
                          {member.id !== user?.id && (
                            <button onClick={() => removeMember(member.id)} className="text-xs text-muted-foreground hover:text-destructive">
                              Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'profile' && (
        <div className="max-w-lg space-y-4">
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-medium">Profile</h3>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input type="email" value={user?.email || ''} disabled className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Role</label>
              <input type="text" value={user?.role || ''} disabled className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm capitalize" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
