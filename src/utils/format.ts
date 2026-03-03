import { ROLE_CONFIG } from '../config/roles';
import { EMOJIS } from '../config';
import type { TeafiRole } from '../db/schema';

export function formatRole(role: TeafiRole): string {
  const config = ROLE_CONFIG[role];
  return `${config.emoji} ${config.name}`;
}

export function formatTaskName(name: string): string {
  return `${EMOJIS.TEA} ${name}`;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
