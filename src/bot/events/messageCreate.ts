import { Events, type Message, ChannelType } from 'discord.js';
import type { ExtendedClient } from '../client';
import { AI_HELPER_CONFIG, shouldRespond, processMessage, formatResponse, aiLogger } from '../../ai';
import { getChannelIds } from '../../config';
import { redis } from '../../state';

export function setupMessageCreateEvent(client: ExtendedClient): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    // --- Work channel: auto-delete all visible messages except our own bot's ---
    const workChannelId = getChannelIds().WORK_CHANNEL_ID;
    if (workChannelId && message.channel.id === workChannelId) {
      if (message.author.id === client.user?.id) return;

      try {
        await message.delete();
      } catch {
        // Message may already be deleted or bot lacks permissions
      }

      if (!message.author.bot) {
        try {
          await message.author.send(
            '🍵 This channel is for bot commands only. Use `/profile` or `/sendwork` to interact with the bot.',
          );
        } catch {
          // User may have DMs disabled
        }
      }
      return;
    }

    // --- AI Helper: respond in community chat ---
    // Ignore bot messages
    if (message.author.bot) return;

    // Only respond in the configured channel
    const channelId = AI_HELPER_CONFIG.channelId;
    if (!channelId || message.channel.id !== channelId) return;

    // Check if AI helper is enabled
    if (!AI_HELPER_CONFIG.enabled) return;

    // Check if bot ID is available
    const botId = client.user?.id;
    if (!botId) return;

    // Check if we should respond to this message
    const isMentioned = message.mentions.has(botId);
    const shouldAutoRespond = shouldRespond(message, botId);

    if (!isMentioned && !shouldAutoRespond) return;

    // Deduplicate: prevent processing the same message twice (gateway reconnect/replay)
    const dedupKey = `ai:msg:${message.id}`;
    const isNew = await redis.set(dedupKey, '1', 'EX', 10, 'NX');
    if (!isNew) return;

    try {
      // Show typing indicator (only for text-based channels)
      if (message.channel.type === ChannelType.GuildText) {
        await message.channel.sendTyping();
      }

      // Process the message
      const result = await processMessage(message);

      if (result.success && result.message) {
        // Format and send response
        const formattedResponse = formatResponse(result.message, result.rateLimitInfo?.remaining);
        await message.reply({
          content: formattedResponse,
          allowedMentions: { repliedUser: true },
        });
      } else if (result.error) {
        // Only reply with error if bot was explicitly mentioned
        if (isMentioned) {
          await message.reply({
            content: result.error,
            allowedMentions: { repliedUser: true },
          });
        }
        // For auto-triggered responses, silently skip on errors to avoid spam
      }
    } catch (error) {
      aiLogger.error({ err: error, messageId: message.id }, 'Error handling message');

      // Only reply with error if bot was explicitly mentioned
      if (isMentioned) {
        try {
          await message.reply({
            content: '❌ An error occurred while processing your request. Please try again later.',
            allowedMentions: { repliedUser: true },
          });
        } catch {
          // Failed to send error message, ignore
        }
      }
    }
  });
}
