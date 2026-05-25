import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  useSiteEnvVars,
  useCreateEnvVar,
  useUpdateEnvVar,
  useDeleteEnvVar,
  type EnvVar,
} from '../../api/hooks/sites';
import { Icon } from '../icons';
import { toast } from '../../lib/toast';

interface EnvVarsEditorProps {
  siteId: string;
}

// Common environment variable patterns that are typically secrets
const SECRET_PATTERNS = [
  'password', 'secret', 'key', 'token', 'api_key', 'apikey',
  'private', 'credential', 'auth', 'jwt', 'bearer', 'access_key',
];

function isLikelySecret(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SECRET_PATTERNS.some(pattern => lowerKey.includes(pattern));
}

export function EnvVarsEditor({ siteId }: EnvVarsEditorProps) {
  const { data: envVars, isLoading, refetch } = useSiteEnvVars(siteId);
  const createEnvVar = useCreateEnvVar();
  const updateEnvVar = useUpdateEnvVar();
  const deleteEnvVar = useDeleteEnvVar();

  const [showAdd, setShowAdd] = useState(false);
  const [editingVar, setEditingVar] = useState<EnvVar | null>(null);
  const [deleteVarId, setDeleteVarId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // New/edit form state
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formIsSecret, setFormIsSecret] = useState(false);

  const toggleReveal = (id: string) => {
    const newRevealed = new Set(revealedIds);
    if (newRevealed.has(id)) {
      newRevealed.delete(id);
    } else {
      newRevealed.add(id);
    }
    setRevealedIds(newRevealed);
  };

  const openAddModal = () => {
    setFormKey('');
    setFormValue('');
    setFormIsSecret(false);
    setShowAdd(true);
  };

  const openEditModal = (envVar: EnvVar) => {
    setFormKey(envVar.key);
    setFormValue(envVar.value);
    setFormIsSecret(envVar.isSecret);
    setEditingVar(envVar);
  };

  const handleCreate = async () => {
    if (!formKey.trim()) {
      toast.error('Variable name is required');
      return;
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(formKey)) {
      toast.error('Variable name must start with a letter or underscore and contain only alphanumeric characters');
      return;
    }

    try {
      await createEnvVar.mutateAsync({
        siteId,
        key: formKey.trim(),
        value: formValue,
        isSecret: formIsSecret,
      });
      toast.success(`Environment variable "${formKey}" created`);
      setShowAdd(false);
    } catch (err: any) {
      toast.error(`Failed to create: ${err.message}`);
    }
  };

  const handleUpdate = async () => {
    if (!editingVar) return;

    try {
      await updateEnvVar.mutateAsync({
        siteId,
        envId: editingVar.id,
        key: formKey.trim(),
        value: formValue,
        isSecret: formIsSecret,
      });
      toast.success(`Environment variable "${formKey}" updated`);
      setEditingVar(null);
    } catch (err: any) {
      toast.error(`Failed to update: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteVarId) return;

    try {
      await deleteEnvVar.mutateAsync({ siteId, envId: deleteVarId });
      toast.success('Environment variable deleted');
      setDeleteVarId(null);
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
    }
  };

  const getSourceBadge = (source: EnvVar['source']) => {
    switch (source) {
      case 'env_file':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-foreground-tertiary/10 text-foreground-tertiary text-meta">.env file</span>;
      case 'database':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-foreground-success/10 text-foreground-success text-meta">Database</span>;
      case 'builtin':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-foreground-warning/10 text-foreground-warning text-meta">Built-in</span>;
      default:
        return null;
    }
  };

  const maskValue = (value: string, isSecret: boolean): string => {
    if (!isSecret) return value;
    if (value.length <= 4) return '••••••••';
    return value.substring(0, 2) + '••••••••' + value.substring(value.length - 2);
  };

  const formatKey = (key: string): string => {
    // Add common prefixes formatting
    if (key.startsWith('REACT_')) return key;
    if (key.startsWith('NEXT_')) return key;
    if (key.startsWith('NODE_')) return key;
    if (key.startsWith('APP_')) return key;
    if (key.startsWith('API_')) return key;
    return key;
  };

  if (isLoading) {
    return (
      <Card title="Environment Variables">
        <div className="flex items-center justify-center py-8">
          <span className="text-small text-foreground-tertiary">Loading environment variables...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card title="Environment Variables" action={
        <div className="flex gap-2">
          <Button size="small" variant="ghost" onClick={() => refetch()} icon={<Icon name="icon-refresh" size={15} />}>
            Refresh
          </Button>
          <Button size="small" onClick={openAddModal} icon={<Icon name="icon-plus" size={15} />}>
            Add Variable
          </Button>
        </div>
      }>
        {/* Info Banner */}
        <div className="mb-4 p-3 bg-background-secondary rounded-lg border border-border-tertiary">
          <div className="flex items-start gap-2">
            <Icon name="icon-info" size={16} className="text-foreground-tertiary mt-0.5 flex-shrink-0" />
            <div className="text-meta text-foreground-secondary">
              <span className="font-medium text-foreground-primary">Environment variables</span> control your application's behavior.
              Built-in variables cannot be modified. Set values are stored securely and masked by default.
            </div>
          </div>
        </div>

        {envVars && envVars.length > 0 ? (
          <div className="space-y-2">
            {envVars.map((envVar) => {
              const isRevealed = revealedIds.has(envVar.id);
              const shouldMask = envVar.isSecret || isLikelySecret(envVar.key);
              const canEdit = envVar.source !== 'builtin';

              return (
                <div
                  key={envVar.id}
                  className="flex items-center justify-between p-3 bg-background-secondary rounded-lg border border-border-tertiary hover:border-border-secondary transition-colors group"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Key */}
                    <div className="flex-shrink-0 w-[200px]">
                      <span className="font-mono text-small font-medium text-foreground-primary">
                        {formatKey(envVar.key)}
                      </span>
                    </div>

                    {/* Value */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-mono text-small text-foreground-secondary truncate">
                        {shouldMask && !isRevealed ? maskValue(envVar.value, envVar.isSecret) : envVar.value}
                      </span>
                      {shouldMask && (
                        <button
                          onClick={() => toggleReveal(envVar.id)}
                          className="flex-shrink-0 p-1 hover:bg-background-tertiary rounded transition-colors"
                          title={isRevealed ? 'Hide value' : 'Reveal value'}
                        >
                          <Icon
                            name={isRevealed ? 'icon-eye-off' : 'icon-eye'}
                            size={14}
                            className="text-foreground-tertiary"
                          />
                        </button>
                      )}
                    </div>

                    {/* Source Badge */}
                    {getSourceBadge(envVar.source)}
                  </div>

                  {/* Actions */}
                  {canEdit && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => openEditModal(envVar)}
                        icon={<Icon name="icon-edit" size={15} />}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => setDeleteVarId(envVar.id)}
                        icon={<Icon name="icon-trash" size={15} />}
                        className="text-foreground-danger hover:text-foreground-danger"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-background-tertiary mx-auto mb-4">
              <Icon name="icon-key" size={32} className="text-foreground-tertiary" />
            </div>
            <p className="text-small text-foreground-secondary mb-4">No environment variables configured</p>
            <Button onClick={openAddModal}>Add Variable</Button>
          </div>
        )}

        {/* Variable Count Summary */}
        {envVars && envVars.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border-tertiary flex items-center justify-between text-meta text-foreground-tertiary">
            <span>{envVars.filter(v => v.source === 'builtin').length} built-in variables</span>
            <span>{envVars.filter(v => v.source === 'database').length} custom variables</span>
          </div>
        )}
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Environment Variable"
        size="medium"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={createEnvVar.isPending}>Add Variable</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-small text-foreground-secondary mb-4">
            Add a new environment variable to configure your application.
          </p>
          <Input
            label="Variable Name"
            value={formKey}
            onChange={(e) => setFormKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
            placeholder="VARIABLE_NAME"
          />
          <Input
            label="Value"
            value={formValue}
            onChange={(e) => setFormValue(e.target.value)}
            placeholder="Variable value"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isSecret"
              checked={formIsSecret}
              onChange={(e) => setFormIsSecret(e.target.checked)}
              className="w-4 h-4 rounded border-border-secondary bg-background-primary accent-foreground-primary"
            />
            <label htmlFor="isSecret" className="text-small text-foreground-secondary cursor-pointer">
              Mark as sensitive value
            </label>
          </div>
          {formIsSecret && (
            <div className="p-3 bg-foreground-warning/10 rounded-md">
              <div className="text-meta text-foreground-warning">
                This value will be encrypted at rest and masked in the UI
              </div>
            </div>
          )}
          <div className="p-3 bg-background-tertiary rounded-md">
            <div className="text-meta text-foreground-tertiary">
              <span className="font-medium text-foreground-secondary">Tip:</span> Common patterns like API keys, passwords, and tokens are automatically detected as sensitive.
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingVar}
        onClose={() => setEditingVar(null)}
        title={`Edit ${formKey}`}
        size="medium"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingVar(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleUpdate} loading={updateEnvVar.isPending}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-small text-foreground-secondary mb-4">
            Update the value for environment variable <span className="font-mono font-medium">{formKey}</span>.
          </p>
          <Input
            label="Value"
            value={formValue}
            onChange={(e) => setFormValue(e.target.value)}
            placeholder="Variable value"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editIsSecret"
              checked={formIsSecret}
              onChange={(e) => setFormIsSecret(e.target.checked)}
              className="w-4 h-4 rounded border-border-secondary bg-background-primary accent-foreground-primary"
            />
            <label htmlFor="editIsSecret" className="text-small text-foreground-secondary cursor-pointer">
              Mark as sensitive value
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteVarId}
        onClose={() => setDeleteVarId(null)}
        onConfirm={handleDelete}
        title="Delete Environment Variable"
        description="This environment variable will be permanently deleted. This action cannot be undone."
        confirmText="Delete"
        impact="medium"
        loading={deleteEnvVar.isPending}
      />
    </div>
  );
}
