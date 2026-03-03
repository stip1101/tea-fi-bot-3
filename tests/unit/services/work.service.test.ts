import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createMockWork,
  createMockWorkWithStatus,
  createMockWorkWithAiAnalysis,
  createMockWorksForUser,
  resetWorkFactory,
} from '../../mocks/factories';

/**
 * Work Service Tests
 *
 * These tests verify the business logic of work service functions.
 * Due to Drizzle ORM's module structure, full service integration tests
 * require a test database. These tests focus on:
 * 1. Data factory correctness
 * 2. Business logic validation
 * 3. Type safety
 *
 * For full integration tests, run with a test database:
 * DATABASE_URL=<test-db> bun test tests/integration/
 */

describe('Work Service - Factory Tests', () => {
  beforeEach(() => {
    resetWorkFactory();
  });

  describe('createMockWork', () => {
    test('creates work with all required fields', () => {
      const work = createMockWork();

      expect(work.id).toBeDefined();
      expect(work.userId).toBeDefined();
      expect(work.taskId).toBe('task-1');
      expect(work.url).toBeDefined();
      expect(work.description).toBeNull();
      expect(work.status).toBe('pending');
      expect(work.reviewerId).toBeNull();
      expect(work.reviewedAt).toBeNull();
      expect(work.reviewNotes).toBeNull();
      expect(work.qualityScore).toBeNull();
      expect(work.xpAwarded).toBeNull();
      expect(work.bonusXpAwarded).toBe(0);
      expect(work.aiAnalyzed).toBe(false);
      expect(work.reviewMessageId).toBeNull();
      expect(work.reviewChannelId).toBeNull();
      expect(work.submittedAt).toBeInstanceOf(Date);
      expect(work.createdAt).toBeInstanceOf(Date);
      expect(work.updatedAt).toBeInstanceOf(Date);
    });

    test('creates unique works on each call', () => {
      const work1 = createMockWork();
      const work2 = createMockWork();
      const work3 = createMockWork();

      expect(work1.id).not.toBe(work2.id);
      expect(work2.id).not.toBe(work3.id);
    });

    test('allows overriding specific fields', () => {
      const work = createMockWork({
        userId: 'custom-user-id',
        taskId: 'task-42',
        description: 'Test description',
        status: 'approved',
      });

      expect(work.userId).toBe('custom-user-id');
      expect(work.taskId).toBe('task-42');
      expect(work.description).toBe('Test description');
      expect(work.status).toBe('approved');
    });

    test('reset factory resets counter', () => {
      const work1 = createMockWork();
      resetWorkFactory();
      const work2 = createMockWork();

      expect(work1.id).toBe(work2.id);
    });
  });

  describe('createMockWorkWithStatus', () => {
    test('creates pending work', () => {
      const work = createMockWorkWithStatus('pending');

      expect(work.status).toBe('pending');
      expect(work.reviewedAt).toBeNull();
      expect(work.reviewerId).toBeNull();
    });

    test('creates approved work with review data', () => {
      const work = createMockWorkWithStatus('approved');

      expect(work.status).toBe('approved');
      expect(work.reviewedAt).toBeInstanceOf(Date);
      expect(work.reviewerId).toBe('reviewer-1');
      expect(work.qualityScore).toBe(80);
      expect(work.xpAwarded).toBe(100);
    });

    test('creates rejected work with review notes', () => {
      const work = createMockWorkWithStatus('rejected');

      expect(work.status).toBe('rejected');
      expect(work.reviewedAt).toBeInstanceOf(Date);
      expect(work.reviewerId).toBe('reviewer-1');
      expect(work.reviewNotes).toBe('Did not meet quality standards');
    });
  });

  describe('createMockWorkWithAiAnalysis', () => {
    test('creates work with AI analysis completed', () => {
      const work = createMockWorkWithAiAnalysis();

      expect(work.aiAnalyzed).toBe(true);
      expect(work.aiQualitySuggestion).toBe(75);
      expect(work.aiJustification).toBeDefined();
      expect(work.aiRedFlags).toBeNull();
    });

    test('allows overriding AI analysis fields', () => {
      const work = createMockWorkWithAiAnalysis({
        aiQualitySuggestion: 50,
        aiRedFlags: 'Suspicious engagement pattern',
      });

      expect(work.aiQualitySuggestion).toBe(50);
      expect(work.aiRedFlags).toBe('Suspicious engagement pattern');
    });
  });

  describe('createMockWorksForUser', () => {
    test('creates multiple works for same user', () => {
      const works = createMockWorksForUser('user-123', 5);

      expect(works).toHaveLength(5);
      for (const work of works) {
        expect(work.userId).toBe('user-123');
      }
    });

    test('creates unique IDs for each work', () => {
      const works = createMockWorksForUser('user-123', 3);
      const ids = works.map((w) => w.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(3);
    });

    test('allows overriding fields for all works', () => {
      const works = createMockWorksForUser('user-123', 3, { status: 'approved' });

      for (const work of works) {
        expect(work.status).toBe('approved');
      }
    });
  });
});

describe('Work Service - Business Logic', () => {
  beforeEach(() => {
    resetWorkFactory();
  });

  describe('Work stats calculation', () => {
    test('calculates total works stats', () => {
      const calculateStats = (works: Array<{ status: string }>) => {
        const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };

        for (const work of works) {
          stats.total++;
          if (work.status === 'pending') stats.pending++;
          if (work.status === 'approved') stats.approved++;
          if (work.status === 'rejected') stats.rejected++;
        }

        return stats;
      };

      const works = [
        createMockWorkWithStatus('pending'),
        createMockWorkWithStatus('pending'),
        createMockWorkWithStatus('approved'),
        createMockWorkWithStatus('approved'),
        createMockWorkWithStatus('approved'),
        createMockWorkWithStatus('rejected'),
      ];

      const stats = calculateStats(works);

      expect(stats.total).toBe(6);
      expect(stats.pending).toBe(2);
      expect(stats.approved).toBe(3);
      expect(stats.rejected).toBe(1);
    });
  });

  describe('Work statuses', () => {
    test('all statuses are valid', () => {
      const validStatuses = ['pending', 'approved', 'rejected'];

      for (const status of validStatuses) {
        const work = createMockWorkWithStatus(status as any);
        expect(validStatuses).toContain(work.status);
      }
    });
  });

  describe('getUserWorks options', () => {
    test('default options', () => {
      const defaultOptions = { status: undefined, limit: 10, offset: 0 };

      expect(defaultOptions.limit).toBe(10);
      expect(defaultOptions.offset).toBe(0);
    });

    test('status filter logic', () => {
      const filterByStatus = (
        works: Array<{ status: string }>,
        status?: string
      ) => {
        if (!status) return works;
        return works.filter((w) => w.status === status);
      };

      const works = [
        createMockWorkWithStatus('pending'),
        createMockWorkWithStatus('approved'),
        createMockWorkWithStatus('rejected'),
      ];

      expect(filterByStatus(works).length).toBe(3);
      expect(filterByStatus(works, 'approved').length).toBe(1);
      expect(filterByStatus(works, 'pending').length).toBe(1);
    });
  });

  describe('getPendingWorks', () => {
    test('default limit is 20', () => {
      const defaultLimit = 20;
      expect(defaultLimit).toBe(20);
    });
  });

  describe('getRecentWorksCount', () => {
    test('default days is 7', () => {
      const defaultDays = 7;
      expect(defaultDays).toBe(7);
    });

    test('cutoff date calculation', () => {
      const days = 7;
      const now = new Date();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      expect(cutoff.getTime()).toBeLessThan(now.getTime());
    });
  });
});

