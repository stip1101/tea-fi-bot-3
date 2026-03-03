import type { Message } from 'discord.js';
import OpenAI from 'openai';
import { openai, aiLogger } from './openai-client';
import { AI_HELPER_CONFIG } from './config';
import { acquireRateLimitSlot, type RateLimitResult } from './rate-limiter';
import { guardMessage, getGuardErrorMessage, type GuardResult } from './prompt-guard';
import { getTempInfoForPrompt } from './temp-info';

// Request timeout in milliseconds
const OPENAI_TIMEOUT_MS = 30000;

// Regex for removing Discord mentions (module-level for performance)
const MENTION_REGEX = /<@!?\d+>/g;

export interface AiHelperResponse {
  success: boolean;
  message?: string;
  error?: string;
  rateLimitInfo?: RateLimitResult;
}

/**
 * Check if message should trigger AI helper
 */
export function shouldRespond(message: Message, botId: string): boolean {
  // Always respond if bot is mentioned
  if (message.mentions.has(botId)) {
    return true;
  }

  // Don't auto-respond to replies directed at other users
  if (message.reference) {
    return false;
  }

  const content = message.content.toLowerCase().trim();

  // Strip URLs to prevent false positives from query params ('?') and keyword-rich paths
  const textOnly = content.replace(/https?:\/\/\S+/gi, '').trim();

  // Message was only URL(s) — don't respond
  if (!textOnly) {
    return false;
  }

  // Check if message looks like a question
  const isQuestion =
    textOnly.includes('?') ||
    textOnly.startsWith('how') ||
    textOnly.startsWith('what') ||
    textOnly.startsWith('where') ||
    textOnly.startsWith('why') ||
    textOnly.startsWith('when') ||
    textOnly.startsWith('who') ||
    textOnly.startsWith('which') ||
    textOnly.startsWith('can i') ||
    textOnly.startsWith('can you') ||
    textOnly.startsWith('is there') ||
    textOnly.startsWith('are there') ||
    textOnly.startsWith('do i') ||
    textOnly.startsWith('does');

  if (!isQuestion) {
    return false;
  }

  // Check if message contains program-related keywords
  const hasKeyword = AI_HELPER_CONFIG.programKeywords.some((keyword) =>
    textOnly.includes(keyword.toLowerCase())
  );

  return hasKeyword;
}

/**
 * Get user-friendly rate limit error message
 */
function getRateLimitErrorMessage(result: RateLimitResult): string {
  switch (result.reason) {
    case 'disabled':
      return '🔒 AI helper is temporarily disabled. Please try again later.';
    case 'cooldown':
      return `⏳ Please wait ${result.resetInSeconds} seconds before your next question.`;
    case 'rate_limit':
      return `🚫 You've reached the request limit. Try again in ${result.resetInSeconds} seconds.`;
    default:
      return '❌ An error occurred. Please try again later.';
  }
}

/**
 * Process a user message and generate AI response
 */
