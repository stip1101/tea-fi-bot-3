import { describe, test, expect } from 'bun:test';
import { determineAutoRole } from '../../../src/services/role.service';

describe('determineAutoRole', () => {
  test('returns none for 0 XP', () => {
    expect(determineAutoRole(0)).toBe('none');
  });

  test('returns none for XP below 200', () => {
    expect(determineAutoRole(199)).toBe('none');
  });

  test('returns sprout_leaf at exactly 200 XP', () => {
    expect(determineAutoRole(200)).toBe('sprout_leaf');
  });

  test('returns sprout_leaf for XP between 200 and 649', () => {
    expect(determineAutoRole(400)).toBe('sprout_leaf');
    expect(determineAutoRole(649)).toBe('sprout_leaf');
  });

  test('returns green_leaf at exactly 650 XP', () => {
    expect(determineAutoRole(650)).toBe('green_leaf');
  });

  test('returns green_leaf for XP above 650', () => {
    expect(determineAutoRole(1000)).toBe('green_leaf');
    expect(determineAutoRole(9999)).toBe('green_leaf');
  });

  test('handles negative XP gracefully', () => {
    expect(determineAutoRole(-1)).toBe('none');
  });
});
