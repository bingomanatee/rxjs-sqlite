/**
 * Access Adapter Example
 * 
 * This file demonstrates how to access the underlying SQLite database
 * from an RxDB instance to perform raw queries.
 */
const { createRxDatabase, addRxPlugin } = require('rxdb');
const { RxDBQueryBuilderPlugin } = require('rxdb/dist/plugins/query-builder');
const { RxDBValidatePlugin } = require('rxdb/dist/plugins/validate');
const path = require('path');
const { getRxStorageSQLite } = require('../../lib/rxdb-adapter/sqlite-adapter');

// Add RxDB plugins
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBValidatePlugin);

// Define a simple schema
const recipeSchema = {
  title: 'recipe schema',
  version: 0,
  description: 'Recipe data',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    name: {
      type: 'string'
    }
  },
  required: ['id', 'name']
};

/**
 * Extend RxDatabase with a method to execute raw SQL queries
 * This is a workaround to access the underlying SQLite database
 */
function extendRxDBWithRawQuery(rxdb) {
  // Method 1: Try to access the internal storage
  rxdb.rawQuery = async function(sql, params = []) {
    // Check if we can access the internal storage
    if (!this._storage || !this._storage.internals) {
      throw new Error('Cannot access internal storage');
    }
    
    try {
      // This is speculative and depends on the internal structure of RxDB
      // It might break with RxDB updates
      const sqliteInstance = this._storage.internals.sqlite;
      
      if (!sqliteInstance) {
        throw new Error('SQLite instance not found');
      }
      
      // Execute the query
      if (sql.trim().toLowerCase().startsWith('select')) {
        return sqliteInstance.prepare(sql).all(params);
      } else {
        return sqliteInstance.prepare(sql).run(params);
      }
    } catch (error) {
      console.error('Error executing raw query:', error);
      throw error;
    }
  };
  
  return rxdb;
}

/**
 * Alternative approach: Create a custom plugin that exposes the SQLite instance
 */
