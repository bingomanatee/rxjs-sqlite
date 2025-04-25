/**
 * SQLiteBasics implementation for better-sqlite3
 */
import Database from 'better-sqlite3';
import type { SQLiteBasics, SQLiteQueryWithParams } from 'rxdb/dist/types/plugins/storage-sqlite/sqlite-types';

/**
 * Implementation of SQLiteBasics for better-sqlite3
 */
export const getSQLiteBasicsBetterSQLite = (options?: Database.Options): SQLiteBasics<Database.Database> => {
  return {
    debugId: 'better-sqlite3',

    /**
     * Opens a new database connection
     */
    open: async (name: string): Promise<Database.Database> => {
      const db = new Database(name, options);

      // Enable foreign keys support
      db.pragma('foreign_keys = ON');

      return db;
    },

    /**
     * Returns the query result rows
     */
    all: async (db: Database.Database, queryWithParams: SQLiteQueryWithParams): Promise<any[]> => {
      try {
        const stmt = db.prepare(queryWithParams.query);
        return stmt.all(...queryWithParams.params);
      } catch (error) {
        console.error('SQLite query error:', error);
        console.error('Query:', queryWithParams.query);
        console.error('Params:', queryWithParams.params);
        console.error('Context:', queryWithParams.context);
        throw error;
      }
    },

    /**
     * Run a query. Return nothing.
     */
    run: async (db: Database.Database, queryWithParams: SQLiteQueryWithParams): Promise<void> => {
      try {
        const stmt = db.prepare(queryWithParams.query);
        stmt.run(...queryWithParams.params);
      } catch (error) {
        console.error('SQLite run error:', error);
        console.error('Query:', queryWithParams.query);
        console.error('Params:', queryWithParams.params);
        console.error('Context:', queryWithParams.context);
        throw error;
      }
    },

    /**
     * Sets a pragma like the WAL mode or other flags.
     */
    setPragma: async (db: Database.Database, key: string, value: string): Promise<void> => {
      try {
        db.pragma(`${key} = ${value}`);
      } catch (error) {
        console.error(`Error setting pragma ${key}=${value}:`, error);
        throw error;
      }
    },

    /**
     * Close the database connection
     */
    close: async (db: Database.Database): Promise<void> => {
      db.close();
    },

    /**
     * Use WAL journal mode for better performance
     */
    journalMode: 'WAL'
  };
};
