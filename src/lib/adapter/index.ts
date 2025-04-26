/**
 * Factory functions for creating SQLite adapters
 */
import { BetterSQLiteAdapter } from './better-sqlite-adapter';
import { SQLiteAdapter } from '../types';

/**
 * Create a new SQLite adapter using better-sqlite3
 * 
 * @param dbPath Path to the SQLite database file
 * @param options Options for better-sqlite3
 * @returns A new SQLite adapter
 */
export function createSQLiteAdapter(dbPath: string, options?: any): SQLiteAdapter {
  if (options) console.log('adapter options', options);
  return new BetterSQLiteAdapter(dbPath, options);
}

// Export types
export * from '../types';
export * from '../utils/sqlite-utils';
