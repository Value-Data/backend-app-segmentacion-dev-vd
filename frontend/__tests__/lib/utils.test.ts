import { describe, it, expect } from 'vitest';
import { cn, formatDate, formatNumber } from '@/lib/utils';

describe('cn()', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', 'extra');
    expect(result).toBe('base extra');
  });

  it('resolves tailwind conflicts keeping last value', () => {
    // twMerge should keep py-4 over py-2
    const result = cn('py-2', 'py-4');
    expect(result).toBe('py-4');
  });

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('');
  });
});

describe('formatDate()', () => {
  it('returns "-" for null', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatDate(undefined)).toBe('-');
  });

  it('formats a Date object in es-CL locale', () => {
    // Use a fixed date — es-CL format is DD-MM-YYYY
    const date = new Date(2024, 5, 15); // June 15, 2024
    const result = formatDate(date);
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('formats an ISO string', () => {
    // Use midday UTC to avoid timezone shift changing the day
    const result = formatDate('2024-01-10T12:00:00Z');
    expect(result).toContain('2024');
    expect(result).toContain('10');
  });
});

describe('formatNumber()', () => {
  it('returns "-" for null', () => {
    expect(formatNumber(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatNumber(undefined)).toBe('-');
  });

  it('formats an integer', () => {
    const result = formatNumber(1500);
    // es-CL uses dot as thousand separator
    expect(result).toBe('1.500');
  });

  it('formats a number with decimals', () => {
    const result = formatNumber(3.14159, 2);
    expect(result).toContain('3,14');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});
