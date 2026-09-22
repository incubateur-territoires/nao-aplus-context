import { Pool } from "pg";

let sourcePool: Pool | null = null;

export function getSourcePool(): Pool {
  if (sourcePool) return sourcePool;

  let connectionString = process.env.SOURCE_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "SOURCE_DATABASE_URL environment variable is not set.\n" +
        "Set it to the connection string of the source database (ancien Aplus v1).\n" +
        "Example: SOURCE_DATABASE_URL=postgresql://user:pass@localhost:15432/aplus_prod",
    );
  }

  // Remove sslmode from connection string - we'll configure SSL via Pool options
  connectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, "");
  connectionString = connectionString.replace(/[?&]$/, "");

  sourcePool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  return sourcePool;
}

export async function disconnectSource(): Promise<void> {
  if (sourcePool) {
    await sourcePool.end();
    sourcePool = null;
  }
}
