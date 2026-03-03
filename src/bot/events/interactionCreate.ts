import {
  type Interaction,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { ExtendedClient } from '../client';
import { botLogger } from '../../utils/logger';
import { getChannelIds } from '../../config';

const ALLOWED_BUTTON_HANDLERS = [
  'submit-work',
  'my-works',
  'leaderboard',
  'approve',
  'reject',
  'approve-report',
  'reject-report',
  'dashboard',
] as const;

const ALLOWED_MODAL_HANDLERS = [
  'work-submission',
  'approval',
  'rejection',
  'local-lead-report',
  'report-approval',
  'report-rejection',
] as const;

const ALLOWED_SELECT_HANDLERS = [
  'task-select',
] as const;

export function setupInteractionCreateEvent(client: ExtendedClient): void {
  client.on('interactionCreate', async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(client, interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModal(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction);
      }
    } catch (error) {
      const errorContext = {
        userId: interaction.user?.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        type: interaction.type,
        commandName: interaction.isChatInputCommand() ? interaction.commandName : undefined,
        customId: 'customId' in interaction ? interaction.customId : undefined,
      };
      botLogger.error({ err: error, context: errorContext }, 'Error handling interaction');
      await handleInteractionError(interaction);
    }
  });
}

const ADMIN_COMMANDS = [
  'admindashboard', 'adminuser', 'adminpending',
  'adminset-xp', 'adminset-role', 'adminban', 'adminunban', 'aihelper',
  'adminreport', 'admincreate-task', 'admintasks',
] as const;

function getCommandChannelMap(): Record<string, string> {
  const { WORK_CHANNEL_ID } = getChannelIds();
  const map: Record<string, string> = {};
  if (WORK_CHANNEL_ID) {
    map['profile'] = WORK_CHANNEL_ID;
    map['sendwork'] = WORK_CHANNEL_ID;
    map['leaderboard'] = WORK_CHANNEL_ID;
    map['rewards'] = WORK_CHANNEL_ID;
  }
  return map;
}

async function handleSlashCommand(
  client: ExtendedClient,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    botLogger.warn({ commandName: interaction.commandName }, 'Command not found');
    await interaction.reply({ content: '\u274C Unknown command.', ephemeral: true });
    return;
  }

  if (!ADMIN_COMMANDS.includes(interaction.commandName as typeof ADMIN_COMMANDS[number])) {
    const channelMap = getCommandChannelMap();
    const requiredChannelId = channelMap[interaction.commandName];
    if (requiredChannelId && interaction.channelId !== requiredChannelId) {
      await interaction.reply({
        content: `\u274C This command can only be used in <#${requiredChannelId}>.`,
        ephemeral: true,
      });
      return;
    }
  }

  await command.execute(interaction);
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const [action, ...args] = interaction.customId.split(':');

  if (!ALLOWED_BUTTON_HANDLERS.includes(action as typeof ALLOWED_BUTTON_HANDLERS[number])) {
    botLogger.warn({ action }, 'Blocked button handler attempt');
    await interaction.reply({ content: '\u274C Invalid action.', ephemeral: true });
    return;
  }

  let handler;
  try {
    handler = await import(`../../handlers/buttons/${action}`);
  } catch {
    botLogger.warn({ action }, 'Button handler not found');
    await interaction.reply({ content: '\u274C This button is not implemented yet.', ephemeral: true });
    return;
  }

  if (handler.default) await handler.default(interaction, args);
}

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const [action, ...args] = interaction.customId.split(':');

  if (!ALLOWED_MODAL_HANDLERS.includes(action as typeof ALLOWED_MODAL_HANDLERS[number])) {
    botLogger.warn({ action }, 'Blocked modal handler attempt');
    await interaction.reply({ content: '\u274C Invalid action.', ephemeral: true });
    return;
  }

  let handler;
  try {
    handler = await import(`../../handlers/modals/${action}`);
  } catch {
    botLogger.warn({ action }, 'Modal handler not found');
    await interaction.reply({ content: '\u274C This modal is not implemented yet.', ephemeral: true });
    return;
  }

  if (handler.default) await handler.default(interaction, args);
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const [action, ...args] = interaction.customId.split(':');

  if (!ALLOWED_SELECT_HANDLERS.includes(action as typeof ALLOWED_SELECT_HANDLERS[number])) {
    botLogger.warn({ action }, 'Blocked select menu handler attempt');
    await interaction.reply({ content: '\u274C Invalid action.', ephemeral: true });
    return;
  }

  let handler;
  try {
    handler = await import(`../../handlers/selectMenus/${action}`);
  } catch {
    botLogger.warn({ action }, 'Select menu handler not found');
    await interaction.reply({ content: '\u274C This menu is not implemented yet.', ephemeral: true });
    return;
  }

  if (handler.default) await handler.default(interaction, args);
}

async function handleInteractionError(interaction: Interaction): Promise<void> {
  const errorMessage = '\u274C An error occurred while processing your request.';

  try {
    if (interaction.isRepliable()) {
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content: errorMessage });
      } else if (interaction.replied) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  } catch {
    botLogger.error('Failed to send error message to user');
  }
}
