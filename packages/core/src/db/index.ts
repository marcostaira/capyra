import { Pool, PoolClient } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on("error", (err) => {
      console.error("Unexpected DB pool error", err);
    });
  }
  return pool;
}

export async function query<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}

export async function queryOne<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function migrate(): Promise<void> {
  const sql = readFileSync(join(__dirname, "migrations/001_init.sql"), "utf-8");
  await getPool().query(sql);
  console.log("✅ Database migrated");
}
