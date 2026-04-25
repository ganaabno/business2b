import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { db } from "./client.js";

export async function withTransaction<T>(
  runner: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("begin");
    const result = await runner(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function q<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return db.query<T>(sql, params);
}
