import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../../client';
import { getUserByDiscordId, banUser } from '../../../services/user.service';
import { requireAdmin } from '../../../utils/guards';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('adminban')
    .setDescription('🚫 Ban a user from the TeaFi program (Admin only)')
    .addUserOption((option) =>
      option.setName('user').setDescription('User to ban').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Ban reason').setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireAdmin(interaction))) return;

    const targetDiscordUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || undefined;

    if (targetDiscordUser.id === interaction.user.id) {
      await interaction.reply({
        content: '❌ You cannot ban yourself.',
        ephemeral: true,
      });
      return;
    }

    const user = await getUserByDiscordId(targetDiscordUser.id);
    if (!user) {
      await interaction.reply({
        content: '❌ This user is not registered in the TeaFi program.',
        ephemeral: true,
      });
      return;
    }

    if (user.isBanned) {
      await interaction.reply({
        content: '❌ This user is already banned.',
        ephemeral: true,
      });
      return;
    }

    await banUser(user.id, reason);

    await interaction.reply({
      content:
        `🚫 **User banned!**\n\n` +
        `User: <@${targetDiscordUser.id}>\n` +
        (reason ? `Reason: ${reason}` : ''),
      ephemeral: true,
    });

    try {
      await targetDiscordUser.send({
        content:
          `🚫 **You have been banned from the TeaFi Program**\n\n` +
          (reason ? `Reason: ${reason}\n\n` : '') +
          `If you believe this is a mistake, please contact an administrator.`,
      });
    } catch {
      // User might have DMs disabled
    }
  },
};

export default command;
