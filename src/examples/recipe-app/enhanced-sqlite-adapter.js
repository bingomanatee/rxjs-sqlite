/**
 * Enhanced SQLite Adapter
 * 
 * This file extends the RxDB SQLite adapter to expose the internal SQLite instance,
 * allowing for raw SQL queries without creating additional database connections.
 */
const path = require('path');
const { getRxStorageSQLite: originalGetRxStorageSQLite } = require('../../lib/rxdb-adapter/sqlite-adapter');

// Map to store created SQLite instances
const createdInstances = new Map();

/**
 * Enhanced version of getRxStorageSQLite that exposes the internal SQLite instance
 */
function getRxStorageSQLite(options) {
  // Get the original adapter
  const originalAdapter = originalGetRxStorageSQLite(options);
  
  // Store the original createStorageInstance method
  const originalCreateStorageInstance = originalAdapter.createStorageInstance;
  
  // Override the createStorageInstance method to expose the SQLite instance
  originalAdapter.createStorageInstance = async function(...args) {
    // Call the original method
    const instance = await originalCreateStorageInstance.apply(this, args);
    
    // Extract the database name from the arguments
    const dbName = args[0]?.databaseName || 'unknown';
    
    // Store a reference to the SQLite instance if available
    if (instance && instance.internals && instance.internals.sqlite) {
      createdInstances.set(dbName, instance.internals.sqlite);
      
      // Add a method to the instance to get the SQLite instance
      instance.getSQLiteInstance = () => instance.internals.sqlite;
      
      // Add a method for raw queries
      instance.rawQuery = (sql, params = []) => {
        const sqlite = instance.getSQLiteInstance();
        if (!sqlite) {
          throw new Error('SQLite instance not accessible');
        }
        
        try {
          if (sql.trim().toLowerCase().startsWith('select')) {
            return sqlite.prepare(sql).all(params);
          } else {
            return sqlite.prepare(sql).run(params);
          }
        } catch (error) {
          console.error('Error executing raw query:', error);
          throw error;
        }
      };
    }
    
    return instance;
  };
  
  return originalAdapter;
}

// Static method to get a SQLite instance by database name
getRxStorageSQLite.getInternalSQLiteInstance = (databaseName) => {
  return createdInstances.get(databaseName);
};

// Static method to execute a raw query on a database
getRxStorageSQLite.rawQuery = (databaseName, sql, params = []) => {
  const sqlite = getRxStorageSQLite.getInternalSQLiteInstance(databaseName);
  if (!sqlite) {
    throw new Error(`SQLite instance not found for database: ${databaseName}`);
  }
  
  try {
    if (sql.trim().toLowerCase().startsWith('select')) {
      return sqlite.prepare(sql).all(params);
    } else {
      return sqlite.prepare(sql).run(params);
    }
  } catch (error) {
    console.error('Error executing raw query:', error);
    throw error;
  }
};

module.exports = {
  getRxStorageSQLite
};
