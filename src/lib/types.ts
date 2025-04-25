/**
 * Types for the RxJS SQLite adapter
 */

export type SQLiteValue = string | number | boolean | null | Buffer;

export interface SQLiteRow {
  [key: string]: SQLiteValue;
}

export interface SQLiteQueryOptions {
  params?: SQLiteValue[] | Record<string, SQLiteValue>;
}

export interface SQLiteTransaction {
  execute(sql: string, params?: SQLiteValue[] | Record<string, SQLiteValue>): void;
  query<T = SQLiteRow>(sql: string, params?: SQLiteValue[] | Record<string, SQLiteValue>): T[];
  commit(): void;
  rollback(): void;
}

export interface SQLiteAdapter {
  /**
   * Execute a SQL statement that doesn't return data
   */
  execute(sql: string, options?: SQLiteQueryOptions): void;
  
  /**
   * Execute a SQL query and return the results as an Observable
   */
  query<T = SQLiteRow>(sql: string, options?: SQLiteQueryOptions): import('rxjs').Observable<T[]>;
  
  /**
   * Execute a SQL query and return a single result as an Observable
   */
  queryOne<T = SQLiteRow>(sql: string, options?: SQLiteQueryOptions): import('rxjs').Observable<T | undefined>;
  
  /**
   * Start a transaction
   */
  transaction(): SQLiteTransaction;
  
  /**
   * Create a reactive query that emits new results when the underlying data changes
   */
  reactiveQuery<T = SQLiteRow>(sql: string, options?: SQLiteQueryOptions): import('rxjs').Observable<T[]>;
  
  /**
   * Close the database connection
   */
  close(): void;
}
