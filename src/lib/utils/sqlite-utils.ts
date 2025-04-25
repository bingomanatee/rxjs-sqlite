/**
 * Utility functions for working with SQLite
 */
import { SQLiteRow, SQLiteValue } from '../types';

/**
 * Convert a SQLite result row to a typed object
 */
export function rowToObject<T = SQLiteRow>(row: any): T {
  const result: Record<string, SQLiteValue> = {};
  
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      result[key] = row[key];
    }
  }
  
  return result as unknown as T;
}

/**
 * Convert an array of SQLite result rows to typed objects
 */
export function rowsToObjects<T = SQLiteRow>(rows: any[]): T[] {
  return rows.map(row => rowToObject<T>(row));
}

/**
 * Create a table schema string from a TypeScript interface
 * This is a simple utility for common column types
 */
export function createTableSchema(tableName: string, schema: Record<string, string>, primaryKey?: string): string {
  const columns = Object.entries(schema)
    .map(([column, type]) => {
      if (column === primaryKey) {
        return `${column} ${type} PRIMARY KEY`;
      }
      return `${column} ${type}`;
    })
    .join(', ');
  
  return `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;
}

/**
 * Generate a parameterized INSERT statement
 */
export function createInsertStatement(tableName: string, columns: string[]): string {
  const placeholders = columns.map(() => '?').join(', ');
  return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
}

/**
 * Generate a parameterized UPDATE statement
 */
export function createUpdateStatement(tableName: string, columns: string[], whereColumns: string[]): string {
  const setClause = columns.map(col => `${col} = ?`).join(', ');
  const whereClause = whereColumns.map(col => `${col} = ?`).join(' AND ');
  
  return `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
}
