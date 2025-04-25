const { createRxDatabase } = require('rxdb');
const { 
  getRxStorageSQLite, 
  getRelationalRxStorageSQLite 
} = require('../dist/rxdb-adapter.cjs');
const { strict: assert } = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('RxDB SQLite Same Database Name Test', () => {
  let tempDir;
  let dbPath;
  let db1;
  let db2;
  let relDb1;
  let relDb2;

  beforeEach(async () => {
    // Create a temporary directory for the test databases
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdb-test-'));
    dbPath = path.join(tempDir, 'test-db.sqlite');
    
    // Clean up any existing database files
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (db1) {
      await db1.destroy();
      db1 = null;
    }
    if (db2) {
      await db2.destroy();
      db2 = null;
    }
    if (relDb1) {
      await relDb1.destroy();
      relDb1 = null;
    }
    if (relDb2) {
      await relDb2.destroy();
      relDb2 = null;
    }
    
    // Remove the temporary database files
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    
    // Remove the temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  });

  it('should reuse the same SQLite instance when creating databases with the same name', async () => {
    // Define a schema for our test collection
    const userSchema = {
      title: 'user schema',
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['id', 'name', 'email']
    };

    // Create the first database
    db1 = await createRxDatabase({
      name: 'same-name-db',
      storage: getRxStorageSQLite({
        filename: dbPath
      })
    });

    // Get the SQLite instance for db1
    const sqliteDb1 = getRxStorageSQLite.getDBByName('same-name-db');
    assert.ok(sqliteDb1, 'Should get db1 from the map');
    
    // Add a collection to db1
    await db1.addCollection({
      name: 'users',
      schema: userSchema
    });

    // Insert a document
    await db1.users.insert({
      id: 'user1',
      name: 'John Doe',
      email: 'john@example.com'
    });

    // Create a second database with the same name
    db2 = await createRxDatabase({
      name: 'same-name-db',
      storage: getRxStorageSQLite({
        filename: dbPath
      })
    });

    // Get the SQLite instance for db2
    const sqliteDb2 = getRxStorageSQLite.getDBByName('same-name-db');
    assert.ok(sqliteDb2, 'Should get db2 from the map');
    
    // Verify we have the same database instance
    assert.strictEqual(sqliteDb1, sqliteDb2, 'Should have the same database instance');
    
    // Verify db2 has access to the collection created by db1
    assert.ok(db2.users, 'db2 should have access to the users collection');
    
    // Query data from db2 that was inserted by db1
    const users = await db2.users.find().exec();
    assert.strictEqual(users.length, 1, 'Should have 1 user');
    assert.strictEqual(users[0].name, 'John Doe', 'Should have the correct user data');
    
    // Insert another document using db2
    await db2.users.insert({
      id: 'user2',
      name: 'Jane Smith',
      email: 'jane@example.com'
    });
    
    // Query data from db1 that was inserted by db2
    const updatedUsers = await db1.users.find().exec();
    assert.strictEqual(updatedUsers.length, 2, 'Should have 2 users');
    
    // Check that the database map contains only one entry
    const availableDatabases = getRxStorageSQLite.getAvailableDatabases();
    assert.strictEqual(availableDatabases.length, 1, 'Should have exactly 1 database in the map');
    assert.strictEqual(availableDatabases[0], 'same-name-db', 'Should have the correct database name');
  });

  it('should reuse the same SQLite instance with the relational adapter', async () => {
    // Define a schema for our test collection
    const productSchema = {
      title: 'product schema',
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        price: { type: 'number' }
      },
      required: ['id', 'name', 'price']
    };

    // Create the first database with relational adapter
    relDb1 = await createRxDatabase({
      name: 'same-name-rel-db',
      storage: getRelationalRxStorageSQLite({
        filename: dbPath
      }),
      devMode: false
    });

    // Get the SQLite instance for relDb1
    const relSqliteDb1 = getRelationalRxStorageSQLite.getDBByName('same-name-rel-db');
    assert.ok(relSqliteDb1, 'Should get relDb1 from the map');
    
    // Add a collection to relDb1
    await relDb1.addCollection({
      name: 'products',
      schema: productSchema
    });

    // Insert a document
    await relDb1.products.insert({
      id: 'product1',
      name: 'Test Product',
      price: 99.99
    });

    // Create a second database with the same name
    relDb2 = await createRxDatabase({
      name: 'same-name-rel-db',
      storage: getRelationalRxStorageSQLite({
        filename: dbPath
      }),
      devMode: false
    });

    // Get the SQLite instance for relDb2
    const relSqliteDb2 = getRelationalRxStorageSQLite.getDBByName('same-name-rel-db');
    assert.ok(relSqliteDb2, 'Should get relDb2 from the map');
    
    // Verify we have the same database instance
    assert.strictEqual(relSqliteDb1, relSqliteDb2, 'Should have the same database instance');
    
    // Verify relDb2 has access to the collection created by relDb1
    assert.ok(relDb2.products, 'relDb2 should have access to the products collection');
    
    // Query data from relDb2 that was inserted by relDb1
    const products = await relDb2.products.find().exec();
    assert.strictEqual(products.length, 1, 'Should have 1 product');
    assert.strictEqual(products[0].name, 'Test Product', 'Should have the correct product data');
    
    // Insert another document using relDb2
    await relDb2.products.insert({
      id: 'product2',
      name: 'Another Product',
      price: 49.99
    });
    
    // Query data from relDb1 that was inserted by relDb2
    const updatedProducts = await relDb1.products.find().exec();
    assert.strictEqual(updatedProducts.length, 2, 'Should have 2 products');
    
    // Check that the database map contains only one entry
    const availableDatabases = getRelationalRxStorageSQLite.getAvailableDatabases();
    assert.strictEqual(availableDatabases.length, 1, 'Should have exactly 1 database in the map');
    assert.strictEqual(availableDatabases[0], 'same-name-rel-db', 'Should have the correct database name');
  });

  it('should maintain separate maps for standard and relational adapters', async () => {
    // Create a database with the standard adapter
    db1 = await createRxDatabase({
      name: 'shared-name',
      storage: getRxStorageSQLite({
        filename: dbPath
      })
    });

    // Create a database with the relational adapter but same name
    relDb1 = await createRxDatabase({
      name: 'shared-name',
      storage: getRelationalRxStorageSQLite({
        filename: dbPath
      }),
      devMode: false
    });

    // Get the SQLite instances
    const standardDb = getRxStorageSQLite.getDBByName('shared-name');
    const relationalDb = getRelationalRxStorageSQLite.getDBByName('shared-name');
    
    // Verify we have two different database instances
    assert.ok(standardDb, 'Should get standard db from the map');
    assert.ok(relationalDb, 'Should get relational db from the map');
    assert.notStrictEqual(standardDb, relationalDb, 'Should have different database instances for different adapters');
    
    // Check that each adapter's map contains the correct database
    const standardDatabases = getRxStorageSQLite.getAvailableDatabases();
    const relationalDatabases = getRelationalRxStorageSQLite.getAvailableDatabases();
    
    assert.strictEqual(standardDatabases.length, 1, 'Should have exactly 1 standard database');
    assert.strictEqual(relationalDatabases.length, 1, 'Should have exactly 1 relational database');
    assert.strictEqual(standardDatabases[0], 'shared-name', 'Standard database should have the correct name');
    assert.strictEqual(relationalDatabases[0], 'shared-name', 'Relational database should have the correct name');
  });
});
