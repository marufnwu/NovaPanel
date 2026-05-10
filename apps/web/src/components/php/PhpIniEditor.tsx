import { useState } from 'react';
import { Code2, Save, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { usePhpIni, useUpdatePhpIni } from '../../api/hooks/php';

interface PhpIniEditorProps {
  domainId: string;
}

export function PhpIniEditor({ domainId }: PhpIniEditorProps) {
  const { data: iniData, isLoading } = usePhpIni(domainId);
  const updateIni = useUpdatePhpIni();
  const [directives, setDirectives] = useState<{ key: string; value: string }[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  // Initialize directives from fetched data
  if (iniData && !initialized) {
    const parsed = iniData.directives && iniData.directives.length > 0
      ? iniData.directives
      : parseIniContent(iniData.content);
    setDirectives(parsed);
    setInitialized(true);
  }

  const handleSave = () => {
    const content = directives
      .filter((d) => d.key.trim())
      .map((d) => `${d.key} = ${d.value}`)
      .join('\n');
    updateIni.mutate({ domainId, content });
  };

  const addDirective = () => {
    if (!newKey.trim()) return;
    setDirectives([...directives, { key: newKey.trim(), value: newValue }]);
    setNewKey('');
    setNewValue('');
  };

  const removeDirective = (index: number) => {
    setDirectives(directives.filter((_, i) => i !== index));
  };

  const updateDirective = (index: number, field: 'key' | 'value', val: string) => {
    setDirectives(directives.map((d, i) => (i === index ? { ...d, [field]: val } : d)));
  };

  if (isLoading) return <div className="flex h-32 items-center justify-center">Loading...</div>;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-3 font-semibold flex items-center gap-2">
        <Code2 className="h-4 w-4" /> Custom php.ini Directives
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Add custom PHP directives for this domain. These override the default PHP configuration.
      </p>

      {/* Existing directives */}
      {directives.length > 0 && (
        <div className="mb-4 rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Directive</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Value</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {directives.map((d, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <input
                      value={d.key}
                      onChange={(e) => updateDirective(i, 'key', e.target.value)}
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-xs hover:border-input focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={d.value}
                      onChange={(e) => updateDirective(i, 'value', e.target.value)}
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-xs hover:border-input focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removeDirective(i)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add new directive */}
      <div className="flex gap-2 mb-4">
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="directive_name"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none"
        />
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="value"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none"
        />
        <button
          onClick={addDirective}
          disabled={!newKey.trim()}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <button
        onClick={handleSave}
        disabled={updateIni.isPending}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <Save className="h-4 w-4" /> {updateIni.isPending ? 'Saving...' : 'Save php.ini'}
      </button>
      {updateIni.isSuccess && (
        <span className="ml-3 inline-flex items-center gap-1 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" /> Saved
        </span>
      )}
    </div>
  );
}

function parseIniContent(content: string): { key: string; value: string }[] {
  if (!content) return [];
  return content
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith(';') && !line.trim().startsWith('#'))
    .map((line) => {
      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) return null;
      return { key: line.slice(0, eqIndex).trim(), value: line.slice(eqIndex + 1).trim() };
    })
    .filter((d): d is { key: string; value: string } => d !== null);
}