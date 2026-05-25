import { useState, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

interface CronBuilderProps {
  value: string;
  onChange: (cron: string) => void;
  error?: string;
}

// Common cron presets
const PRESETS = [
  { label: 'Hourly', cron: '0 * * * *', description: 'Every hour at minute 0' },
  { label: 'Daily (Midnight)', cron: '0 0 * * *', description: 'Every day at midnight' },
  { label: 'Daily (2 AM)', cron: '0 2 * * *', description: 'Every day at 2:00 AM' },
  { label: 'Weekly (Sunday)', cron: '0 0 * * 0', description: 'Every Sunday at midnight' },
  { label: 'Weekly (Monday)', cron: '0 0 * * 1', description: 'Every Monday at midnight' },
  { label: 'Monthly', cron: '0 0 1 * *', description: 'First day of every month' },
  { label: 'Quarterly', cron: '0 0 1 */3 *', description: 'First day of every quarter' },
];

// Day names for display
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parse a simple cron expression and return human-readable description
 */
function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return 'Invalid cron expression';

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Handle common patterns
  if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every hour';
  }
  if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every day at midnight';
  }
  if (minute === '0' && hour === '2' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every day at 2:00 AM';
  }
  if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '0') {
    return 'Every Sunday at midnight';
  }
  if (minute === '0' && hour === '0' && dayOfMonth === '1' && month === '*' && dayOfWeek === '*') {
    return 'First day of every month at midnight';
  }

  // Build description dynamically
  const descriptions: string[] = [];

  if (minute !== '*') descriptions.push(`minute ${minute}`);
  if (hour !== '*') descriptions.push(`hour ${hour}`);
  if (dayOfMonth !== '*') descriptions.push(`day ${dayOfMonth}`);
  if (month !== '*') descriptions.push(`month ${month}`);
  if (dayOfWeek !== '*') {
    const dayNum = parseInt(dayOfWeek, 10);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      descriptions.push(`${DAY_NAMES[dayNum]}`);
    } else {
      descriptions.push(`weekday ${dayOfWeek}`);
    }
  }

  return descriptions.length > 0 ? `At ${descriptions.join(', ')}` : 'Every minute';
}

/**
 * Calculate next N run times from a cron expression
 */
function getNextRuns(cron: string, count: number = 5): Date[] {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return [];

  const [minuteStr, hourStr, dayOfMonthStr, monthStr, dayOfWeekStr] = parts;
  const runs: Date[] = [];
  const now = new Date();
  let current = new Date(now);
  current.setSeconds(0);
  current.setMilliseconds(0);

  // Simple approximation: just add hours/days based on what's specified
  // This is a simplified version - a full cron parser would be more accurate
  const maxIterations = 365 * 2; // Safety limit

  for (let i = 0; i < maxIterations && runs.length < count; i++) {
    current = new Date(current.getTime() + 60 * 1000); // Add 1 minute

    const minute = current.getMinutes();
    const hour = current.getHours();
    const dayOfMonth = current.getDate();
    const month = current.getMonth() + 1;
    const dayOfWeek = current.getDay();

    // Check each field
    const minuteMatch = minuteStr === '*' || minute === parseInt(minuteStr, 10);
    const hourMatch = hourStr === '*' || hour === parseInt(hourStr, 10);
    const dayOfMonthMatch = dayOfMonthStr === '*' || dayOfMonth === parseInt(dayOfMonthStr, 10);
    const monthMatch = monthStr === '*' || month === parseInt(monthStr, 10);
    const dayOfWeekMatch = dayOfWeekStr === '*' || dayOfWeek === parseInt(dayOfWeekStr, 10);

    if (minuteMatch && hourMatch && dayOfMonthMatch && monthMatch && dayOfWeekMatch) {
      runs.push(new Date(current));
      current = new Date(current.getTime() + 60 * 1000); // Move past this match
    }
  }

  return runs;
}

export function CronBuilder({ value, onChange, error }: CronBuilderProps) {
  const [localValue, setLocalValue] = useState(value || '0 2 * * *');

  const handlePresetSelect = (cron: string) => {
    setLocalValue(cron);
    onChange(cron);
  };

  const handleInputChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  const description = useMemo(() => describeCron(localValue), [localValue]);
  const nextRuns = useMemo(() => getNextRuns(localValue, 5), [localValue]);

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div>
        <label className="text-meta font-medium block mb-2">Quick Presets</label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.cron}
              type="button"
              onClick={() => handlePresetSelect(preset.cron)}
              className={`px-3 py-1.5 text-small rounded-md border transition-colors ${
                localValue === preset.cron
                  ? 'bg-background-secondary border-foreground-info text-foreground-primary'
                  : 'bg-background-primary border-border-tertiary text-foreground-secondary hover:border-foreground-info'
              }`}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cron Expression Input */}
      <Input
        label="Cron Expression"
        value={localValue}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder="* * * * *"
        error={error}
      />

      {/* Human-readable description */}
      <div className="px-3 py-2 bg-background-secondary rounded-md">
        <span className="text-small text-foreground-secondary">
          <span className="font-medium">Schedule:</span> {description}
        </span>
      </div>

      {/* Next run times */}
      {nextRuns.length > 0 && (
        <div>
          <label className="text-meta font-medium block mb-2">Next 5 Runs</label>
          <div className="space-y-1">
            {nextRuns.map((run, idx) => (
              <div key={idx} className="text-small text-foreground-secondary font-mono">
                {run.toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="text-meta text-foreground-tertiary">
        <p>Format: minute hour day-of-month month day-of-week</p>
        <p className="mt-1">
          Examples: <code className="px-1 bg-background-secondary rounded">0 * * * *</code> (hourly) ·{' '}
          <code className="px-1 bg-background-secondary rounded">0 2 * * *</code> (daily at 2 AM) ·{' '}
          <code className="px-1 bg-background-secondary rounded">0 0 * * 0</code> (weekly on Sunday)
        </p>
      </div>
    </div>
  );
}

export { describeCron, getNextRuns };