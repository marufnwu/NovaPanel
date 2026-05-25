import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useChmod } from '../../api/hooks/files';
import { toast } from '../../lib/toast';

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  currentPermissions: string;
  onSave?: () => void;
}

interface PermissionBits {
  owner: { read: boolean; write: boolean; execute: boolean };
  group: { read: boolean; write: boolean; execute: boolean };
  other: { read: boolean; write: boolean; execute: boolean };
}

function octalToBits(octal: string): PermissionBits {
  const perms = octal.replace(/^0+/, '') || '0';
  const bits: PermissionBits = {
    owner: { read: false, write: false, execute: false },
    group: { read: false, write: false, execute: false },
    other: { read: false, write: false, execute: false },
  };

  if (perms.length >= 1) {
    const o = parseInt(perms[perms.length - 1] || '0', 10);
    bits.owner.read = (o & 4) !== 0;
    bits.owner.write = (o & 2) !== 0;
    bits.owner.execute = (o & 1) !== 0;
  }
  if (perms.length >= 2) {
    const g = parseInt(perms[perms.length - 2] || '0', 10);
    bits.group.read = (g & 4) !== 0;
    bits.group.write = (g & 2) !== 0;
    bits.group.execute = (g & 1) !== 0;
  }
  if (perms.length >= 3) {
    const t = parseInt(perms[perms.length - 3] || '0', 10);
    bits.other.read = (t & 4) !== 0;
    bits.other.write = (t & 2) !== 0;
    bits.other.execute = (t & 1) !== 0;
  }

  return bits;
}

function bitsToOctal(bits: PermissionBits): string {
  const owner = (bits.owner.read ? 4 : 0) + (bits.owner.write ? 2 : 0) + (bits.owner.execute ? 1 : 0);
  const group = (bits.group.read ? 4 : 0) + (bits.group.write ? 2 : 0) + (bits.group.execute ? 1 : 0);
  const other = (bits.other.read ? 4 : 0) + (bits.other.write ? 2 : 0) + (bits.other.execute ? 1 : 0);
  return `${owner}${group}${other}`;
}

export function PermissionsModal({
  isOpen,
  onClose,
  filePath,
  currentPermissions,
  onSave,
}: PermissionsModalProps) {
  const [bits, setBits] = useState<PermissionBits>(octalToBits(currentPermissions));
  const [octalInput, setOctalInput] = useState('');

  const chmod = useChmod();

  useEffect(() => {
    const octal = currentPermissions.replace(/^0+/, '') || '0';
    setBits(octalToBits(octal));
    setOctalInput(octal);
  }, [currentPermissions, isOpen]);

  const handleBitChange = (
    entity: 'owner' | 'group' | 'other',
    permission: 'read' | 'write' | 'execute',
    value: boolean
  ) => {
    setBits(prev => ({
      ...prev,
      [entity]: {
        ...prev[entity],
        [permission]: value,
      },
    }));
    const newOctal = bitsToOctal({
      ...bits,
      [entity]: {
        ...bits[entity],
        [permission]: value,
      },
    });
    setOctalInput(newOctal);
  };

  const handleOctalChange = (value: string) => {
    // Only allow digits 0-7
    const cleaned = value.replace(/[^0-7]/g, '').slice(0, 3);
    setOctalInput(cleaned);

    if (cleaned.length > 0 && /^[0-7]{1,3}$/.test(cleaned)) {
      setBits(octalToBits(cleaned));
    }
  };

  const handleSave = async () => {
    const mode = octalInput || bitsToOctal(bits);
    if (!mode || mode.length < 3) {
      toast.error('Invalid permissions');
      return;
    }

    try {
      await chmod.mutateAsync({
        path: filePath,
        mode,
      });
      toast.success('Permissions updated');
      onSave?.();
      onClose();
    } catch (err: any) {
      toast.error(`Failed to update permissions: ${err.message}`);
    }
  };

  const fileName = filePath.split('/').pop() || filePath;
  const currentOctal = octalInput || bitsToOctal(bits);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Permissions: ${fileName}`}
      size="medium"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={chmod.isPending}
          >
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Current permissions display */}
        <div className="text-meta text-foreground-secondary">
          Current: <span className="font-mono">{currentPermissions}</span>
        </div>

        {/* Octal input */}
        <div>
          <label className="text-meta font-medium block mb-2">Numeric (Octal)</label>
          <Input
            value={octalInput}
            onChange={(e) => handleOctalChange(e.target.value)}
            placeholder="755"
            maxLength={3}
            className="font-mono w-24"
          />
        </div>

        {/* Permission checkboxes */}
        <div className="space-y-3">
          <label className="text-meta font-medium block">Symbolic</label>
          <div className="border border-border-tertiary rounded-lg overflow-hidden">
            <table className="w-full text-small">
              <thead>
                <tr className="bg-background-secondary border-b border-border-tertiary">
                  <th className="text-left px-3 py-2 text-foreground-secondary font-medium">Entity</th>
                  <th className="text-center px-3 py-2 text-foreground-secondary font-medium">Read</th>
                  <th className="text-center px-3 py-2 text-foreground-secondary font-medium">Write</th>
                  <th className="text-center px-3 py-2 text-foreground-secondary font-medium">Execute</th>
                </tr>
              </thead>
              <tbody>
                {(['owner', 'group', 'other'] as const).map((entity) => (
                  <tr key={entity} className="border-b border-border-tertiary last:border-0">
                    <td className="px-3 py-2 capitalize text-foreground-primary font-medium">
                      {entity}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={bits[entity].read}
                        onChange={(e) => handleBitChange(entity, 'read', e.target.checked)}
                        className="w-4 h-4 rounded border-border-tertiary bg-background-primary text-foreground-info focus:ring-foreground-info/50"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={bits[entity].write}
                        onChange={(e) => handleBitChange(entity, 'write', e.target.checked)}
                        className="w-4 h-4 rounded border-border-tertiary bg-background-primary text-foreground-info focus:ring-foreground-info/50"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={bits[entity].execute}
                        onChange={(e) => handleBitChange(entity, 'execute', e.target.checked)}
                        className="w-4 h-4 rounded border-border-tertiary bg-background-primary text-foreground-info focus:ring-foreground-info/50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Command preview */}
        <div className="bg-background-secondary rounded-lg p-3 space-y-1">
          <div className="text-meta text-foreground-secondary">Command preview</div>
          <code className="text-small text-foreground-primary font-mono">
            chmod {currentOctal} {filePath}
          </code>
        </div>
      </div>
    </Modal>
  );
}