import type { Work, WorkStatus } from '../../../src/db/schema';

let workCounter = 0;

/**
 * Creates a mock Work object with all required fields.
 * Uses sensible defaults that can be overridden.
 */
export function createMockWork(overrides?: Partial<Work>): Work {
  workCounter++;
  const now = new Date();

  const defaultWork: Work = {
    id: `work-${workCounter.toString().padStart(6, '0')}`,
    userId: `user-1`,
    taskId: 'task-1',

    // Work details
    url: `https://twitter.com/user/status/${workCounter}`,
    description: null,

    // Review
    status: 'pending' as WorkStatus,
    reviewerId: null,
    reviewedAt: null,
    reviewNotes: null,

    // Scores
    qualityScore: null,
    xpAwarded: null,
    bonusXpAwarded: 0,

    // AI Analysis
    aiAnalyzed: false,
    aiQualitySuggestion: null,
    aiJustification: null,
    aiRedFlags: null,

    // Discord message tracking
    reviewMessageId: null,
    reviewChannelId: null,

    // Timestamps
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  return { ...defaultWork, ...overrides };
}

/**
 * Creates a mock Work with specific status.
 */
export function createMockWorkWithStatus(
  status: WorkStatus,
  overrides?: Partial<Work>
): Work {
  const statusDefaults: Partial<Work> = {
    status,
  };

  if (status === 'approved') {
    statusDefaults.reviewedAt = new Date();
    statusDefaults.reviewerId = 'reviewer-1';
    statusDefaults.qualityScore = 80;
    statusDefaults.xpAwarded = 100;
  } else if (status === 'rejected') {
    statusDefaults.reviewedAt = new Date();
    statusDefaults.reviewerId = 'reviewer-1';
    statusDefaults.reviewNotes = 'Did not meet quality standards';
  }

  return createMockWork({ ...statusDefaults, ...overrides });
}

/**
 * Creates a mock Work with AI analysis completed.
 */
export function createMockWorkWithAiAnalysis(overrides?: Partial<Work>): Work {
  return createMockWork({
    aiAnalyzed: true,
    aiQualitySuggestion: 75,
    aiJustification: 'Good content quality with decent engagement metrics.',
    aiRedFlags: null,
    ...overrides,
  });
}

/**
 * Creates multiple mock Works for a user.
 */
export function createMockWorksForUser(
  userId: string,
  count: number,
  overrides?: Partial<Work>
): Work[] {
  return Array.from({ length: count }, () =>
    createMockWork({ userId, ...overrides })
  );
}

/**
 * Resets the work counter for clean test isolation.
 */
export function resetWorkFactory(): void {
  workCounter = 0;
}
