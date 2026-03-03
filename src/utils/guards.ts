import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  GuildMember,
} from 'discord.js';
import { getAdminRoleIds } from '../config/roles';

type SupportedInteraction = ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction;

export async function requireAdmin(interaction: SupportedInteraction): Promise<boolean> {
  const adminRoleIds = getAdminRoleIds();
  const member = interaction.member as GuildMember | null;
  const hasAdminRole = adminRoleIds.some((id) => member?.roles?.cache?.has(id)) ?? false;

  if (!hasAdminRole) {
    await interaction.reply({
      content: '❌ You do not have permission to use this command.',
      ephemeral: true,
    });
    return false;
  }

  return true;
}
