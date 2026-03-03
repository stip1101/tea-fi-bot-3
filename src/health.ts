import { createServer, type Server } from 'node:http';
import { db } from './db';
import { redis } from './state';
import { sql } from 'drizzle-orm';
import { botLogger } from './utils/logger';
import type { Client } from 'discord.js';

let healthServer: Server | null = null;
let discordClient: Client | null = null;

/**
 * Sets the Discord client reference for health checks.
 */
export function setHealthClient(client: Client): void {
  discordClient = client;
}

/**
 * Starts the HTTP health server for Docker/k8s health checks.
 * Returns the server instance for graceful shutdown.
 */
export function startHealthServer(port = parseInt(process.env.HEALTH_PORT || '3000', 10)): Server {
  healthServer = createServer(async (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      try {
        // Check database connectivity
        await db.execute(sql`SELECT 1`);

        // Check Redis connectivity
        await redis.ping();

        // Check Discord client status
        const isDiscordReady = discordClient?.isReady() ?? false;
        if (!isDiscordReady) {
          throw new Error('Discord client not ready');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
      } catch (error) {
        // Do not expose internal error details in response
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'unhealthy' }));
        botLogger.error({ err: error }, 'Health check failed');
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  healthServer.listen(port, () => {
    botLogger.info({ port }, 'Health server listening');
  });

  return healthServer;
}

/**
 * Gracefully closes the health server.
 */
export async function closeHealthServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!healthServer) {
      resolve();
      return;
    }

    healthServer.close((err) => {
      if (err) {
        reject(err);
      } else {
        healthServer = null;
        resolve();
      }
    });
  });
}
