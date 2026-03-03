import { randomBytes } from 'node:crypto';

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a work ID (shorter than UUID for display)
 */
export function generateWorkId(): string {
  return randomBytes(6).toString('hex'); // 12 chars
}
