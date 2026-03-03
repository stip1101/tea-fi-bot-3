import { describe, test, expect } from 'bun:test';
import { formatRole, formatTaskName, formatNumber, formatDate } from '../../../src/utils/format';
import { ROLE_CONFIG } from '../../../src/config/roles';
import { EMOJIS } from '../../../src/config';

describe('formatRole', () => {
  test('formats none role as Newcomer', () => {
    const result = formatRole('none');
    expect(result).toBe(`${ROLE_CONFIG.none.emoji} ${ROLE_CONFIG.none.name}`);
    expect(result).toContain('Newcomer');
  });

  test('formats sprout_leaf role', () => {
    const result = formatRole('sprout_leaf');
    expect(result).toBe(`${ROLE_CONFIG.sprout_leaf.emoji} ${ROLE_CONFIG.sprout_leaf.name}`);
    expect(result).toContain('Sprout Leaf');
  });

  test('formats green_leaf role', () => {
    const result = formatRole('green_leaf');
    expect(result).toBe(`${ROLE_CONFIG.green_leaf.emoji} ${ROLE_CONFIG.green_leaf.name}`);
    expect(result).toContain('Green Leaf');
  });

  test('formats golden_leaf role', () => {
    const result = formatRole('golden_leaf');
    expect(result).toBe(`${ROLE_CONFIG.golden_leaf.emoji} ${ROLE_CONFIG.golden_leaf.name}`);
    expect(result).toContain('Golden Leaf');
  });
});

describe('formatTaskName', () => {
  test('formats task name with tea emoji', () => {
    expect(formatTaskName('Twitter Post')).toBe(`${EMOJIS.TEA} Twitter Post`);
  });

  test('formats various task names', () => {
    expect(formatTaskName('Community Event')).toBe(`${EMOJIS.TEA} Community Event`);
    expect(formatTaskName('Bug Report')).toBe(`${EMOJIS.TEA} Bug Report`);
  });

  test('handles empty string', () => {
    expect(formatTaskName('')).toBe(`${EMOJIS.TEA} `);
  });
});

describe('formatNumber', () => {
  test('returns number as-is when less than 1000', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(100)).toBe('100');
    expect(formatNumber(999)).toBe('999');
  });

  test('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(10000)).toBe('10.0K');
    expect(formatNumber(999999)).toBe('1000.0K');
  });

  test('formats millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(1500000)).toBe('1.5M');
    expect(formatNumber(10000000)).toBe('10.0M');
    expect(formatNumber(999999999)).toBe('1000.0M');
  });

  test('handles boundary values', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(999999)).toBe('1000.0K');
    expect(formatNumber(1000000)).toBe('1.0M');
  });

  test('handles decimal precision', () => {
    expect(formatNumber(1234)).toBe('1.2K');
    expect(formatNumber(1567)).toBe('1.6K');
    expect(formatNumber(1234567)).toBe('1.2M');
  });
});

describe('formatDate', () => {
  test('formats date in "Mar 15, 2024" format', () => {
    const date = new Date('2024-03-15T12:00:00Z');
    expect(formatDate(date)).toBe('Mar 15, 2024');
  });

  test('handles different months', () => {
    expect(formatDate(new Date('2024-01-01'))).toBe('Jan 1, 2024');
    expect(formatDate(new Date('2024-06-15'))).toBe('Jun 15, 2024');
    expect(formatDate(new Date('2024-12-31'))).toBe('Dec 31, 2024');
  });

  test('handles different years', () => {
    expect(formatDate(new Date('2020-05-10'))).toBe('May 10, 2020');
    expect(formatDate(new Date('2030-11-20'))).toBe('Nov 20, 2030');
  });

  test('handles single digit days', () => {
    expect(formatDate(new Date('2024-02-05'))).toBe('Feb 5, 2024');
  });

  test('handles leap year date', () => {
    expect(formatDate(new Date('2024-02-29'))).toBe('Feb 29, 2024');
  });
});
