import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(connectionString, {
  max: 20,
  idle_timeout: 120,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
});

export const db = drizzle(client, { schema });

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export * from './schema';
