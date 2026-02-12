import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

function isRailwayPrivateConnectionString(connectionString: string): boolean {
  return /fd[0-9a-f]{2}:/i.test(connectionString) || /10\./.test(connectionString);
}

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  const publicDatabaseUrl = process.env.DATABASE_PUBLIC_URL;

  if (!databaseUrl && !publicDatabaseUrl) {
    throw new Error("DATABASE_URL or DATABASE_PUBLIC_URL must be set for database connection");
  }

  if (
    databaseUrl &&
    publicDatabaseUrl &&
    isRailwayPrivateConnectionString(databaseUrl)
  ) {
    console.warn("DATABASE_URL appears to be Railway private networking; using DATABASE_PUBLIC_URL fallback.");
    return publicDatabaseUrl;
  }

  return databaseUrl || publicDatabaseUrl!;
}

export function createPgPool(overrides: Partial<pg.PoolConfig> = {}): pg.Pool {
  const connectionString = getDatabaseUrl();
  const useTls = /railway|neon/i.test(connectionString) || Boolean(process.env.PGSSLMODE);

  return new Pool({
    connectionString,
    ssl: useTls ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 10000),
    ...overrides,
  });
}

export const pool = createPgPool();

export const db = drizzle(pool, { schema });
