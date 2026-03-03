/**
 * Sends an informational guide embed to the tea-fi-cabinet channel.
 *
 * Run with: bun run send-guide
 */

import { Client, EmbedBuilder, GatewayIntentBits } from 'discord.js';
import { COLORS } from '../config';

const CHANNEL_ID = '1397567024837824573';

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

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel?.isTextBased() || channel.isDMBased()) {
      console.error(`Channel ${CHANNEL_ID} not found or not a text channel`);
      process.exit(1);
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🍵 ═══ TEA-FI PROGRAM GUIDE ═══ 🍵')
      .setDescription(
        'Welcome to the **Tea-Fi Ambassador Program**!\n' +
          "Here's everything you need to get started.\n\n" +
          '───────────────────────────────',
      )
      .addFields(
        {
          name: '\n🍵  TEA CARD',
          value:
            'Use `/profile` to open your **Tea Card**.\n' +
            'This is your main hub — all actions start here.',
          inline: false,
        },
        {
          name: '\n🌱  SUBMIT WORK',
          value:
            'Click **Submit Work** on your profile or use `/sendwork`.\n' +
            'Pick a task, paste your URL, and add a description.',
          inline: false,
        },
        {
          name: '\n📋  MY WORKS',
          value: 'Click **My Works** to view your submission history — approved, rejected, and pending.',
          inline: false,
        },
        {
          name: '\n🏆  LEADERBOARD',
          value: 'Click **Leaderboard** or use `/leaderboard` to see top contributors ranked by XP.',
          inline: false,
        },
        {
          name: '\n💰  REWARDS',
          value:
            'Use `/rewards` to see your estimated monthly reward.\n' +
            'Pool: **$2,500/month** in $TEA, distributed by XP and role multiplier.',
          inline: false,
        },
        {
          name: '\n🍃  ROLES',
          value:
            '**Seed** → **Sprout Leaf** 🍃 (200 XP) → **Green Leaf** 🌿 (650 XP) → **Golden Leaf** 🍂 (1,500 XP + selection)\n' +
            'Higher roles = bigger reward multiplier.',
          inline: false,
        },
        {
          name: '\n🤖  AI ASSISTANT',
          value: 'Ask questions about the program in the ambassador chat — the AI helper will respond automatically.',
          inline: false,
        },
      )
      .setFooter({ text: 'Tea-Fi Ambassador Program • Good luck! 🍵' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log('Guide embed sent successfully!');
  } catch (error) {
    console.error('Failed to send guide:', error);
    process.exit(1);
  } finally {
    client.destroy();
  }
}

main();
