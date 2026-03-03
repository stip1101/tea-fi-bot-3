import { type GuildMember, type Interaction } from 'discord.js';
import { getAdminRoleIds } from '../../config/roles';
import { getWorkById, type Work } from '../../services/work.service';

export type ValidationSuccess = {
  success: true;
  work: Work;
};

export type ValidationFailure = {
  success: false;
  error: string;
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validates that an interaction has permission to review a work
 * and that the work exists and is pending review.
 */
export async function validateWorkReview(
  interaction: Interaction,
  workId: string | null
): Promise<ValidationResult> {
  // Admin check
  const adminRoleIds = getAdminRoleIds();
  const member = interaction.member as GuildMember | null;
  const hasAdminRole = adminRoleIds.some((id) => member?.roles?.cache?.has(id));

  if (!hasAdminRole) {
    return { success: false, error: '❌ You do not have permission to review works.' };
  }

  // Work ID check
  if (!workId) {
    return { success: false, error: '❌ Work ID not found.' };
  }

  // Work existence and status check
  const work = await getWorkById(workId);
  if (!work) {
    return { success: false, error: '❌ Work not found.' };
  }

  if (work.status !== 'pending') {
    return { success: false, error: `❌ This work has already been ${work.status}.` };
  }

  return { success: true, work };
}
