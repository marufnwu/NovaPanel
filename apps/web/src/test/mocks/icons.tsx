import { vi } from 'vitest';

vi.mock('@/components/icons', () => ({
  Icon: ({ name, size, className }: { name: string; size: number; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>{name}</span>
  ),
}));

export {};