/**
 * Shared test setup for AI module tests
 * Silences logger output during tests
 */

import { mock } from 'bun:test';

// Create a silent logger mock
const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  trace: () => {},
  fatal: () => {},
  child: () => silentLogger,
};

// Mock the logger module to silence output during tests
mock.module('../utils/logger', () => ({
  logger: silentLogger,
  botLogger: silentLogger,
  jobLogger: silentLogger,
  handlerLogger: silentLogger,
  stateLogger: silentLogger,
}));

// Mock aiLogger from openai-client
mock.module('./openai-client', () => ({
  openai: null,
  aiLogger: silentLogger,
}));

export { silentLogger };
