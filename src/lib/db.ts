import { Pool, type QueryResultRow } from "pg";

// Einzelner Pool pro Prozess. In Next.js (Dev mit HMR) am globalThis hängen,
// damit nicht bei jedem Reload ein neuer Pool entsteht.
declare global {
  // eslint-disable-next-line no-var
  var __jtcPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL fehlt. Lege eine .env nach Vorbild von .env.example an.",
    );
  }
  return new Pool({
    connectionString,
    // Supabase verlangt TLS; lokal (localhost) wird SSL ignoriert.
    ssl: connectionString.includes("localhost")
      ? undefined
      : { rejectUnauthorized: false },
    max: 10,
  });
}

export const pool: Pool = global.__jtcPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  global.__jtcPool = pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query<T>(text, params as never[]);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// Transaktions-Helfer für mehrschrittige Pipeline-Updates.
export async function withTransaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
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