export async function processMessage(message: Message): Promise<AiHelperResponse> {
  const userId = message.author.id;

  // Check if OpenAI client is available
  if (!openai) {
    aiLogger.error('OpenAI client not initialized - API key missing');
    return {
      success: false,
      error: '⚙️ AI helper is not configured. Please contact an administrator.',
    };
  }

  // Atomically acquire rate limit slot (check + increment in one operation)
  // This prevents race conditions where parallel requests bypass the limit
  const rateLimitResult = await acquireRateLimitSlot(userId);
  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: getRateLimitErrorMessage(rateLimitResult),
      rateLimitInfo: rateLimitResult,
    };
  }

  // Extract and clean message content (remove bot mention)
  let content = message.content.replace(MENTION_REGEX, '').trim();

  if (!content) {
    return {
      success: false,
      error: '❓ Please ask a question after mentioning the bot.',
    };
  }

  // Guard against injection and offensive content
  const guardResult: GuardResult = guardMessage(content);
  if (!guardResult.safe || !guardResult.sanitizedMessage) {
    return {
      success: false,
      error: getGuardErrorMessage(guardResult.reason),
    };
  }

  const sanitizedContent = guardResult.sanitizedMessage;

  // Check if vector store is configured
  const vectorStoreId = AI_HELPER_CONFIG.vectorStoreId;
  if (!vectorStoreId) {
    aiLogger.error('Vector store ID not configured');
    return {
      success: false,
      error: '⚙️ AI helper is not configured. Please contact an administrator.',
    };
  }

  try {
    aiLogger.info({ userId, contentLength: sanitizedContent.length }, 'Processing AI request');

    // Build system prompt with temp info if available
    const tempInfo = await getTempInfoForPrompt();
    const systemPrompt = tempInfo
      ? `${AI_HELPER_CONFIG.systemPrompt}\n\n<program_updates>\n${tempInfo}\n</program_updates>`
      : AI_HELPER_CONFIG.systemPrompt;

    // Call OpenAI Responses API with file_search tool and timeout
    const response = await openai.responses.create(
      {
        model: AI_HELPER_CONFIG.model,
        instructions: systemPrompt,
        input: sanitizedContent,
        max_output_tokens: AI_HELPER_CONFIG.maxTokens,
        tools: [
          {
            type: 'file_search',
            vector_store_ids: [vectorStoreId],
          },
        ],
      },
      {
        timeout: OPENAI_TIMEOUT_MS,
      }
    );

    // Log whether file_search was actually used
    const fileSearchUsed = response.output.some(
      (item: any) => item.type === 'file_search_call'
    );
    aiLogger.info({ userId, fileSearchUsed }, 'OpenAI response received');

    // Extract response text
    const outputText = response.output_text;

    if (!outputText || outputText.trim().length === 0) {
      aiLogger.warn({ userId }, 'Empty response from OpenAI');
      return {
        success: false,
        error: "🤔 I couldn't find an answer to your question. Please try rephrasing it.",
      };
    }

    aiLogger.info(
      { userId, responseLength: outputText.length },
      'AI request processed successfully'
    );

    return {
      success: true,
      message: outputText,
      rateLimitInfo: rateLimitResult,
    };
  } catch (error) {
    aiLogger.error({ err: error, userId }, 'OpenAI API error');

    // Handle typed OpenAI errors
    if (error instanceof OpenAI.RateLimitError) {
      return {
        success: false,
        error: '⚠️ Too many AI requests globally. Please try again in a minute.',
      };
    }

    if (error instanceof OpenAI.BadRequestError) {
      return {
        success: false,
        error: '📝 Your message could not be processed. Please try rephrasing it.',
      };
    }

    if (error instanceof OpenAI.AuthenticationError) {
      aiLogger.error('OpenAI authentication failed - check API key');
      return {
        success: false,
        error: '⚙️ AI helper configuration error. Please contact an administrator.',
      };
    }

    if (error instanceof OpenAI.APIConnectionError) {
      return {
        success: false,
        error: '🌐 Could not connect to AI service. Please try again later.',
      };
    }

    if (error instanceof OpenAI.APIError) {
      // Generic API error (includes timeout)
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        return {
          success: false,
          error: '⏱️ AI request timed out. Please try a shorter question.',
        };
      }
    }

    return {
      success: false,
      error: '❌ An error occurred while processing your request. Please try again later.',
    };
  }
}

/**
 * Format AI response for Discord (handle length limits, add footer)
 */
export function formatResponse(response: string, remaining?: number): string {
  // Discord message limit is 2000 chars, reserve space for footer (~100 chars)
  const MAX_LENGTH = 1850;
  let formatted = response;

  // Truncate if too long
  if (formatted.length > MAX_LENGTH) {
    formatted = formatted.slice(0, MAX_LENGTH - 50) + '\n\n*...response was truncated*';
  }

  // Add remaining requests info if close to limit
  if (remaining !== undefined && remaining <= 3) {
    formatted += `\n\n*Requests remaining: ${remaining}/${AI_HELPER_CONFIG.rateLimitRequests}*`;
  }

  return formatted;
}