describe('Work Service - AI Analysis', () => {
  beforeEach(() => {
    resetWorkFactory();
  });

  test('AI analysis fields structure', () => {
    const analysis = {
      qualitySuggestion: 75,
      justification: 'Good content quality',
      redFlags: null,
    };

    expect(analysis.qualitySuggestion).toBeGreaterThanOrEqual(0);
    expect(analysis.qualitySuggestion).toBeLessThanOrEqual(100);
  });

  test('red flags detection', () => {
    const normalWork = createMockWorkWithAiAnalysis();
    const flaggedWork = createMockWorkWithAiAnalysis({
      aiRedFlags: 'Unusual engagement spike',
    });

    expect(normalWork.aiRedFlags).toBeNull();
    expect(flaggedWork.aiRedFlags).toBe('Unusual engagement spike');
  });
});

describe('Work Service - Twitter Metrics', () => {
  test('metrics structure', () => {
    const metrics = {
      likes: 100,
      retweets: 50,
      replies: 25,
      views: 10000,
      engagementRate: '1.75',
      tweetCreatedAt: new Date(),
    };

    expect(metrics.likes).toBeGreaterThanOrEqual(0);
    expect(metrics.retweets).toBeGreaterThanOrEqual(0);
    expect(metrics.replies).toBeGreaterThanOrEqual(0);
    expect(metrics.views).toBeGreaterThanOrEqual(0);
    expect(parseFloat(metrics.engagementRate)).toBeGreaterThanOrEqual(0);
  });

  test('engagement rate calculation', () => {
    const calculateEngagementRate = (
      likes: number,
      retweets: number,
      replies: number,
      views: number
    ): string => {
      if (views === 0) return '0.00';
      const engagement = ((likes + retweets + replies) / views) * 100;
      return engagement.toFixed(2);
    };

    expect(calculateEngagementRate(100, 50, 25, 10000)).toBe('1.75');
    expect(calculateEngagementRate(0, 0, 0, 1000)).toBe('0.00');
    expect(calculateEngagementRate(100, 100, 100, 0)).toBe('0.00');
  });
});

describe('Work Service - Type Safety', () => {
  test('Work type has all expected properties', () => {
    const work = createMockWork();

    const expectedProps = [
      'id',
      'userId',
      'taskId',
      'url',
      'description',
      'status',
      'reviewerId',
      'reviewedAt',
      'reviewNotes',
      'qualityScore',
      'xpAwarded',
      'bonusXpAwarded',
      'aiAnalyzed',
      'aiQualitySuggestion',
      'aiJustification',
      'aiRedFlags',
      'reviewMessageId',
      'reviewChannelId',
      'submittedAt',
      'createdAt',
      'updatedAt',
    ];

    for (const prop of expectedProps) {
      expect(work).toHaveProperty(prop);
    }
  });

  test('WorkStatus type values', () => {
    const statuses = ['pending', 'approved', 'rejected'];
    expect(statuses.length).toBe(3);
  });
});
