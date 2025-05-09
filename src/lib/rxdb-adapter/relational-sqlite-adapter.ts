/**
 * RxDB Relational SQLite Adapter
 * This adapter allows RxDB to use SQLite as a storage engine with a proper relational schema
 */
import type { RxStorage, RxStorageInstanceCreationParams, RxJsonSchema } from 'rxdb';
import type {
  SQLiteInternals,
  SQLiteInstanceCreationOptions,
  SQLiteStorageSettings
} from 'rxdb/dist/types/plugins/storage-sqlite/sqlite-types';
import { getSQLiteBasicsBetterSQLite } from './sqlite-basics';
import { RelationalStorageInstanceSQLite } from './relational-sqlite-storage-instance';
import Database from 'better-sqlite3';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';

/**
 * RxStorage implementation for SQLite using better-sqlite3 with a relational schema
 */
export class RelationalRxStorageSQLite implements RxStorage<SQLiteInternals, SQLiteInstanceCreationOptions> {
  public readonly name: string = 'relational-sqlite';
  public readonly rxdbVersion: string = '16.11.0'; // Match the RxDB version

  constructor(public readonly settings: SQLiteStorageSettings) {}

  /**
   * Create a storage instance for a collection
   */
  async createStorageInstance<RxDocType>(
    params: RxStorageInstanceCreationParams<RxDocType, SQLiteInstanceCreationOptions>
  ): Promise<RelationalStorageInstanceSQLite<RxDocType>> {
    // Get the database name
    const databaseName = params.databaseName;

    // Check if we already have a database instance with this name
    // @ts-ignore - Accessing static map
    const existingDb = getRelationalRxStorageSQLite.databaseMap.get(databaseName);
    if (existingDb) {
      console.log(`Reusing existing relational SQLite database instance for "${databaseName}"`);

      // No need to update the map as the instance is already there

      // Create the storage instance with the existing database
      const storageInstance = new RelationalStorageInstanceSQLite<RxDocType>(
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
    getRelationalRxStorageSQLite.databaseMap.set(databaseName, db);

    // Create the storage instance
    const storageInstance = new RelationalStorageInstanceSQLite<RxDocType>(
      params,
      { databasePromise: Promise.resolve(db) }
    );

    // Initialize the storage instance
    await storageInstance.initialize();

    return storageInstance;
  }
}

/**
 * Factory function to create a relational SQLite storage adapter
 */
export function getRelationalRxStorageSQLite(options?: Database.Options): RxStorage<SQLiteInternals, SQLiteInstanceCreationOptions> {
  // Static property will be added to this function
  const sqliteBasics = getSQLiteBasicsBetterSQLite(options);

  // Create the base storage
  const baseStorage = new RelationalRxStorageSQLite({
    sqliteBasics,
    databaseNamePrefix: 'rxdb-'
  });

  // Wrap the storage with validation
  return wrappedValidateAjvStorage({
    storage: baseStorage
  });
}

// Initialize a static map to store database instances by name
// @ts-ignore - Adding static property to the function
getRelationalRxStorageSQLite.databaseMap = new Map();

// Add a static method to get a database instance by name or from a database object
// @ts-ignore - Adding static method to the function
getRelationalRxStorageSQLite.getDBByName = function(nameOrDatabase: string | any) {
  // If it's a database object, extract the name
  const databaseName = typeof nameOrDatabase === 'string'
    ? nameOrDatabase
    : nameOrDatabase?.name;

  if (!databaseName) {
    throw new Error('Invalid database name or object');
  }

  // @ts-ignore - Accessing static map
  return getRelationalRxStorageSQLite.databaseMap.get(databaseName);
};

// Add a static method to list all available database names
// @ts-ignore - Adding static method to the function
getRelationalRxStorageSQLite.getAvailableDatabases = function() {
  // @ts-ignore - Accessing static map
  return Array.from(getRelationalRxStorageSQLite.databaseMap.keys());
};
