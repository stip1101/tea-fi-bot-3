import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  GuildMember,
} from 'discord.js';
import { getAdminRoleId } from '../config/roles';

type SupportedInteraction = ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction;

export async function requireAdmin(interaction: SupportedInteraction): Promise<boolean> {
  const adminRoleId = getAdminRoleId();
  const member = interaction.member as GuildMember | null;
  const hasAdminRole = member?.roles?.cache?.has(adminRoleId) ?? false;

  if (!hasAdminRole) {
    await interaction.reply({
      content: '❌ You do not have permission to use this command.',
      ephemeral: true,
    });
    return false;
  }

  return true;
}
