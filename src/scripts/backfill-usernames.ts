/**
 * Backfills discord_username for existing users.
 * Fetches Discord usernames by ID and updates the database.
 *
 * Run with: bun run backfill-usernames
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { eq, isNull } from 'drizzle-orm';
import { db, users } from '../db';

async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('DISCORD_TOKEN is required in .env');
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  try {
    await client.login(token);
    console.log(`Logged in as ${client.user?.tag}`);

    const usersWithoutUsername = await db
      .select({ id: users.id, discordId: users.discordId })
      .from(users)
      .where(isNull(users.discordUsername));

    console.log(`Found ${usersWithoutUsername.length} users without username`);

    let updated = 0;
    let failed = 0;

    for (const user of usersWithoutUsername) {
      try {
        const discordUser = await client.users.fetch(user.discordId);
        await db
          .update(users)
          .set({ discordUsername: discordUser.username })
          .where(eq(users.id, user.id));
        updated++;
        console.log(`Updated ${user.discordId} -> ${discordUser.username}`);
      } catch (e) {
        failed++;
        console.error(`Failed to fetch ${user.discordId}:`, e);
      }
      // Rate limit: ~10 requests per second
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`Backfill complete: ${updated} updated, ${failed} failed`);
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  } finally {
    client.destroy();
    process.exit(0);
  }
}

main();
