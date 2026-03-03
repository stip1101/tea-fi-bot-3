/**
 * Discord.js mock utilities for testing
 */

export interface MockMessageOptions {
  content?: string;
  authorId?: string;
  mentionedUserIds?: string[];
  reference?: { messageId: string } | null;
}

export interface MockMessage {
  content: string;
  author: {
    id: string;
  };
  mentions: {
    has: (userId: string) => boolean;
  };
  reference: { messageId: string } | null;
}

/**
 * Create a mock Discord message for testing
 */
export function createMockMessage(options: MockMessageOptions = {}): MockMessage {
  const {
    content = 'Test message',
    authorId = '123456789012345678',
    mentionedUserIds = [],
    reference = null,
  } = options;

  return {
    content,
    author: {
      id: authorId,
    },
    mentions: {
      has: (userId: string) => mentionedUserIds.includes(userId),
    },
    reference,
  };
}

/**
 * Generate a valid Discord user ID (17-19 digits)
 */
export function generateValidUserId(length: 17 | 18 | 19 = 18): string {
  const start = length === 17 ? '1' : length === 18 ? '10' : '100';
  const remaining = length - start.length;
  let id = start;
  for (let i = 0; i < remaining; i++) {
    id += Math.floor(Math.random() * 10).toString();
  }
  return id;
}
