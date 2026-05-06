import { useState, useEffect, useRef } from 'react';
import { useTunnelStatus, useTunnelRoutes, useSetupTunnel, useStartTunnel, useStopTunnel, useAddTunnelRoute, useDeleteTunnelRoute, useToggleTunnelRoute, useEditTunnelRoute, useDeleteTunnel, useTunnelInfo, useTunnelConfig, useValidateToken, useFetchZones, useTunnelLogs, useCreateDnsCname, useSyncTunnelRoutes, CloudflareTunnel, TunnelRoute, CloudflareZone } from '../../api/hooks/tunnel';
import { Link } from '@tanstack/react-router';
import { useDomains } from '../../api/hooks/domains';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Waypoints, Plus, Play, Square, Trash2, Globe, ToggleLeft, ToggleRight, Server, Check, AlertCircle, FileText, Activity, Edit, RefreshCw, ExternalLink, Zap, Info } from 'lucide-react';
import { toast } from '../../lib/toast';

type SetupStep = 'token' | 'zone' | 'name' | 'creating';

function SetupModal({ onClose }: { onClose: () => void }) {
  const validateToken = useValidateToken();
  const fetchZones = useFetchZones();
  const setup = useSetupTunnel();
  const [step, setStep] = useState<SetupStep>('token');
  const [form, setForm] = useState({ name: '', apiToken: '', accountId: '', zoneId: '' });
  const [validation, setValidation] = useState<{ valid?: boolean; email?: string; error?: string }>({});
  const [zones, setZones] = useState<CloudflareZone[]>([]);

  const handleValidateToken = async () => {
    if (!form.apiToken) return;
    
    validateToken.mutate(form.apiToken, {
      onSuccess: (data) => {
        setValidation({ valid: true, email: data.email });
        fetchZones.mutate({ apiToken: form.apiToken }, {
          onSuccess: (zones) => {
            setZones(zones);
            setStep('zone');
          },
          onError: () => {
            setValidation({ valid: true, email: data.email, error: 'Failed to fetch zones' });
            setStep('zone');
          }
        });
      },
      onError: (error: any) => {
        setValidation({ valid: false, error: error.message || 'Invalid token' });
      }
    });
  };

  const handleSelectZone = (zoneId: string) => {
    setForm({ ...form, zoneId });
    setStep('name');
  };

  const handleSubmit = () => {
    setStep('creating');
    setup.mutate(
      { name: form.name, apiToken: form.apiToken, zoneId: form.zoneId || undefined },
      {
        onSuccess: () => {
          toast.success('Tunnel created successfully');
          onClose();
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to create tunnel');
          setStep('name');
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Setup Cloudflare Tunnel</h2>
        
        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${step === 'token' ? 'bg-primary' : step === 'creating' ? 'bg-primary' : 'bg-primary'}`} />
            <span className="text-xs text-muted-foreground">Token</span>
          </div>
          <div className="h-px flex-1 bg-border" />
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${step === 'zone' || step === 'name' || step === 'creating' ? 'bg-primary' : 'bg-muted'}`} />
            <span className="text-xs text-muted-foreground">Zone</span>
          </div>
          <div className="h-px flex-1 bg-border" />
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${step === 'name' || step === 'creating' ? 'bg-primary' : 'bg-muted'}`} />
            <span className="text-xs text-muted-foreground">Name</span>
          </div>
        </div>

        {step === 'token' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Cloudflare API Token</label>
              <input
                type="password"
                value={form.apiToken}
                onChange={(e) => setForm({ ...form, apiToken: e.target.value })}
                placeholder="cf_xxxxxxxxxxxxx"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">Token needs Account - Cloudflare Tunnel - Edit and Zone - DNS - Edit permissions</p>
            </div>
            {validation.error && (
              <div className="flex items-center gap-2 rounded-md bg-red-500/10 p-3 text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{validation.error}</span>
              </div>
            )}
            {validation.valid && validation.email && (
              <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-green-500">
                <Check className="h-4 w-4" />
                <span className="text-sm">Valid token for {validation.email}</span>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button
                onClick={handleValidateToken}
                disabled={!form.apiToken || validateToken.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {validateToken.isPending ? 'Validating...' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {step === 'zone' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Select a zone (domain) from your Cloudflare account. You can skip this if you don't need DNS management.</p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {zones.map(zone => (
                <button
                  key={zone.id}
                  onClick={() => handleSelectZone(zone.id)}
                  className="w-full rounded-md border border-border p-3 text-left hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{zone.name}</p>
                      <p className="text-xs text-muted-foreground">{zone.status}</p>
                    </div>
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setForm({ ...form, zoneId: '' }); setStep('name'); }} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Skip (optional)</button>
              <button onClick={() => setStep('token')} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Back</button>
            </div>
          </div>
        )}

        {step === 'name' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Tunnel Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="my-server-tunnel"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">A unique name for this tunnel</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setStep('zone')} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Back</button>
              <button
                onClick={handleSubmit}
                disabled={!form.name || setup.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {setup.isPending ? 'Creating...' : 'Create Tunnel'}
              </button>
            </div>
          </div>
        )}

        {step === 'creating' && (
          <div className="flex flex-col items-center py-8">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-muted-foreground">Creating tunnel and installing service...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AddRouteModal({ tunnel, onClose }: { tunnel: CloudflareTunnel; onClose: () => void }) {
  const addRoute = useAddTunnelRoute();
  const [form, setForm] = useState({ hostname: '', service: 'http://localhost:8080', noTlsVerify: false });

  const presets = [
    { label: 'HTTP', value: 'http://localhost:80' },
    { label: 'HTTPS', value: 'https://localhost:443' },
    { label: 'Custom', value: '' },
  ];

  const handleSubmit = () => {
    addRoute.mutate(
      { tunnelId: tunnel.id, hostname: form.hostname, service: form.service, noTlsVerify: form.noTlsVerify },
      {
        onSuccess: () => {
          // DNS CNAME is auto-created by the backend
          toast.success('Route added successfully');
          onClose();
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to add route');
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Add Tunnel Route</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Public Hostname</label>
            <input
              value={form.hostname}
              onChange={(e) => setForm({ ...form, hostname: e.target.value })}
              placeholder="ssh.example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">The public hostname for this route</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Service URL</label>
            <div className="flex gap-2 mb-2">
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => p.value && setForm({ ...form, service: p.value })}
                  className={`rounded px-2 py-1 text-xs ${form.service === p.value ? 'bg-primary text-primary-foreground' : 'bg-accent'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              value={form.service}
              onChange={(e) => setForm({ ...form, service: e.target.value })}
              placeholder="http://localhost:8080"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.noTlsVerify}
              onChange={(e) => setForm({ ...form, noTlsVerify: e.target.checked })}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
            />
            <span className="text-sm">Skip TLS verification (for self-signed certs)</span>
          </label>
          <p className="text-xs text-muted-foreground">DNS CNAME record is auto-created when route is added</p>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!form.hostname || !form.service || addRoute.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {addRoute.isPending ? 'Adding...' : 'Add Route'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditRouteModal({ route, onClose }: { route: TunnelRoute; onClose: () => void }) {
  const editRoute = useEditTunnelRoute();
  const [form, setForm] = useState({ 
    hostname: route.hostname, 
    service: route.service,
    noTlsVerify: route.noTlsVerify ?? false 
  });

  const handleSubmit = () => {
    editRoute.mutate(
      { routeId: route.id, hostname: form.hostname, service: form.service, noTlsVerify: form.noTlsVerify },
      {
        onSuccess: () => {
          toast.success('Route updated successfully');
          onClose();
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to update route');
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Edit Tunnel Route</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Public Hostname</label>
            <input
              value={form.hostname}
              onChange={(e) => setForm({ ...form, hostname: e.target.value })}
              placeholder="ssh.example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Service URL</label>
            <input
              value={form.service}
              onChange={(e) => setForm({ ...form, service: e.target.value })}
              placeholder="http://localhost:8080"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="noTlsVerify"
              checked={form.noTlsVerify}
              onChange={(e) => setForm({ ...form, noTlsVerify: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="noTlsVerify" className="text-sm font-medium">Skip TLS verification (for self-signed certs)</label>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!form.hostname || !form.service || editRoute.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {editRoute.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigPreviewModal({ tunnel, onClose }: { tunnel: CloudflareTunnel; onClose: () => void }) {
  const { data: config, isLoading } = useTunnelConfig(tunnel.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tunnel Configuration</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <Plus className="h-4 w-4 rotate-45" />
          </button>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="rounded-md bg-muted p-4">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{config || 'No configuration available'}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteTunnelModal({ tunnel, onClose }: { tunnel: CloudflareTunnel; onClose: () => void }) {
  const deleteTunnel = useDeleteTunnel();

  const handleDelete = () => {
    deleteTunnel.mutate(tunnel.id, {
      onSuccess: () => {
        toast.success('Tunnel deleted successfully');
        onClose();
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to delete tunnel');
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
        <div className="mb-4">
          <h2 className="mb-2 text-lg font-semibold">Delete Tunnel</h2>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete tunnel <span className="font-medium">{tunnel.name}</span>?
            This action cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            onClick={handleDelete}
            disabled={deleteTunnel.isPending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleteTunnel.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncRoutesButton({ tunnelId }: { tunnelId: string }) {
  const syncRoutes = useSyncTunnelRoutes();

  const handleSync = () => {
    syncRoutes.mutate(tunnelId, {
      onSuccess: (data) => {
        if (data.synced > 0) {
          toast.success(`Synced ${data.synced} route(s) from Cloudflare`);
        } else {
          toast.info('Routes are already in sync');
        }
      },
      onError: (error: any) => toast.error(error.message || 'Failed to sync routes'),
    });
  };

  return (
    <button
      onClick={handleSync}
      disabled={syncRoutes.isPending}
      className="flex items-center gap-1 rounded bg-accent px-2 py-1 text-xs hover:bg-accent/80 disabled:opacity-50"
      title="Sync routes from Cloudflare"
    >
      <RefreshCw className={`h-3 w-3 ${syncRoutes.isPending ? 'animate-spin' : ''}`} /> Sync
    </button>
  );
}

function TunnelCard({ tunnel, routes, onAddRoute, onToggle, onDelete, onEditRoute, onShowConfig, onDeleteTunnel }: {
  tunnel: CloudflareTunnel;
  routes: TunnelRoute[];
  onAddRoute: () => void;
  onToggle: (routeId: string) => void;
  onDelete: (routeId: string) => void;
  onEditRoute: (route: TunnelRoute) => void;
  onShowConfig: () => void;
  onDeleteTunnel: () => void;
}) {
  const start = useStartTunnel();
  const stop = useStopTunnel();
  const { data: tunnelInfo } = useTunnelInfo(tunnel.id);
  const { logs, isConnected: logsConnected, error: logsError } = useTunnelLogs(tunnel.id);
  const [showLogs, setShowLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const isRunning = tunnel.status === 'active';

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Waypoints className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{tunnel.name}</h3>
            <p className="text-xs text-muted-foreground">ID: {tunnel.tunnelId.slice(0, 8)}...</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isRunning && (
            <div className="flex items-center gap-1 text-xs text-green-500">
              <Activity className="h-3 w-3" />
              <span>{tunnelInfo?.connections?.length || 0} conn</span>
            </div>
          )}
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isRunning ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {isRunning ? 'Running' : 'Stopped'}
          </span>
          <button
            onClick={onShowConfig}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent"
            title="View configuration"
          >
            <FileText className="h-4 w-4" />
          </button>
          {isRunning ? (
            <button
              onClick={() => stop.mutate(undefined, { onError: (error: any) => toast.error(error.message || 'Failed to stop tunnel') })}
              disabled={stop.isPending}
              className="rounded p-1.5 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
              title="Stop tunnel"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => start.mutate(undefined, { onError: (error: any) => toast.error(error.message || 'Failed to start tunnel') })}
              disabled={start.isPending}
              className="rounded p-1.5 text-green-500 hover:bg-green-500/10 disabled:opacity-50"
              title="Start tunnel"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onDeleteTunnel}
            className="rounded p-1.5 text-red-500 hover:bg-red-500/10"
            title="Delete tunnel"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Routes ({routes.length})
          </h4>
          <div className="flex items-center gap-2">
            <SyncRoutesButton tunnelId={tunnel.id} />
            <button
              onClick={onAddRoute}
              disabled={!isRunning}
              className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
        </div>

        {routes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No routes configured</p>
        ) : (
          <div className="space-y-2">
            {routes.map(route => (
              <div key={route.id} className="flex items-center justify-between rounded-md border border-border p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{route.hostname}</p>
                  <p className="text-xs text-muted-foreground truncate">{route.service}</p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => onEditRoute(route)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent"
                    title="Edit route"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onToggle(route.id)}
                    className={`rounded p-1 ${route.isActive ? 'text-green-500 hover:bg-green-500/10' : 'text-muted-foreground hover:bg-accent'}`}
                    title={route.isActive ? 'Disable route' : 'Enable route'}
                  >
                    {route.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => onDelete(route.id)}
                    className="rounded p-1 text-red-500 hover:bg-red-500/10"
                    title="Delete route"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isRunning && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Live Logs
            </h4>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center gap-1 rounded bg-accent px-2 py-1 text-xs hover:bg-accent/80"
            >
              {showLogs ? 'Hide' : 'Show'}
            </button>
          </div>

          {showLogs && (
            <div className="rounded-md bg-muted p-4">
              {logsError ? (
                <div className="flex items-center gap-2 text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{logsError}</span>
                </div>
              ) : (
                <div
                  ref={logsEndRef}
                  className="max-h-48 overflow-y-auto rounded bg-background p-3 font-mono text-xs"
                >
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground">Waiting for logs...</p>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className="py-0.5">
                        <span className="text-muted-foreground">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                        <span>{log.data}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <div className={`h-2 w-2 rounded-full ${logsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>{logsConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Expose Panel via Tunnel Modal ---
function ExposePanelModal({ tunnel, onClose }: { tunnel: CloudflareTunnel; onClose: () => void }) {
  const addRoute = useAddTunnelRoute();
  const [hostname, setHostname] = useState('');

  const handleSubmit = () => {
    if (!hostname.trim()) return;
    addRoute.mutate(
      { tunnelId: tunnel.id, hostname, service: 'http://localhost:8443' },
      {
        onSuccess: () => {
          toast.success('Panel exposed successfully');
          onClose();
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to expose panel');
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Expose Panel via Tunnel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a route to expose the NovaPanel web interface through this tunnel.
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Public Hostname</label>
            <input
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="panel.example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              This hostname will route to <span className="font-mono">localhost:8443</span> (NovaPanel)
            </p>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4 text-primary" />
              <span>Target: <span className="font-mono">http://localhost:8443</span></span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-1">
              <Globe className="h-4 w-4 text-primary" />
              <span>Tunnel: {tunnel.name}</span>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!hostname.trim() || addRoute.isPending}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4" />
            {addRoute.isPending ? 'Creating...' : 'Expose Panel'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TunnelsPage() {
  const { data: status, isLoading, isError, refetch } = useTunnelStatus();
  const { data: routes } = useTunnelRoutes();
  const { data: domains } = useDomains();
  const toggleRoute = useToggleTunnelRoute();
  const deleteRoute = useDeleteTunnelRoute();
  const addRoute = useAddTunnelRoute();
  const [showSetup, setShowSetup] = useState(false);
  const [showAddRoute, setShowAddRoute] = useState<CloudflareTunnel | null>(null);
  const [showEditRoute, setShowEditRoute] = useState<TunnelRoute | null>(null);
  const [showConfig, setShowConfig] = useState<CloudflareTunnel | null>(null);
  const [showDeleteTunnel, setShowDeleteTunnel] = useState<CloudflareTunnel | null>(null);
  const [showExposePanel, setShowExposePanel] = useState<CloudflareTunnel | null>(null);

  if (isLoading) return <LoadingSpinner />;

  if (isError) return (
    <div>
      <PageHeader title="Cloudflare Tunnels" description="Manage Cloudflare tunnel connections for private network access" />
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
        <p className="mt-3 text-red-600 dark:text-red-400">Failed to load tunnel status. Please try again.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  );

  const tunnels = status?.tunnels || [];
  const activeTunnel = tunnels.find((t) => t.status === 'active');

  const handleExposeDomain = (domainName: string) => {
    if (!activeTunnel) return;
    // Check if domain has SSL enabled and use HTTPS if so
    const domain = domains?.find(d => d.name === domainName);
    const service = domain?.sslEnabled ? 'https://localhost:443' : 'http://localhost:80';
    const noTlsVerify = domain?.sslEnabled ?? false;
    addRoute.mutate(
      {
        tunnelId: activeTunnel.id,
        hostname: domainName,
        service,
        noTlsVerify,
        domainId: domain?.id,
      },
      {
        onError: (error: any) => toast.error(error.message || 'Failed to expose domain'),
      }
    );
  };

  return (
    <div>
      <PageHeader title="Cloudflare Tunnels" description="Manage Cloudflare tunnel connections for private network access" actions={
        <div className="flex gap-2">
          {activeTunnel && (
            <button
              onClick={() => setShowExposePanel(activeTunnel)}
              className="flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <Zap className="h-4 w-4" /> Expose Panel
            </button>
          )}
          <button
            onClick={() => setShowSetup(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Setup Tunnel
          </button>
        </div>
      } />

      {tunnels.length === 0 ? (
        <EmptyState
          icon={Waypoints}
          title="No tunnels configured"
          description="Setup a Cloudflare tunnel to expose your local services via Cloudflare's network."
          action={<button onClick={() => setShowSetup(true)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Setup Tunnel</button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tunnels.map(tunnel => (
            <TunnelCard
              key={tunnel.id}
              tunnel={tunnel}
              routes={routes?.filter(r => r.tunnelId === tunnel.id) || []}
              onAddRoute={() => setShowAddRoute(tunnel)}
              onToggle={(routeId) => toggleRoute.mutate(routeId, { onError: (error: any) => toast.error(error.message || 'Failed to toggle route') })}
              onDelete={(routeId) => deleteRoute.mutate(routeId, { onError: (error: any) => toast.error(error.message || 'Failed to delete route') })}
              onEditRoute={(route) => setShowEditRoute(route)}
              onShowConfig={() => setShowConfig(tunnel)}
              onDeleteTunnel={() => setShowDeleteTunnel(tunnel)}
            />
          ))}
        </div>
      )}

      {/* Quick Expose Domains Preview (shown when no tunnel is configured) */}
      {tunnels.length === 0 && domains && domains.length > 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Quick Expose Domains Preview</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Once you set up a Cloudflare Tunnel, you'll be able to quickly expose your domains to the internet.
              </p>
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Domains that can be exposed:</p>
                {domains.slice(0, 5).map((domain) => (
                  <div key={domain.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{domain.name}</span>
                  </div>
                ))}
                {domains.length > 5 && (
                  <p className="text-xs text-muted-foreground">and {domains.length - 5} more...</p>
                )}
              </div>
              <button
                onClick={() => setShowSetup(true)}
                className="mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Waypoints className="h-4 w-4" /> Create Tunnel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Expose Domains Section */}
      {activeTunnel && domains && domains.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Globe className="h-5 w-5 text-primary" /> Quick Expose Domains
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Create tunnel routes for your domains with one click via tunnel <span className="font-medium">{activeTunnel.name}</span>.
          </p>
          <div className="space-y-2">
            {domains.map((domain) => {
              const existingRoute = routes?.find((r) => r.hostname === domain.name);
              return (
                <div key={domain.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{domain.name}</p>
                      <p className="text-xs text-muted-foreground">{domain.documentRoot}</p>
                    </div>
                  </div>
                  {existingRoute ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600">
                      <Check className="h-3 w-3" /> Exposed
                    </span>
                  ) : (
                    <button
                      onClick={() => handleExposeDomain(domain.name)}
                      disabled={addRoute.isPending}
                      className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Expose via Tunnel
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showSetup && <SetupModal onClose={() => setShowSetup(false)} />}
      {showAddRoute && <AddRouteModal tunnel={showAddRoute} onClose={() => setShowAddRoute(null)} />}
      {showEditRoute && <EditRouteModal route={showEditRoute} onClose={() => setShowEditRoute(null)} />}
      {showConfig && <ConfigPreviewModal tunnel={showConfig} onClose={() => setShowConfig(null)} />}
      {showDeleteTunnel && <DeleteTunnelModal tunnel={showDeleteTunnel} onClose={() => setShowDeleteTunnel(null)} />}
      {showExposePanel && <ExposePanelModal tunnel={showExposePanel} onClose={() => setShowExposePanel(null)} />}
    </div>
  );
}
