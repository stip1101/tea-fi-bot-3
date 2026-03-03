import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../../client';
import { getUserByDiscordId, unbanUser } from '../../../services/user.service';
import { requireAdmin } from '../../../utils/guards';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('adminunban')
    .setDescription('✅ Unban a user from the TeaFi program (Admin only)')
    .addUserOption((option) =>
      option.setName('user').setDescription('User to unban').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireAdmin(interaction))) return;

    const targetDiscordUser = interaction.options.getUser('user', true);

    const user = await getUserByDiscordId(targetDiscordUser.id);
    if (!user) {
      await interaction.reply({
        content: '❌ This user is not registered in the TeaFi program.',
        ephemeral: true,
      });
      return;
    }

    if (!user.isBanned) {
      await interaction.reply({
        content: '❌ This user is not banned.',
        ephemeral: true,
      });
      return;
    }

    await unbanUser(user.id);

    await interaction.reply({
      content: `✅ **User unbanned!**\n\nUser: <@${targetDiscordUser.id}>`,
      ephemeral: true,
    });

    try {
      await targetDiscordUser.send({
        content:
          `✅ **You have been unbanned from the TeaFi Program**\n\n` +
          `You can now use the program again. Use \`/profile\` to view your profile.`,
      });
    } catch {
      // User might have DMs disabled
    }
  },
};

export default command;
