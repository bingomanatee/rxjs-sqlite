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
    // Create a database connection
    const databaseName = params.databaseName;
    const dbPath = `${this.settings.databaseNamePrefix || ''}${databaseName}.sqlite`;

    // Create the database connection
    const databasePromise = this.settings.sqliteBasics.open(dbPath);

    // Set up the database with WAL mode for better performance
    const db = await databasePromise;
    if (this.settings.sqliteBasics.journalMode) {
      await this.settings.sqliteBasics.setPragma(db, 'journal_mode', this.settings.sqliteBasics.journalMode);
    }

    // Store the database instance in the static property
    // @ts-ignore - Adding static property to the function
    getRxStorageSQLite.lastDB = db;

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

// Add a static method to get the last created database instance
// @ts-ignore - Adding static method to the function
getRxStorageSQLite.getLastDB = function() {
  // @ts-ignore - Accessing static property
  return getRxStorageSQLite.lastDB;
};

// Note: We removed the rawQuery method because it could lead to confusion
// when multiple databases are created. Users should save a reference to the
// database instance returned by getLastDB() and use it directly.
