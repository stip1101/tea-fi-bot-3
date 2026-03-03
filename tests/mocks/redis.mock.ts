/**
 * In-memory mock for ioredis.
 * Simulates basic Redis operations for testing.
 */

interface RedisStore {
  data: Map<string, string>;
  ttls: Map<string, number>;
}

let store: RedisStore = {
  data: new Map(),
  ttls: new Map(),
};

/**
 * Creates a mock Redis client that stores data in memory.
 */
export function createMockRedis() {
  return {
    /**
     * Get value by key.
     */
    async get(key: string): Promise<string | null> {
      const ttl = store.ttls.get(key);
      if (ttl !== undefined && Date.now() > ttl) {
        store.data.delete(key);
        store.ttls.delete(key);
        return null;
      }
      return store.data.get(key) ?? null;
    },

    /**
     * Set value for key. Supports EX (expire) and NX (set-if-not-exists) options.
     */
    async set(key: string, value: string, ...args: (string | number)[]): Promise<'OK' | null> {
      const upperArgs = args.map((a) => (typeof a === 'string' ? a.toUpperCase() : a));
      const nxIndex = upperArgs.indexOf('NX');
      const exIndex = upperArgs.indexOf('EX');

      // NX: only set if key does NOT exist
      if (nxIndex !== -1 && store.data.has(key)) {
        return null;
      }

      store.data.set(key, value);

      // EX: set expiration in seconds
      if (exIndex !== -1 && typeof args[exIndex + 1] === 'number') {
        store.ttls.set(key, Date.now() + (args[exIndex + 1] as number) * 1000);
      }

      return 'OK';
    },

    /**
     * Set value with expiration in seconds.
     */
    async setex(key: string, seconds: number, value: string): Promise<'OK'> {
      store.data.set(key, value);
      store.ttls.set(key, Date.now() + seconds * 1000);
      return 'OK';
    },

    /**
     * Delete one or more keys.
     */
    async del(...keys: string[]): Promise<number> {
      let deleted = 0;
      for (const key of keys) {
        if (store.data.has(key)) {
          store.data.delete(key);
          store.ttls.delete(key);
          deleted++;
        }
      }
      return deleted;
    },

    /**
     * Check if key exists.
     */
    async exists(...keys: string[]): Promise<number> {
      return keys.filter((key) => store.data.has(key)).length;
    },

    /**
     * Get remaining TTL for key in seconds.
     */
    async ttl(key: string): Promise<number> {
      const expiry = store.ttls.get(key);
      if (expiry === undefined) {
        return store.data.has(key) ? -1 : -2;
      }
      const remaining = Math.ceil((expiry - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    },

    /**
     * Get all keys matching pattern.
     */
    async keys(pattern: string): Promise<string[]> {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );
      return Array.from(store.data.keys()).filter((key) => regex.test(key));
    },

    /**
     * Hash operations.
     */
    async hget(key: string, field: string): Promise<string | null> {
      const hash = store.data.get(key);
      if (!hash) return null;
      try {
        const obj = JSON.parse(hash);
        return obj[field] ?? null;
      } catch {
        return null;
      }
    },

    async hset(key: string, field: string, value: string): Promise<number> {
      const hash = store.data.get(key);
      let obj: Record<string, string> = {};
      if (hash) {
        try {
          obj = JSON.parse(hash);
        } catch {
          obj = {};
        }
      }
      const isNew = !(field in obj);
      obj[field] = value;
      store.data.set(key, JSON.stringify(obj));
      return isNew ? 1 : 0;
    },

    async hgetall(key: string): Promise<Record<string, string> | null> {
      const hash = store.data.get(key);
      if (!hash) return null;
      try {
        return JSON.parse(hash);
      } catch {
        return null;
      }
    },

    /**
     * Increment operations.
     */
    async incr(key: string): Promise<number> {
      const current = parseInt(store.data.get(key) ?? '0', 10);
      const newValue = current + 1;
      store.data.set(key, newValue.toString());
      return newValue;
    },

    async incrby(key: string, increment: number): Promise<number> {
      const current = parseInt(store.data.get(key) ?? '0', 10);
      const newValue = current + increment;
      store.data.set(key, newValue.toString());
      return newValue;
    },

    /**
     * List operations.
     */
    async lpush(key: string, ...values: string[]): Promise<number> {
      const list = store.data.get(key);
      let arr: string[] = [];
      if (list) {
        try {
          arr = JSON.parse(list);
        } catch {
          arr = [];
        }
      }
      arr.unshift(...values.reverse());
      store.data.set(key, JSON.stringify(arr));
      return arr.length;
    },

    async lrange(key: string, start: number, stop: number): Promise<string[]> {
      const list = store.data.get(key);
      if (!list) return [];
      try {
        const arr = JSON.parse(list);
        if (stop === -1) return arr.slice(start);
        return arr.slice(start, stop + 1);
      } catch {
        return [];
      }
    },

    /**
     * Clear all data in the mock store.
     */
    clear(): void {
      store.data.clear();
      store.ttls.clear();
    },

    /**
     * Connection methods (no-op for mock).
     */
    async connect(): Promise<void> {},
    async disconnect(): Promise<void> {},
    async quit(): Promise<'OK'> {
      return 'OK';
    },
  };
}

/**
 * Reset the mock Redis store.
 */
export function resetMockRedis(): void {
  store = {
    data: new Map(),
    ttls: new Map(),
  };
}

/**
 * Get the current state of the mock store (for debugging).
 */
export function getMockRedisStore(): { data: Map<string, string>; ttls: Map<string, number> } {
  return { ...store };
}
