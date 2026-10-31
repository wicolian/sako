/**
 * Postgres client. Works with any Postgres (Neon, RDS, Cloud SQL, local docker).
 * Set DATABASE_URL.
 */
import postgres from 'postgres';

let client: ReturnType<typeof postgres> | null = null;

export function createNeonClient() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    client = postgres(url, { max: 10, prepare: false });
  }
  return client;
}

export async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  const rows = await createNeonClient().unsafe(query, params as never[]);
  return rows as unknown as T[];
}

export interface Workspace { id: string; name: string; slug?: string; created_at?: string; [k: string]: unknown }
export interface WorkspaceMember { id: string; workspace_id: string; user_id: string; role: string; [k: string]: unknown }
export interface Campaign { id: string; workspace_id: string; name: string; status?: string; [k: string]: unknown }
export interface DesignTemplate { id: string; name: string; html?: string; [k: string]: unknown }
