/**
 * OpenAI mock utilities for testing
 */

// Re-create OpenAI error classes for testing
// These match the structure of the actual OpenAI SDK errors

export class MockAPIError extends Error {
  status: number;
  headers: Record<string, string>;

  constructor(
    status: number,
    message: string,
    headers: Record<string, string> = {}
  ) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.headers = headers;
  }
}

export class MockRateLimitError extends MockAPIError {
  constructor(message = 'Rate limit exceeded') {
    super(429, message);
    this.name = 'RateLimitError';
  }
}

export class MockBadRequestError extends MockAPIError {
  constructor(message = 'Bad request') {
    super(400, message);
    this.name = 'BadRequestError';
  }
}

export class MockAuthenticationError extends MockAPIError {
  constructor(message = 'Invalid API key') {
    super(401, message);
    this.name = 'AuthenticationError';
  }
}

export class MockAPIConnectionError extends Error {
  constructor(message = 'Connection error') {
    super(message);
    this.name = 'APIConnectionError';
  }
}

export interface MockOpenAIResponse {
  output_text: string | null;
}

export interface MockOpenAIState {
  response: MockOpenAIResponse | null;
  error: Error | null;
}

export function createMockOpenAIState(): MockOpenAIState {
  return {
    response: { output_text: 'This is a test response from AI.' },
    error: null,
  };
}

export function createMockOpenAI(state: MockOpenAIState) {
  return {
    responses: {
      create: async (): Promise<MockOpenAIResponse> => {
        if (state.error) {
          throw state.error;
        }
        if (!state.response) {
          return { output_text: null };
        }
        return state.response;
      },
    },
  };
}

export type MockOpenAI = ReturnType<typeof createMockOpenAI>;
