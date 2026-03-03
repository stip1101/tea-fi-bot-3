import { z } from 'zod';

/**
 * Minimal config schema for extracted modules
 * Projects should extend this with their own requirements
 */
export const envSchema = z.object({
  // Twitter (optional - for scraping)
  TWITTER_COOKIES: z.string().optional(),

  // OpenAI (required for AI analysis)
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),

  // Discord (optional - for notifications)
  TASK_LOGS_CHANNEL_ID: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Load and validate config from environment
 * @param env - Environment object (defaults to process.env)
 * @returns Validated config
 * @throws Error if validation fails
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): EnvConfig {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const errors = result.error.issues.map(issue => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * Create config with explicit values (for testing or manual setup)
 */
export function createConfig(values: Partial<EnvConfig>): EnvConfig {
  return envSchema.parse(values);
}
