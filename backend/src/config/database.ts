import { Pool, PoolClient } from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
  logger.debug('New client connected to database');
});

export const db = {
  query: async <T = any>(text: string, params?: any[]): Promise<T[]> => {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug({ text, duration, rows: result.rowCount }, 'Executed query');
    return result.rows as T[];
  },

  queryOne: async <T = any>(text: string, params?: any[]): Promise<T | null> => {
    const rows = await db.query<T>(text, params);
    return rows[0] || null;
  },

  getClient: async (): Promise<PoolClient> => {
    return pool.connect();
  },

  transaction: async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  healthCheck: async (): Promise<boolean> => {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  },

  close: async (): Promise<void> => {
    await pool.end();
  },
};

export { pool };
