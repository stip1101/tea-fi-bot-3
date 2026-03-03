import Redis from 'ioredis';
import { stateLogger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl && process.env.NODE_ENV === 'production') {
  throw new Error('REDIS_URL environment variable is required in production');
}

const resolvedRedisUrl = redisUrl || 'redis://localhost:6379';

export const redis = new Redis(resolvedRedisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  stateLogger.info('Redis connected');
});

redis.on('error', (err) => {
  stateLogger.error({ err }, 'Redis error');
});

// Work submission state (task selection -> modal)
const WORK_STATE_PREFIX = 'work_state:';
const WORK_STATE_TTL = 600; // 10 minutes

export interface WorkSubmissionState {
  userId: string;
  taskId: string;
}

export async function setWorkSubmissionState(
  interactionId: string,
  state: WorkSubmissionState
): Promise<void> {
  await redis.setex(
    `${WORK_STATE_PREFIX}${interactionId}`,
    WORK_STATE_TTL,
    JSON.stringify(state)
  );
}

export async function getWorkSubmissionState(
  interactionId: string
): Promise<WorkSubmissionState | null> {
  const data = await redis.get(`${WORK_STATE_PREFIX}${interactionId}`);
  if (!data) return null;
  try {
    return JSON.parse(data) as WorkSubmissionState;
  } catch (error) {
    stateLogger.error({ err: error }, 'JSON parse error in work submission state');
    return null;
  }
}

export async function deleteWorkSubmissionState(interactionId: string): Promise<void> {
  await redis.del(`${WORK_STATE_PREFIX}${interactionId}`);
}
