'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';

interface SshKey {
  id: string;
  name: string;
  fingerprint: string;
}

export default function NewServerPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<'key' | 'password'>('password');
  const [password, setPassword] = useState('');
  const [sshKeyId, setSshKeyId] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const [sshKeys, setSshKeys] = useState<SshKey[]>([]);

  // Load SSH keys on mount if authType is key
  useState(() => {
    if (authType === 'key') {
      api.get<SshKey[]>('/ssh-keys').then(setSshKeys).catch(() => {});
    }
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const server = await api.post<{ id: string }>('/servers', {
        name,
        host,
        port: parseInt(port),
        username,
        authType,
        sshKeyId: authType === 'key' ? sshKeyId : undefined,
        password: authType === 'password' ? password : undefined,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      });
      router.push(`/servers/${server.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSshKeys() {
    try {
      const keys = await api.get<SshKey[]>('/ssh-keys');
      setSshKeys(keys);
    } catch {
      // ignore
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add Server</h1>
        <p className="text-muted-foreground mt-1">Connect a new server via SSH</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div>
          <label className="block text-sm font-medium mb-1.5">Server Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Production Web"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1.5">Host / IP</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="192.168.1.100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="root"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Authentication</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="authType" checked={authType === 'password'} onChange={() => setAuthType('password')} />
              Password
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="authType" checked={authType === 'key'} onChange={() => { setAuthType('key'); loadSshKeys(); }} />
              SSH Key
            </label>
          </div>
        </div>

        {authType === 'password' ? (
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1.5">SSH Key</label>
            <select
              value={sshKeyId}
              onChange={(e) => setSshKeyId(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select an SSH key...</option>
              {sshKeys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.name} ({key.fingerprint.slice(0, 20)}...)
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">Tags (comma-separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="production, web"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Server'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
