import { describe, test, expect } from 'bun:test';
import { generateId, generateWorkId } from '../../../src/utils/id';

describe('generateId', () => {
  test('returns a valid UUID v4 format', () => {
    const id = generateId();

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidV4Regex);
  });

  test('generates unique IDs across 1000 iterations', () => {
    const ids = new Set<string>();

    for (let i = 0; i < 1000; i++) {
      ids.add(generateId());
    }

    expect(ids.size).toBe(1000);
  });
});

describe('generateWorkId', () => {
  test('generates 12-character hex string', () => {
    const id = generateWorkId();

    expect(id.length).toBe(12);
    expect(id).toMatch(/^[0-9a-f]{12}$/);
  });

  test('generates lowercase hex characters', () => {
    for (let i = 0; i < 50; i++) {
      const id = generateWorkId();
      expect(id).toBe(id.toLowerCase());
    }
  });

  test('generates unique IDs across 1000 iterations', () => {
    const ids = new Set<string>();

    for (let i = 0; i < 1000; i++) {
      ids.add(generateWorkId());
    }

    expect(ids.size).toBe(1000);
  });
});
