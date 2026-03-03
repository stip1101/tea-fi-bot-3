/**
 * Custom error types for better error handling and user feedback.
 */

export class WorkAlreadyReviewedError extends Error {
  constructor(
    public workId: string,
    public currentStatus: string
  ) {
    super(`Work ${workId} has already been ${currentStatus}`);
    this.name = 'WorkAlreadyReviewedError';
  }
}

export class UserNotFoundError extends Error {
  constructor(public userId: string) {
    super(`User ${userId} not found`);
    this.name = 'UserNotFoundError';
  }
}

export class WorkNotFoundError extends Error {
  constructor(public workId: string) {
    super(`Work ${workId} not found`);
    this.name = 'WorkNotFoundError';
  }
}

export class UserBannedError extends Error {
  constructor(public userId: string) {
    super(`User ${userId} is banned`);
    this.name = 'UserBannedError';
  }
}

export class InsufficientXpError extends Error {
  constructor(
    public userId: string,
    public currentXp: number,
    public requestedAmount: number
  ) {
    super(`Cannot remove ${requestedAmount} XP from user ${userId} (has ${currentXp})`);
    this.name = 'InsufficientXpError';
  }
}
