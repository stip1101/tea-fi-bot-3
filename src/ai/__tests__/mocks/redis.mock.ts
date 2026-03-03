/**
 * Redis mock for testing
 * Simulates Redis operations without actual connection
 */

export interface MockRedisState {
  data: Map<string, string>;
  ttls: Map<string, number>;
  evalResult: [number, string, number] | null;
  shouldThrow: boolean;
}

export function createMockRedisState(): MockRedisState {
  return {
    data: new Map(),
    ttls: new Map(),
    evalResult: null,
    shouldThrow: false,
  };
}

export function createMockRedis(state: MockRedisState) {
  return {
    get: async (key: string): Promise<string | null> => {
      if (state.shouldThrow) throw new Error('Redis connection error');
      return state.data.get(key) ?? null;
    },

    set: async (key: string, value: string): Promise<'OK'> => {
      if (state.shouldThrow) throw new Error('Redis connection error');
      state.data.set(key, value);
      return 'OK';
    },

    setex: async (key: string, seconds: number, value: string): Promise<'OK'> => {
      if (state.shouldThrow) throw new Error('Redis connection error');
      state.data.set(key, value);
      state.ttls.set(key, seconds);
      return 'OK';
    },

    del: async (...keys: string[]): Promise<number> => {
      if (state.shouldThrow) throw new Error('Redis connection error');
      let deleted = 0;
      for (const key of keys) {
        if (state.data.has(key)) {
          state.data.delete(key);
          state.ttls.delete(key);
          deleted++;
        }
      }
      return deleted;
    },

    ttl: async (key: string): Promise<number> => {
      if (state.shouldThrow) throw new Error('Redis connection error');
      if (!state.data.has(key)) return -2; // Key does not exist
      return state.ttls.get(key) ?? -1; // -1 = no TTL
    },

    eval: async (
      _script: string,
      _numKeys: number,
      ..._args: string[]
    ): Promise<[number, string, number]> => {
      if (state.shouldThrow) throw new Error('Redis connection error');
      if (state.evalResult) {
        return state.evalResult;
      }
      // Default: allowed with 9 remaining
      return [1, 'ok', 9];
    },

    incr: async (key: string): Promise<number> => {
      if (state.shouldThrow) throw new Error('Redis connection error');
      const current = parseInt(state.data.get(key) || '0', 10);
      const newValue = current + 1;
      state.data.set(key, String(newValue));
      return newValue;
    },

    expire: async (key: string, seconds: number): Promise<0 | 1> => {
      if (state.shouldThrow) throw new Error('Redis connection error');
      if (state.data.has(key)) {
        state.ttls.set(key, seconds);
        return 1;
      }
      return 0;
    },
  };
}

export type MockRedis = ReturnType<typeof createMockRedis>;
