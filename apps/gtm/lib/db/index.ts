/**
 * Database Client - Neon PostgreSQL
 * 
 * This provides a Supabase-like query builder API backed by Neon.
 * Allows gradual migration from Supabase to Neon without rewriting all queries.
 * 
 * Usage:
 *   import { db } from '@/lib/db'
 *   
 *   // SELECT
 *   const { data, error } = await db.from('campaigns').select('*').eq('id', id).single()
 *   
 *   // INSERT
 *   const { data, error } = await db.from('campaigns').insert({ name: 'New' }).select().single()
 *   
 *   // UPDATE
 *   const { data, error } = await db.from('campaigns').update({ name: 'Updated' }).eq('id', id)
 *   
 *   // DELETE
 *   const { error } = await db.from('campaigns').delete().eq('id', id)
 */

import { sql as neonSql, createNeonClient } from './neon';

// ============================================================================
// Types
// ============================================================================

export interface QueryResult<T> {
  data: T | null;
  error: Error | null;
}

export interface QueryBuilder<T> {
  select(columns?: string): QueryBuilder<T>;
  insert(data: Record<string, unknown> | Record<string, unknown>[]): QueryBuilder<T>;
  update(data: Record<string, unknown>): QueryBuilder<T>;
  delete(): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  neq(column: string, value: unknown): QueryBuilder<T>;
  gt(column: string, value: unknown): QueryBuilder<T>;
  gte(column: string, value: unknown): QueryBuilder<T>;
  lt(column: string, value: unknown): QueryBuilder<T>;
  lte(column: string, value: unknown): QueryBuilder<T>;
  like(column: string, pattern: string): QueryBuilder<T>;
  ilike(column: string, pattern: string): QueryBuilder<T>;
  is(column: string, value: unknown): QueryBuilder<T>;
  in(column: string, values: unknown[]): QueryBuilder<T>;
  not(column: string, operator: string, value: unknown): QueryBuilder<T>;
  or(filters: string): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  range(from: number, to: number): QueryBuilder<T>;
  single(): Promise<QueryResult<T>>;
  maybeSingle(): Promise<QueryResult<T | null>>;
  then(resolve: (result: QueryResult<T[]>) => void): Promise<void>;
}

// ============================================================================
// Query Builder Implementation
// ============================================================================

class NeonQueryBuilder<T> implements QueryBuilder<T> {
  private tableName: string;
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private selectColumns: string = '*';
  private insertData: Record<string, unknown>[] = [];
  private updateData: Record<string, unknown> = {};
  private conditions: Array<{ column: string; operator: string; value: unknown }> = [];
  private orderBy: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private offsetCount: number | null = null;
  private returnData: boolean = false;

  constructor(table: string) {
    this.tableName = table;
  }

  select(columns: string = '*'): QueryBuilder<T> {
    // If we're in insert/update/delete mode, calling select() means we want RETURNING
    if (this.operation === 'insert' || this.operation === 'update' || this.operation === 'delete') {
      this.returnData = true;
      this.selectColumns = columns;
      return this;
    }
    this.operation = 'select';
    this.selectColumns = columns;
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): QueryBuilder<T> {
    this.operation = 'insert';
    this.insertData = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data: Record<string, unknown>): QueryBuilder<T> {
    this.operation = 'update';
    this.updateData = data;
    return this;
  }

  delete(): QueryBuilder<T> {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown): QueryBuilder<T> {
    this.conditions.push({ column, operator: '=', value });
    return this;
  }

  neq(column: string, value: unknown): QueryBuilder<T> {
    this.conditions.push({ column, operator: '!=', value });
    return this;
  }

  gt(column: string, value: unknown): QueryBuilder<T> {
    this.conditions.push({ column, operator: '>', value });
    return this;
  }

  gte(column: string, value: unknown): QueryBuilder<T> {
    this.conditions.push({ column, operator: '>=', value });
    return this;
  }

  lt(column: string, value: unknown): QueryBuilder<T> {
    this.conditions.push({ column, operator: '<', value });
    return this;
  }

  lte(column: string, value: unknown): QueryBuilder<T> {
    this.conditions.push({ column, operator: '<=', value });
    return this;
  }

  like(column: string, pattern: string): QueryBuilder<T> {
    this.conditions.push({ column, operator: 'LIKE', value: pattern });
    return this;
  }

  ilike(column: string, pattern: string): QueryBuilder<T> {
    this.conditions.push({ column, operator: 'ILIKE', value: pattern });
    return this;
  }

  is(column: string, value: unknown): QueryBuilder<T> {
    this.conditions.push({ column, operator: 'IS', value });
    return this;
  }

  in(column: string, values: unknown[]): QueryBuilder<T> {
    this.conditions.push({ column, operator: 'IN', value: values });
    return this;
  }

  not(column: string, operator: string, value: unknown): QueryBuilder<T> {
    this.conditions.push({ column, operator: `NOT ${operator}`, value });
    return this;
  }