const RxDBSQLiteRawQueryPlugin = {
  name: 'sqlite-raw-query',
  rxdb: true,
  prototypes: {
    RxDatabase: (proto) => {
      proto.getSQLiteInstance = function() {
        // This is speculative and depends on the internal structure
        if (this._storage && this._storage.internals && this._storage.internals.sqlite) {
          return this._storage.internals.sqlite;
        }
        return null;
      };
      
      proto.rawQuery = function(sql, params = []) {
        const sqlite = this.getSQLiteInstance();
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
  }
};

/**
 * Another approach: Modify the SQLite adapter to expose the database instance
 */
function createAccessibleSQLiteAdapter() {
  // Get the original adapter
  const originalAdapter = getRxStorageSQLite({
    filename: path.join(__dirname, 'accessible-rxdb.sqlite')
  });
  
  // Create a wrapper that exposes the SQLite instance
  const wrappedAdapter = {
    ...originalAdapter,
    createStorageInstance: async (...args) => {
      const instance = await originalAdapter.createStorageInstance(...args);
      
      // Expose the SQLite instance
      instance.getSQLite = function() {
        return this.internals.sqlite;
      };
      
      // Add a rawQuery method
      instance.rawQuery = function(sql, params = []) {
        const sqlite = this.getSQLite();
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
      
      return instance;
    }
  };
  
  return wrappedAdapter;
}

/**
 * Demonstration of the different approaches
 */
async function demonstrateAccessingAdapter() {
  console.log('Demonstrating approaches to access the SQLite adapter in RxDB...');
  
  try {
    // Approach 1: Extend RxDB after creation
    console.log('\nApproach 1: Extend RxDB after creation');
    const db1 = await createRxDatabase({
      name: 'rxdbtest1',
      storage: getRxStorageSQLite({
        filename: path.join(__dirname, 'rxdb-test1.sqlite')
      })
    });
    
    // Add a collection
    await db1.addCollections({
      recipes: {
        schema: recipeSchema
      }
    });
    
    // Insert a test document
    await db1.recipes.insert({
      id: 'test1',
      name: 'Test Recipe 1'
    });
    
    // Extend the database with raw query capability
    extendRxDBWithRawQuery(db1);
    
    try {
      // Try to execute a raw query
      const result1 = await db1.rawQuery('SELECT * FROM recipes');
      console.log('Raw query result:', result1);
    } catch (error) {
      console.error('Approach 1 failed:', error.message);
      console.log('This approach may not work due to RxDB\'s encapsulation');
    }
    
    // Clean up
    await db1.remove();
    
    // Approach 2: Use a custom plugin
    console.log('\nApproach 2: Use a custom plugin');
    addRxPlugin(RxDBSQLiteRawQueryPlugin);
    
    const db2 = await createRxDatabase({
      name: 'rxdbtest2',
      storage: getRxStorageSQLite({
        filename: path.join(__dirname, 'rxdb-test2.sqlite')
      })
    });
    
    // Add a collection
    await db2.addCollections({
      recipes: {
        schema: recipeSchema
      }
    });
    
    // Insert a test document
    await db2.recipes.insert({
      id: 'test2',
      name: 'Test Recipe 2'
    });
    
    try {
      // Try to execute a raw query
      const result2 = await db2.rawQuery('SELECT * FROM recipes');
      console.log('Raw query result:', result2);
    } catch (error) {
      console.error('Approach 2 failed:', error.message);
      console.log('This approach may not work due to RxDB\'s encapsulation');
    }
    
    // Clean up
    await db2.remove();
    
    // Approach 3: Modify the adapter
    console.log('\nApproach 3: Modify the adapter');
    const accessibleAdapter = createAccessibleSQLiteAdapter();
    
    const db3 = await createRxDatabase({
      name: 'rxdbtest3',
      storage: accessibleAdapter
    });
    
    // Add a collection
    await db3.addCollections({
      recipes: {
        schema: recipeSchema
      }
    });
    
    // Insert a test document
    await db3.recipes.insert({
      id: 'test3',
      name: 'Test Recipe 3'
    });
    
    try {
      // Try to access the storage instance
      const storage = db3._storage;
      
      if (storage && typeof storage.rawQuery === 'function') {
        const result3 = await storage.rawQuery('SELECT * FROM recipes');
        console.log('Raw query result:', result3);
      } else {
        throw new Error('Storage does not have rawQuery method');
      }
    } catch (error) {
      console.error('Approach 3 failed:', error.message);
      console.log('This approach may not work due to RxDB\'s encapsulation');
    }
    
    // Clean up
    await db3.remove();
    
    // Approach 4: The most reliable approach - create a separate SQLite connection
    console.log('\nApproach 4: Create a separate SQLite connection');
    const betterSqlite3 = require('better-sqlite3');
    
    // Create a database with RxDB
    const db4 = await createRxDatabase({
      name: 'rxdbtest4',
      storage: getRxStorageSQLite({
        filename: path.join(__dirname, 'rxdb-test4.sqlite')
      })
    });
    
    // Add a collection
    await db4.addCollections({
      recipes: {
        schema: recipeSchema
      }
    });
    
    // Insert a test document
    await db4.recipes.insert({
      id: 'test4',
      name: 'Test Recipe 4'
    });
    
    // Create a separate connection to the same database file
    const sqliteDb = new betterSqlite3(path.join(__dirname, 'rxdb-test4.sqlite'));
    
    // Execute a raw query
    const result4 = sqliteDb.prepare('SELECT * FROM recipes').all();
    console.log('Raw query result:', result4);
    
    // Close the separate connection
    sqliteDb.close();
    
    // Clean up
    await db4.remove();
    
    console.log('\nConclusion:');
    console.log('The most reliable approach is to create a separate SQLite connection');
    console.log('This allows you to execute raw SQL queries while still using RxDB for its reactive features');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the demonstration
demonstrateAccessingAdapter();
