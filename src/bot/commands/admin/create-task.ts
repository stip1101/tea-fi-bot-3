import { SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember } from 'discord.js';
import type { Command } from '../../client';
import { createTask } from '../../../services/task.service';
import { getAdminRoleId } from '../../../config/roles';
import { EMOJIS } from '../../../config';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('admincreate-task')
    .setDescription('Create a new task')
    .addStringOption((opt) => opt.setName('name').setDescription('Task name').setRequired(true).setMaxLength(100))
    .addIntegerOption((opt) => opt.setName('xp').setDescription('XP reward').setRequired(true).setMinValue(1).setMaxValue(1000))
    .addStringOption((opt) => opt.setName('description').setDescription('Task description').setRequired(false).setMaxLength(500)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const adminRoleId = getAdminRoleId();
    const member = interaction.member as GuildMember | null;
    if (!(member?.roles?.cache?.has(adminRoleId) ?? false)) {
      await interaction.reply({ content: `${EMOJIS.CROSS} No permission.`, ephemeral: true });
      return;
    }

    const name = interaction.options.getString('name', true);
    const xpReward = interaction.options.getInteger('xp', true);
    const description = interaction.options.getString('description') || undefined;

    const task = await createTask(name, description, xpReward, interaction.user.id);

    await interaction.reply({
      content:
        `${EMOJIS.CHECK} **Task created!**\n\n` +
        `${EMOJIS.TEA} **${task.name}**\n` +
        `${EMOJIS.STAR} XP: ${task.xpReward}\n` +
        (task.description ? `${EMOJIS.MEMO} ${task.description}\n` : '') +
        `ID: \`${task.id}\``,
      ephemeral: true,
    });
  },
};

export default command;
