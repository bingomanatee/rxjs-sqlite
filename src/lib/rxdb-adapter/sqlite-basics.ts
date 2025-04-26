/**
 * SQLiteBasics implementation for better-sqlite3
 */
import Database from 'better-sqlite3';
import type { SQLiteBasics, SQLiteQueryWithParams } from 'rxdb/dist/types/plugins/storage-sqlite/sqlite-types';

/**
 * Create a table in the SQLite database
 */
export function createTable(db: Database.Database, tableName: string, columns: string[]): void {
  // Create a basic table with the specified columns
  // All columns are TEXT type for simplicity
  const columnDefs = columns.map(col => `${col} TEXT`).join(', ');

  const query = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnDefs}
    )
  `;

  db.exec(query);
}

/**
 * Insert a document into a table
 */
export function insertDocument(db: Database.Database, tableName: string, document: Record<string, any>): { changes: number } {
  // Get the columns and values from the document
  const columns = Object.keys(document);

  // Convert values to SQLite compatible types (handle booleans)
  const values = Object.values(document).map(value => {
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return value;
  });

  // Create placeholders for the values
  const placeholders = columns.map(() => '?').join(', ');

  // Build the query
  const query = `
    INSERT INTO ${tableName} (${columns.join(', ')})
    VALUES (${placeholders})
  `;

  // Execute the query
  const stmt = db.prepare(query);
  return stmt.run(...values);
}

/**
 * Update a document in a table
 */
export function updateDocument(
  db: Database.Database,
  tableName: string,
  primaryKeyField: string,
  document: Record<string, any>
): { changes: number } {
  // Get the columns and values from the document
  const columns = Object.keys(document).filter(col => col !== primaryKeyField);

  // Convert values to SQLite compatible types (handle booleans)
  const values = columns.map(col => {
    const value = document[col];
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return value;
  });

  // Create the SET clause
  const setClause = columns.map(col => `${col} = ?`).join(', ');

  // Build the query
  const query = `
    UPDATE ${tableName}
    SET ${setClause}
    WHERE ${primaryKeyField} = ?
  `;

  // Add the primary key value to the values array
  values.push(document[primaryKeyField]);

  // Execute the query
  const stmt = db.prepare(query);
  return stmt.run(...values);
}

/**
 * Delete a document from a table
 */
export function deleteDocument(
  db: Database.Database,
  tableName: string,
  primaryKeyField: string,
  primaryKeyValue: string
): { changes: number } {
  // Build the query
  const query = `
    DELETE FROM ${tableName}
    WHERE ${primaryKeyField} = ?
  `;

  // Execute the query
  const stmt = db.prepare(query);
  return stmt.run(primaryKeyValue);
}

/**
 * Find documents in a table
 */
export function findDocuments(
  db: Database.Database,
  queryWithParams: { query: string; params: any[] }
): any[] {
  // Execute the query
  const stmt = db.prepare(queryWithParams.query);
  return stmt.all(...queryWithParams.params);
}

/**
 * Count documents in a table
 */
export function countDocuments(
  db: Database.Database,
  queryWithParams: { query: string; params: any[] }
): number {
  // Execute the query
  const stmt = db.prepare(queryWithParams.query);
  const result = stmt.get(...queryWithParams.params);

  // Return the count
  return result.count;
}

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
