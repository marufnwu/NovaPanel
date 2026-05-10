import { Code2 } from 'lucide-react';

interface PhpVersionSelectorProps {
  value: string;
  versions: string[];
  onChange: (version: string) => void;
  disabled?: boolean;
}

export function PhpVersionSelector({ value, versions, onChange, disabled }: PhpVersionSelectorProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">PHP Version</label>
      <div className="flex items-center gap-2">
        <Code2 className="h-4 w-4 text-primary" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        >
          {versions.length === 0 ? (
            <option value="">No PHP versions installed</option>
          ) : (
            versions.map((v) => (
              <option key={v} value={v}>PHP {v}</option>
            ))
          )}
        </select>
      </div>
    </div>
  );
}