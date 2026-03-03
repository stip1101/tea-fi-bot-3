import { AI_HELPER_CONFIG } from './config';
import { aiLogger } from './openai-client';

export interface GuardResult {
  safe: boolean;
  reason?: 'injection' | 'offensive' | 'too_long';
  sanitizedMessage?: string;
}

/**
 * Normalize Unicode text to prevent homoglyph attacks
 * Converts Cyrillic and other look-alike characters to ASCII equivalents
 */
function normalizeUnicode(text: string): string {
  return (
    text
      // NFKC normalization decomposes ligatures and converts compatible characters
      .normalize('NFKC')
      // Cyrillic homoglyphs that look like Latin letters
      .replace(/[\u0430\u0410]/g, 'a') // Cyrillic а/А → a
      .replace(/[\u0435\u0415]/g, 'e') // Cyrillic е/Е → e
      .replace(/[\u0456\u0406\u0457\u0407]/g, 'i') // Cyrillic і/І/ї/Ї → i
      .replace(/[\u043E\u041E]/g, 'o') // Cyrillic о/О → o
      .replace(/[\u0440\u0420]/g, 'p') // Cyrillic р/Р → p
      .replace(/[\u0441\u0421]/g, 'c') // Cyrillic с/С → c
      .replace(/[\u0443\u0423]/g, 'y') // Cyrillic у/У → y (also looks like u)
      .replace(/[\u0445\u0425]/g, 'x') // Cyrillic х/Х → x
      .replace(/[\u0455]/g, 's') // Cyrillic ѕ → s
      .replace(/[\u0458]/g, 'j') // Cyrillic ј → j
      .replace(/[\u0422\u0442]/g, 't') // Cyrillic Т/т → t (uppercase looks similar)
      .replace(/[\u041C\u043C]/g, 'm') // Cyrillic М/м → m
      .replace(/[\u041D\u043D]/g, 'n') // Cyrillic Н/н → h (but often used as n)
      .replace(/[\u041A\u043A]/g, 'k') // Cyrillic К/к → k
      .replace(/[\u0412\u0432]/g, 'b') // Cyrillic В/в → b (uppercase looks like B)
      // Greek homoglyphs
      .replace(/[\u03B1\u0391]/g, 'a') // Greek α/Α → a
      .replace(/[\u03B5\u0395]/g, 'e') // Greek ε/Ε → e
      .replace(/[\u03B9\u0399]/g, 'i') // Greek ι/Ι → i
      .replace(/[\u03BF\u039F]/g, 'o') // Greek ο/Ο → o
      .replace(/[\u03C1\u03A1]/g, 'p') // Greek ρ/Ρ → p
      .replace(/[\u03C5\u03A5]/g, 'y') // Greek υ/Υ → y
      // Common Unicode tricks
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width characters
      .replace(/[\u00A0]/g, ' ') // Non-breaking space → regular space
      .toLowerCase()
  );
}

