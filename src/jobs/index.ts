import cron from 'node-cron';
import type { Client } from 'discord.js';
import { sql, eq, and } from 'drizzle-orm';
import { jobLogger } from '../utils/logger';

let discordClient: Client | null = null;

export function setupJobs(client?: Client): void {
  if (client) discordClient = client;
  jobLogger.info('Setting up scheduled jobs');

  // Role check - runs every hour to auto-promote users crossing XP thresholds
  cron.schedule('0 * * * *', async () => {
    jobLogger.info('Running role check job');
    try {
      await runRoleCheck();
      jobLogger.info('Role check completed');
    } catch (error) {
      jobLogger.error({ err: error }, 'Role check failed');
    }
  });

  jobLogger.info('Scheduled jobs configured');
}

async function runRoleCheck(): Promise<void> {
  const { db, users, roleHistory } = await import('../db');
  const { determineAutoRole, syncDiscordRole } = await import('../services/role.service');
  const { generateId } = await import('../utils/id');

  const guildId = process.env.DISCORD_GUILD_ID;
  const guild = guildId && discordClient?.isReady() ? discordClient.guilds.cache.get(guildId) : null;

  const allUsers = await db
    .select()
    .from(users)
    .where(and(eq(users.isBanned, false), sql`${users.role} != 'golden_leaf'`));

  let promotions = 0;

  for (const user of allUsers) {
    const expectedRole = determineAutoRole(user.totalXp);
    if (expectedRole !== user.role) {
      const roleOrder = ['none', 'sprout_leaf', 'green_leaf'];
      const currentIdx = roleOrder.indexOf(user.role);
      const expectedIdx = roleOrder.indexOf(expectedRole);

      if (expectedIdx > currentIdx) {
        await db.transaction(async (tx) => {
          await tx
            .update(users)
            .set({ role: expectedRole, updatedAt: new Date() })
            .where(eq(users.id, user.id));

          await tx.insert(roleHistory).values({
            id: generateId(),
            userId: user.id,
            previousRole: user.role,
            newRole: expectedRole,
            reason: `Cron auto-promoted: ${user.totalXp} XP`,
          });
        });

        // Sync Discord role after DB commit
        if (guild) {
          try {
            await syncDiscordRole(guild, user.discordId, expectedRole);
          } catch (error) {
            jobLogger.warn({ err: error, discordId: user.discordId, role: expectedRole }, 'Failed to sync Discord role in cron');
          }
        }

        promotions++;
      }
    }
  }

  if (promotions > 0) {
    jobLogger.info({ promotions }, 'Role check: users promoted');
  }
}
