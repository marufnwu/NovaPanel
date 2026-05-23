import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn (classname utility)', () => {
  it('merges class names with clsx', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('merges tailwind classes with tailwind-merge', () => {
    const result = cn('px-2 py-1', 'px-4 py-2');
    expect(result).toBe('px-4 py-2');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    const result = cn('base-class', isActive && 'active-class');
    expect(result).toBe('base-class active-class');
  });

  it('returns empty string for no inputs', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('handles undefined inputs', () => {
    const result = cn('class1', undefined, 'class2');
    expect(result).toBe('class1 class2');
  });
});