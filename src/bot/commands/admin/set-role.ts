import { SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember } from 'discord.js';
import type { Command } from '../../client';
import { getUserByDiscordId } from '../../../services/user.service';
import { setUserRole } from '../../../services/role.service';
import { getAdminRoleIds, ROLE_CONFIG } from '../../../config/roles';
import { EMOJIS } from '../../../config';
import type { TeafiRole } from '../../../db/schema';

const ROLE_CHOICES: { name: string; value: TeafiRole }[] = [
  { name: 'Newcomer (none)', value: 'none' },
  { name: 'Sprout Leaf', value: 'sprout_leaf' },
  { name: 'Green Leaf', value: 'green_leaf' },
  { name: 'Golden Leaf', value: 'golden_leaf' },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('adminset-role')
    .setDescription('Set user TeaFi role')
    .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('role')
        .setDescription('New role')
        .setRequired(true)
        .addChoices(...ROLE_CHOICES)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for role change').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const adminRoleIds = getAdminRoleIds();
    const member = interaction.member as GuildMember | null;
    if (!adminRoleIds.some((id) => member?.roles?.cache?.has(id))) {
      await interaction.reply({ content: `${EMOJIS.CROSS} No permission.`, ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const newRole = interaction.options.getString('role', true) as TeafiRole;
    const reason = interaction.options.getString('reason') || 'Admin assignment';

    const user = await getUserByDiscordId(targetUser.id);
    if (!user) {
      await interaction.reply({ content: `${EMOJIS.CROSS} User not found.`, ephemeral: true });
      return;
    }

    if (!interaction.guild) {
      await interaction.reply({ content: `${EMOJIS.CROSS} Must be used in a server.`, ephemeral: true });
      return;
    }

    const result = await setUserRole(user.id, newRole, reason, interaction.user.id, interaction.guild, targetUser.id);

    const prevConfig = ROLE_CONFIG[result.previousRole];
    const newConfig = ROLE_CONFIG[result.newRole];

    await interaction.reply({
      content:
        `${EMOJIS.CHECK} Role updated for <@${targetUser.id}>:\n\n` +
        `${prevConfig.emoji} ${prevConfig.name} → ${newConfig.emoji} ${newConfig.name}\n` +
        `Reason: ${reason}`,
      ephemeral: true,
    });
  },
};

export default command;
