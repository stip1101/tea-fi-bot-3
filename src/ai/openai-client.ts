import OpenAI from 'openai';
import { logger } from '../utils/logger';

const apiKey = process.env.OPENAI_API_KEY;

// In production, require API key
if (!apiKey && process.env.NODE_ENV === 'production') {
  throw new Error('OPENAI_API_KEY environment variable is required in production');
}

// Create client only if API key is available
// This prevents accidental API calls with invalid credentials
export const openai: OpenAI | null = apiKey ? new OpenAI({ apiKey }) : null;

// Log warning in development if API key is missing
if (!apiKey) {
  logger.warn('OPENAI_API_KEY not set - AI helper will not work');
}

export const aiLogger = logger.child({ module: 'ai' });