  or(_filters: string): QueryBuilder<T> {
    // Simplified OR handling - for complex OR queries, use raw SQL
    console.warn('or() is simplified - use raw SQL for complex OR conditions');
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T> {
    this.orderBy.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number): QueryBuilder<T> {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number): QueryBuilder<T> {
    this.offsetCount = from;
    this.limitCount = to - from + 1;
    return this;
  }

  // Mark that we want to return data after insert/update
  returning(): QueryBuilder<T> {
    this.returnData = true;
    return this;
  }

  private formatValue(value: unknown): string {
    if (value === null) return 'NULL';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) {
      return `(${value.map(v => this.formatValue(v)).join(', ')})`;
    }
    if (typeof value === 'object') {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
    }
    return String(value);
  }

  private buildWhere(): string {
    if (this.conditions.length === 0) return '';
    
    const clauses = this.conditions.map(c => {
      if (c.operator === 'IS') {
        return `${c.column} IS ${c.value === null ? 'NULL' : 'NOT NULL'}`;
      }
      if (c.operator === 'IN') {
        return `${c.column} IN ${this.formatValue(c.value)}`;
      }
      return `${c.column} ${c.operator} ${this.formatValue(c.value)}`;
    });
    
    return `WHERE ${clauses.join(' AND ')}`;
  }

  private buildOrderBy(): string {
    if (this.orderBy.length === 0) return '';
    const clauses = this.orderBy.map(o => 
      `${o.column} ${o.ascending ? 'ASC' : 'DESC'}`
    );
    return `ORDER BY ${clauses.join(', ')}`;
  }

  private buildLimit(): string {
    let sql = '';
    if (this.limitCount !== null) sql += `LIMIT ${this.limitCount}`;
    if (this.offsetCount !== null) sql += ` OFFSET ${this.offsetCount}`;
    return sql;
  }

  private buildSQL(): string {
    switch (this.operation) {
      case 'select':
        return `SELECT ${this.selectColumns} FROM ${this.tableName} ${this.buildWhere()} ${this.buildOrderBy()} ${this.buildLimit()}`.trim();
      
      case 'insert': {
        if (this.insertData.length === 0) throw new Error('No data to insert');
        const columns = Object.keys(this.insertData[0]);
        const values = this.insertData.map(row => 
          `(${columns.map(col => this.formatValue(row[col])).join(', ')})`
        ).join(', ');
        const returning = this.returnData ? ' RETURNING *' : '';
        return `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES ${values}${returning}`;
      }
      
      case 'update': {
        const setClauses = Object.entries(this.updateData)
          .map(([col, val]) => `${col} = ${this.formatValue(val)}`)
          .join(', ');
        const returning = this.returnData ? ' RETURNING *' : '';
        return `UPDATE ${this.tableName} SET ${setClauses} ${this.buildWhere()}${returning}`;
      }
      
      case 'delete': {
        const returning = this.returnData ? ' RETURNING *' : '';
        return `DELETE FROM ${this.tableName} ${this.buildWhere()}${returning}`;
      }
      
      default:
        throw new Error(`Unknown operation: ${this.operation}`);
    }
  }

  private async execute(): Promise<QueryResult<T[]>> {
    try {
      const sql = this.buildSQL();
      const client = createNeonClient();
      const results = await client.unsafe(sql);
      return { data: results as T[], error: null };
    } catch (err) {
      console.error('Database query error:', err);
      return { data: null, error: err as Error };
    }
  }

  async single(): Promise<QueryResult<T>> {
    this.limitCount = 1;
    const { data, error } = await this.execute();
    
    if (error) return { data: null, error };
    if (!data || data.length === 0) {
      return { data: null, error: new Error('No rows returned') };
    }
    
    return { data: data[0], error: null };
  }

  async maybeSingle(): Promise<QueryResult<T | null>> {
    this.limitCount = 1;
    const { data, error } = await this.execute();
    
    if (error) return { data: null, error };
    
    return { data: data?.[0] ?? null, error: null };
  }

  then(resolve: (result: QueryResult<T[]>) => void): Promise<void> {
    return this.execute().then(resolve);
  }
}

// ============================================================================
// Database Client Factory
// ============================================================================

class DatabaseClient {
  from<T = Record<string, unknown>>(table: string): NeonQueryBuilder<T> {
    return new NeonQueryBuilder<T>(table);
  }

  /**
   * Execute raw SQL query
   */
  async query<T = Record<string, unknown>>(
    sqlQuery: string,
    params?: unknown[]
  ): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const results = await neonSql<T>(sqlQuery, params);
      return { data: results, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  }
}

// Singleton instance
export const db = new DatabaseClient();

// ============================================================================
// Compatibility Layer - createServiceClient replacement
// ============================================================================

/**
 * Creates a Supabase-compatible client interface backed by Neon
 * 
 * This is a drop-in replacement for createServiceClient() from @/lib/supabase/service
 * It provides the same .from().select().eq() API but uses Neon under the hood.
 */
export function createServiceClient() {
  return db;
}

// Re-export for convenience
export { neonSql as sql, createNeonClient } from './neon';
export type { Workspace, WorkspaceMember, Campaign, DesignTemplate } from './neon';
