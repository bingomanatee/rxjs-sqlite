/**
 * RxDB SQLite Adapter
 * This adapter allows RxDB to use SQLite as a storage engine
 */
import type { RxStorage, RxStorageInstanceCreationParams } from 'rxdb';
import type {
  SQLiteInternals,
  SQLiteInstanceCreationOptions,
  SQLiteStorageSettings
} from 'rxdb/dist/types/plugins/storage-sqlite/sqlite-types';
import { getSQLiteBasicsBetterSQLite } from './sqlite-basics';
import { RxStorageInstanceSQLite } from './sqlite-storage-instance';
import Database from 'better-sqlite3';

/**
 * RxStorage implementation for SQLite using better-sqlite3
 */
export class RxStorageSQLite implements RxStorage<SQLiteInternals, SQLiteInstanceCreationOptions> {
  public readonly name: string = 'sqlite';
  public readonly rxdbVersion: string = '16.11.0'; // Match the RxDB version

  constructor(public readonly settings: SQLiteStorageSettings) {}

  /**
   * Create a storage instance for a collection
   */
  async createStorageInstance<RxDocType>(
    params: RxStorageInstanceCreationParams<RxDocType, SQLiteInstanceCreationOptions>
  ): Promise<RxStorageInstanceSQLite<RxDocType>> {
    // Get the database name
    const databaseName = params.databaseName;

    // Check if we already have a database instance with this name
    // @ts-ignore - Accessing static map
    const existingDb = getRxStorageSQLite.databaseMap.get(databaseName);
    if (existingDb) {
      console.log(`Reusing existing SQLite database instance for "${databaseName}"`);

      // No need to update the map as the instance is already there

      // Create the storage instance with the existing database
      const storageInstance = new RxStorageInstanceSQLite<RxDocType>(
        params,
        { databasePromise: Promise.resolve(existingDb) }
      );

      // Initialize the storage instance
      await storageInstance.initialize();

      return storageInstance;
    }

    // If no existing instance, create a new database connection
    const dbPath = `${this.settings.databaseNamePrefix || ''}${databaseName}.sqlite`;

    // Create the database connection
    const databasePromise = this.settings.sqliteBasics.open(dbPath);

    // Set up the database with WAL mode for better performance
    const db = await databasePromise;
    if (this.settings.sqliteBasics.journalMode) {
      await this.settings.sqliteBasics.setPragma(db, 'journal_mode', this.settings.sqliteBasics.journalMode);
    }

    // Store the database instance in the map
    // @ts-ignore - Adding to static map
    getRxStorageSQLite.databaseMap.set(databaseName, db);

    // Create the storage instance
    const storageInstance = new RxStorageInstanceSQLite<RxDocType>(
      params,
      { databasePromise: Promise.resolve(db) }
    );

    // Initialize the storage instance
    await storageInstance.initialize();

    return storageInstance;
  }
}

/**
 * Factory function to create a SQLite storage adapter
 */
export function getRxStorageSQLite(options?: Database.Options): RxStorageSQLite {
  // Static property will be added to this function
  const sqliteBasics = getSQLiteBasicsBetterSQLite(options);

  return new RxStorageSQLite({
    sqliteBasics,
    databaseNamePrefix: 'rxdb-'
  });
}

// Initialize a static map to store database instances by name
// @ts-ignore - Adding static property to the function
getRxStorageSQLite.databaseMap = new Map();

// Add a static method to get a database instance by name or from a database object
// @ts-ignore - Adding static method to the function
getRxStorageSQLite.getDBByName = function(nameOrDatabase: string | any) {
  // If it's a database object, extract the name
  const databaseName = typeof nameOrDatabase === 'string'
    ? nameOrDatabase
    : nameOrDatabase?.name;

  if (!databaseName) {
    throw new Error('Invalid database name or object');
  }

  // @ts-ignore - Accessing static map
  return getRxStorageSQLite.databaseMap.get(databaseName);
};

// Add a static method to list all available database names
// @ts-ignore - Adding static method to the function
getRxStorageSQLite.getAvailableDatabases = function() {
  // @ts-ignore - Accessing static map
  return Array.from(getRxStorageSQLite.databaseMap.keys());
};

// Note: We removed the rawQuery method because it could lead to confusion
// when multiple databases are created. Users should save a reference to the
// database instance returned by getLastDB() or getDBByName() and use it directly.
