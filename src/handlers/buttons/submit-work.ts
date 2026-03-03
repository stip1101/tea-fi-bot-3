import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} from 'discord.js';
import { getUserByDiscordId } from '../../services/user.service';
import { getUserWorkCountByStatus } from '../../services/work.service';
import { getActiveTasks } from '../../services/task.service';
import { RATE_LIMITS } from '../../config/constants';
import { EMOJIS } from '../../config';
import { redis } from '../../state';

type SubmitWorkInteraction = ButtonInteraction | ChatInputCommandInteraction;

const SUBMIT_LOCK_TTL = 60;

export default async function handleSubmitWork(
  interaction: SubmitWorkInteraction,
  _args: string[]
): Promise<void> {
  const user = await getUserByDiscordId(interaction.user.id);

  if (!user) {
    await interaction.reply({
      content: `${EMOJIS.CROSS} You need to create a profile first. Use \`/profile\` command.`,
      ephemeral: true,
    });
    return;
  }

  if (user.isBanned) {
    await interaction.reply({
      content: `${EMOJIS.BANNED} Your account has been banned and you cannot submit works.`,
      ephemeral: true,
    });
    return;
  }

  const lockKey = `submit_lock:${interaction.user.id}`;
  const cooldownKey = `submit_cooldown:${interaction.user.id}`;

  // Rate limit check
  const cooldownRemaining = await redis.ttl(cooldownKey);
  if (cooldownRemaining > 0) {
    const minutes = Math.ceil(cooldownRemaining / 60);
    await interaction.reply({
      content: `${EMOJIS.PENDING} Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before submitting another work.`,
      ephemeral: true,
    });
    return;
  }

  // Submission lock
  const acquired = await redis.set(lockKey, '1', 'EX', SUBMIT_LOCK_TTL, 'NX');
  if (!acquired) {
    await interaction.reply({
      content: `${EMOJIS.PENDING} You have a submission in progress. Please complete it first.`,
      ephemeral: true,
    });
    return;
  }

  // Pending limit check
  const pendingCount = await getUserWorkCountByStatus(user.id, 'pending');
  if (pendingCount >= RATE_LIMITS.MAX_PENDING_WORKS) {
    await redis.del(lockKey);
    await interaction.reply({
      content: `${EMOJIS.MEMO} You have ${pendingCount} pending works. Please wait for some to be reviewed before submitting more.`,
      ephemeral: true,
    });
    return;
  }

  // Fetch active tasks for dropdown
  const activeTasks = await getActiveTasks();
  if (activeTasks.length === 0) {
    await redis.del(lockKey);
    await interaction.reply({
      content: `${EMOJIS.CROSS} No tasks are currently available. Please try again later.`,
      ephemeral: true,
    });
    return;
  }

  const taskSelect = new StringSelectMenuBuilder()
    .setCustomId('task-select')
    .setPlaceholder('Choose a task')
    .addOptions(
      activeTasks.slice(0, 25).map((task) => ({
        label: task.name,
        value: task.id,
        description: task.description
          ? task.description.length > 100
            ? task.description.slice(0, 97) + '...'
            : task.description
          : `${task.xpReward} XP`,
        emoji: EMOJIS.TEA,
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(taskSelect);

  await interaction.reply({
    content: `${EMOJIS.TEA} **Choose a task:**`,
    components: [row],
    ephemeral: true,
  });
}
