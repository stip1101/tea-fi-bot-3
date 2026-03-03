import { eq } from 'drizzle-orm';
import type { Guild } from 'discord.js';
import { db, users, roleHistory, type TeafiRole } from '../db';
import { ROLE_CONFIG, getTeafiRoleDiscordId, getAllTeafiRoleIds } from '../config/roles';
import { generateId } from '../utils/id';
import { logger } from '../utils/logger';

const log = logger.child({ module: 'role' });

export function determineAutoRole(totalXp: number): TeafiRole {
  // Check from highest to lowest auto-assignable role
  if (totalXp >= 650) return 'green_leaf';
  if (totalXp >= 200) return 'sprout_leaf';
  return 'none';
}

export async function checkAndUpdateRole(
  userId: string,
  guild: Guild,
  discordId: string
): Promise<{ changed: boolean; from?: TeafiRole; to?: TeafiRole }> {
  const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const userData = userResult[0];
  if (!userData) return { changed: false };

  const currentRole = userData.role as TeafiRole;
  const newRole = determineAutoRole(userData.totalXp);

  // Golden Leaf is manual only — never auto-assign or downgrade from it
  if (currentRole === 'golden_leaf') return { changed: false };

  // Only auto-promote, never demote
  const roleOrder: TeafiRole[] = ['none', 'sprout_leaf', 'green_leaf'];
  const currentIndex = roleOrder.indexOf(currentRole);
  const newIndex = roleOrder.indexOf(newRole);

  if (newIndex <= currentIndex) return { changed: false };

  // Update DB + log role change atomically
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await tx.insert(roleHistory).values({
      id: generateId(),
      userId,
      previousRole: currentRole,
      newRole,
      reason: `Auto-promoted: ${userData.totalXp} XP reached ${ROLE_CONFIG[newRole].xpThreshold ?? 0} threshold`,
    });
  });

  // Sync Discord role
  try {
    await syncDiscordRole(guild, discordId, newRole);
  } catch (error) {
    log.error({ err: error, discordId, newRole }, 'Failed to sync Discord role after auto-promotion');
  }

  log.info({ userId, from: currentRole, to: newRole, xp: userData.totalXp }, 'User auto-promoted');

  return { changed: true, from: currentRole, to: newRole };
}

export async function syncDiscordRole(
  guild: Guild,
  discordId: string,
  role: TeafiRole
): Promise<void> {
  const member = await guild.members.fetch(discordId);

  // Remove all TeaFi roles
  const allRoleIds = getAllTeafiRoleIds();
  const rolesToRemove = allRoleIds.filter((id) => member.roles.cache.has(id));
  if (rolesToRemove.length > 0) {
    await member.roles.remove(rolesToRemove);
  }

  // Add the correct role
  const newRoleId = getTeafiRoleDiscordId(role);
  if (newRoleId) {
    await member.roles.add(newRoleId);
  }
}

export async function setUserRole(
  userId: string,
  newRole: TeafiRole,
  reason: string,
  promotedBy: string,
  guild: Guild,
  discordId: string
): Promise<{ previousRole: TeafiRole; newRole: TeafiRole }> {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]) throw new Error('User not found');

  const previousRole = user[0].role as TeafiRole;

  // Update DB + log role change atomically
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await tx.insert(roleHistory).values({
      id: generateId(),
      userId,
      previousRole,
      newRole,
      reason,
      promotedBy,
    });
  });

  // Sync Discord role
  try {
    await syncDiscordRole(guild, discordId, newRole);
  } catch (error) {
    log.warn({ err: error, discordId, newRole }, 'DB updated but Discord role sync failed');
  }

  log.info({ userId, previousRole, newRole }, 'User role updated by admin');

  return { previousRole, newRole };
}
