import { SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember, EmbedBuilder } from 'discord.js';
import type { Command } from '../../client';
import { getAllTasks, updateTask, deactivateTask } from '../../../services/task.service';
import { getAdminRoleIds } from '../../../config/roles';
import { COLORS, EMOJIS } from '../../../config';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('admintasks')
    .setDescription('Manage tasks')
    .addSubcommand((sub) => sub.setName('list').setDescription('List all tasks'))
    .addSubcommand((sub) =>
      sub
        .setName('deactivate')
        .setDescription('Deactivate a task')
        .addStringOption((opt) => opt.setName('id').setDescription('Task ID').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('activate')
        .setDescription('Activate a task')
        .addStringOption((opt) => opt.setName('id').setDescription('Task ID').setRequired(true))
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const adminRoleIds = getAdminRoleIds();
    const member = interaction.member as GuildMember | null;
    if (!adminRoleIds.some((id) => member?.roles?.cache?.has(id))) {
      await interaction.reply({ content: `${EMOJIS.CROSS} No permission.`, ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const tasks = await getAllTasks();

      if (tasks.length === 0) {
        await interaction.reply({
          content: `${EMOJIS.MEMO} No tasks created yet. Use \`/admincreate-task\` to create one.`,
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`${EMOJIS.TEA} Tasks`)
        .setDescription(
          tasks.map((t) => {
            const status = t.isActive ? EMOJIS.CHECK : EMOJIS.CROSS;
            return `${status} **${t.name}** — ${t.xpReward} XP\n\u2514 \`${t.id}\`${t.description ? ` \u2022 ${t.description}` : ''}`;
          }).join('\n\n')
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (subcommand === 'deactivate') {
      const taskId = interaction.options.getString('id', true);
      const task = await deactivateTask(taskId);
      if (!task) {
        await interaction.reply({ content: `${EMOJIS.CROSS} Task not found.`, ephemeral: true });
        return;
      }
      await interaction.reply({
        content: `${EMOJIS.CHECK} Task **${task.name}** has been deactivated.`,
        ephemeral: true,
      });
    } else if (subcommand === 'activate') {
      const taskId = interaction.options.getString('id', true);
      const task = await updateTask(taskId, { isActive: true });
      if (!task) {
        await interaction.reply({ content: `${EMOJIS.CROSS} Task not found.`, ephemeral: true });
        return;
      }
      await interaction.reply({
        content: `${EMOJIS.CHECK} Task **${task.name}** has been activated.`,
        ephemeral: true,
      });
    }
  },
};

export default command;
