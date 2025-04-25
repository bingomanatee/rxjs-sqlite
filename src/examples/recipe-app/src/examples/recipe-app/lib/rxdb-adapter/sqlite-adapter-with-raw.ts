/**
 * SQLite adapter for RxDB with raw query access
 * This extends the original adapter to expose the underlying SQLite instance
 */
import { getRxStorageSQLite as originalGetRxStorageSQLite } from './sqlite-adapter';
import type { RxStorage, RxStorageInstanceCreationParams } from 'rxdb';
import type Database from 'better-sqlite3';

// Extend the original function with static properties
interface EnhancedGetRxStorageSQLite {
  (options?: any): RxStorage<any, any>;
  lastDB?: Database.Database;
  getLastDB?: () => Database.Database | undefined;
}

/**
 * Enhanced version of getRxStorageSQLite that exposes the underlying SQLite instance
 */
export const getRxStorageSQLite: EnhancedGetRxStorageSQLite = (options?: any) => {
  // Get the original adapter
  const adapter = originalGetRxStorageSQLite(options);
  
  // Store the original createStorageInstance method
  const originalCreateStorageInstance = adapter.createStorageInstance;
  
  // Override the createStorageInstance method
  adapter.createStorageInstance = async function(params: RxStorageInstanceCreationParams<any, any>) {
    // Call the original method
    const instance = await originalCreateStorageInstance.call(this, params);
    
    // Wait for the database promise to resolve and store it in the static property
    instance.internals.databasePromise.then((db: Database.Database) => {
      getRxStorageSQLite.lastDB = db;
    });
    
    // Return the instance
    return instance;
  };
  
  return adapter;
};

// Add a static method to get the last created database
getRxStorageSQLite.getLastDB = () => {
  return getRxStorageSQLite.lastDB;
};
