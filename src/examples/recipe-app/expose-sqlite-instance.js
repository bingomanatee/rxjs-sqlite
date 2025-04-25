/**
 * Expose SQLite Instance
 *
 * This file demonstrates how to expose the underlying SQLite instance from the RxDB adapter
 * by adding a static method to the RxStorageSQLite class.
 */

// Import the original adapter
const {
  getRxStorageSQLite: originalGetRxStorageSQLite,
} = require("../../lib/rxdb-adapter/sqlite-adapter");

/**
 * Enhanced version of getRxStorageSQLite that exposes the SQLite instance
 */
function getRxStorageSQLite(options = {}) {
  // Get the original adapter
  const adapter = originalGetRxStorageSQLite(options);

  // Store the original createStorageInstance method
  const originalCreateStorageInstance = adapter.createStorageInstance;

  // Override the createStorageInstance method
  adapter.createStorageInstance = async function (params) {
    // Call the original method
    const instance = await originalCreateStorageInstance.call(this, params);

    // Wait for the database promise to resolve
    const db = await instance.internals.databasePromise;

    // Store the database instance in our static map
    if (!getRxStorageSQLite.instances) {
      getRxStorageSQLite.instances = new Map();
    }

    getRxStorageSQLite.instances.set(params.databaseName, {
      db,
      instance,
    });

    // Return the instance
    return instance;
  };

  return adapter;
}

// Static property to store database instances
getRxStorageSQLite.instances = new Map();

/**
 * Static method to get the SQLite instance for a database
 */
getRxStorageSQLite.getSQLiteInstance = function (databaseName) {
  const entry = getRxStorageSQLite.instances.get(databaseName);
  return entry ? entry.db : null;
};

/**
 * Static method to get the storage instance for a database
 */
getRxStorageSQLite.getStorageInstance = function (databaseName) {
  const entry = getRxStorageSQLite.instances.get(databaseName);
  return entry ? entry.instance : null;
};

/**
 * Static method to execute a raw SQL query
 */
getRxStorageSQLite.rawQuery = function (databaseName, sql, params = []) {
  const db = getRxStorageSQLite.getSQLiteInstance(databaseName);
  if (!db) {
    throw new Error(`Database instance not found for: ${databaseName}`);
  }

  try {
    if (sql.trim().toLowerCase().startsWith("select")) {
      return db.prepare(sql).all(params);
    } else {
      return db.prepare(sql).run(params);
    }
  } catch (error) {
    console.error("Error executing raw query:", error);
    throw error;
  }
};

module.exports = {
  getRxStorageSQLite,
};
