import type { TeafiRole } from '../db/schema';

export interface TeafiRoleConfig {
  name: string;
  emoji: string;
  color: number;
  xpThreshold: number | null;
  multiplier: number;
  autoAssign: boolean;
}

export const ROLE_CONFIG: Record<TeafiRole, TeafiRoleConfig> = {
  none: {
    name: 'Newcomer',
    emoji: '🌱',
    color: 0x9E9E9E,
    xpThreshold: null,
    multiplier: 0,
    autoAssign: true,
  },
  sprout_leaf: {
    name: 'Sprout Leaf',
    emoji: '🍃',
    color: 0x8BC34A,
    xpThreshold: 200,
    multiplier: 0.75,
    autoAssign: true,
  },
  green_leaf: {
    name: 'Green Leaf',
    emoji: '🌿',
    color: 0x4CAF50,
    xpThreshold: 650,
    multiplier: 1.3,
    autoAssign: true,
  },
  golden_leaf: {
    name: 'Golden Leaf',
    emoji: '🍂',
    color: 0xFFD700,
    xpThreshold: null,
    multiplier: 2.5,
    autoAssign: false,
  },
};

export interface DiscordRoleIds {
  ADMIN_ROLE_IDS: string[];
  LOCAL_LEAD_ROLE_ID: string;
  SPROUT_LEAF_ROLE_ID: string | null;
  GREEN_LEAF_ROLE_ID: string | null;
  GOLDEN_LEAF_ROLE_ID: string | null;
}

let cachedConfig: DiscordRoleIds | null = null;

export function loadRoleConfig(): DiscordRoleIds {
  if (cachedConfig) return cachedConfig;

  const adminRoleId = process.env.ADMIN_ROLE_ID;
  if (!adminRoleId) {
    throw new Error('CRITICAL: ADMIN_ROLE_ID environment variable is required');
  }

  cachedConfig = {
    ADMIN_ROLE_IDS: adminRoleId.split(',').map((id) => id.trim()).filter(Boolean),
    LOCAL_LEAD_ROLE_ID: process.env.LOCAL_LEAD_ROLE_ID || '',
    SPROUT_LEAF_ROLE_ID: process.env.SPROUT_LEAF_ROLE_ID || null,
    GREEN_LEAF_ROLE_ID: process.env.GREEN_LEAF_ROLE_ID || null,
    GOLDEN_LEAF_ROLE_ID: process.env.GOLDEN_LEAF_ROLE_ID || null,
  };

  return cachedConfig;
}

export function getAdminRoleIds(): string[] {
  return loadRoleConfig().ADMIN_ROLE_IDS;
}

export function getLocalLeadRoleId(): string {
  return loadRoleConfig().LOCAL_LEAD_ROLE_ID;
}

export function getTeafiRoleDiscordId(role: TeafiRole): string | null {
  const config = loadRoleConfig();
  switch (role) {
    case 'sprout_leaf': return config.SPROUT_LEAF_ROLE_ID;
    case 'green_leaf': return config.GREEN_LEAF_ROLE_ID;
    case 'golden_leaf': return config.GOLDEN_LEAF_ROLE_ID;
    default: return null;
  }
}

export function getAllTeafiRoleIds(): string[] {
  const config = loadRoleConfig();
  return [
    config.SPROUT_LEAF_ROLE_ID,
    config.GREEN_LEAF_ROLE_ID,
    config.GOLDEN_LEAF_ROLE_ID,
  ].filter((id): id is string => id !== null);
}