// Prompt injection patterns - attempts to manipulate the AI
const INJECTION_PATTERNS = [
  // Direct instruction override attempts
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /forget\s+(everything|all|your)\s+(instructions?|rules?|prompts?)/i,

  // Role manipulation
  /you\s+are\s+(now|no longer)\s+a/i,
  /pretend\s+(to\s+be|you're|you\s+are)/i,
  /act\s+as\s+(if|a|an)/i,
  /roleplay\s+as/i,
  /from\s+now\s+on\s+(you|your)/i,

  // System prompt extraction
  /what\s+(is|are)\s+your\s+(system\s+)?(prompt|instructions?|rules?)/i,
  /show\s+(me\s+)?your\s+(system\s+)?(prompt|instructions?)/i,
  /reveal\s+your\s+(system\s+)?(prompt|instructions?)/i,
  /print\s+your\s+(system\s+)?(prompt|instructions?)/i,

  // Jailbreak patterns
  /\bdan\s+mode\b/i,
  /\bdeveloper\s+mode\b/i,
  /\bunlocked\s+mode\b/i,
  /\bjailbreak\b/i,
  /\bbypass\s+(filter|safety|restrictions?)\b/i,

  // Code execution attempts
  /execute\s+(this\s+)?(code|command|script)/i,
  /run\s+(this\s+)?(code|command|script)/i,
  /eval\s*\(/i,
  /\$\{[^}]*\}/i, // Template literal injection (ReDoS-safe)

  // Markdown/formatting exploits
  /```\s*system/i,
  /\[system\]/i,
  /<system>/i,
];

// Offensive content patterns
const OFFENSIVE_PATTERNS = [
  // Slurs and hate speech (basic patterns)
  /\b(n[i1]gg[ae3]r?s?|f[a4]gg?[o0]ts?|k[i1]k[e3]s?|sp[i1]cs?|ch[i1]nks?)\b/i,

  // Violence
  /\b(k[i1]ll\s+(yourself|urself|u)|murder|bomb\s+threat)\b/i,

  // Spam patterns - URL spam (safe regex, no backtracking issues)
  /(https?:\/\/\S+\s*){5,}/, // More than 5 URLs
];

/**
 * Check for excessive repeated characters without regex (ReDoS-safe)
 * Linear time complexity O(n) instead of potentially exponential regex
 */
function hasExcessiveRepeats(text: string): boolean {
  const MAX_CHECK_LENGTH = 2000; // Limit check length for performance
  const checkText = text.slice(0, MAX_CHECK_LENGTH);

  let count = 1;
  for (let i = 1; i < checkText.length; i++) {
    if (checkText[i] === checkText[i - 1]) {
      count++;
      if (count > 10) return true;
    } else {
      count = 1;
    }
  }
  return false;
}

/**
 * Check if message contains prompt injection attempts
 */
function containsInjection(message: string): boolean {
  // Normalize to catch homoglyph attacks
  const normalized = normalizeUnicode(message);
  return INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Check if message contains offensive content
 */
function containsOffensiveContent(message: string): boolean {
  // Normalize to catch homoglyph attacks
  const normalized = normalizeUnicode(message);

  // Check excessive repeats with safe linear function
  if (hasExcessiveRepeats(message)) {
    return true;
  }

  return OFFENSIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Sanitize message content for safe processing
 */
function sanitizeMessage(message: string): string {
  // Remove excessive whitespace
  let sanitized = message.replace(/\s+/g, ' ').trim();

  // Truncate if too long
  if (sanitized.length > AI_HELPER_CONFIG.maxMessageLength) {
    sanitized = sanitized.slice(0, AI_HELPER_CONFIG.maxMessageLength);
  }

  // Remove potential code blocks that might contain injection
  sanitized = sanitized.replace(/```[\s\S]*?```/g, '[code removed]');

  return sanitized;
}

/**
 * Main guard function - validates and sanitizes user messages
 */
export function guardMessage(message: string): GuardResult {
  // Check length first (fastest check)
  if (message.length > AI_HELPER_CONFIG.maxMessageLength * 2) {
    aiLogger.warn({ length: message.length }, 'Message too long, rejected');
    return { safe: false, reason: 'too_long' };
  }

  // Check for injection attempts
  if (containsInjection(message)) {
    // Log only metadata, not content (security best practice)
    aiLogger.warn({ length: message.length }, 'Injection attempt detected');
    return { safe: false, reason: 'injection' };
  }

  // Check for offensive content
  if (containsOffensiveContent(message)) {
    // Log only metadata, not content (security best practice)
    aiLogger.warn({ length: message.length }, 'Offensive content detected');
    return { safe: false, reason: 'offensive' };
  }

  // Sanitize and return
  return {
    safe: true,
    sanitizedMessage: sanitizeMessage(message),
  };
}

/**
 * Get user-friendly error message based on guard rejection reason
 */
export function getGuardErrorMessage(reason: GuardResult['reason']): string {
  switch (reason) {
    case 'injection':
      return '🚫 Your message contains patterns that I cannot process. Please rephrase your question.';
    case 'offensive':
      return '🚫 Please keep our community respectful. I cannot respond to this message.';
    case 'too_long':
      return `🚫 Your message is too long. Please keep it under ${AI_HELPER_CONFIG.maxMessageLength} characters.`;
    default:
      return '🚫 I cannot process this message. Please try again.';
  }
}
