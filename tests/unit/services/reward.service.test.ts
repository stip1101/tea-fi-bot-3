import { describe, test, expect } from 'bun:test';
import { getCurrentMonthYear } from '../../../src/services/reward.service';

describe('getCurrentMonthYear', () => {
  test('returns string in YYYY-MM format', () => {
    const result = getCurrentMonthYear();
    expect(result).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  test('returns current year and month', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(getCurrentMonthYear()).toBe(expected);
  });
});
