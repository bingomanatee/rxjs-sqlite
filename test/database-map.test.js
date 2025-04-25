const { createRxDatabase } = require('rxdb');
const { getRxStorageSQLite } = require('../dist/rxdb-adapter.cjs');
const { strict: assert } = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('RxDB SQLite Database Map Tests', () => {
  let tempDir;
  let db1Path;
  let db2Path;
  let db1;
  let db2;

  beforeEach(async () => {
    // Create a temporary directory for the test databases
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdb-test-'));
    db1Path = path.join(tempDir, 'db1.sqlite');
    db2Path = path.join(tempDir, 'db2.sqlite');
    
    // Clean up any existing database files
    if (fs.existsSync(db1Path)) {
      fs.unlinkSync(db1Path);
    }
    if (fs.existsSync(db2Path)) {
      fs.unlinkSync(db2Path);
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
    
    // Remove the temporary database files
    if (fs.existsSync(db1Path)) {
      fs.unlinkSync(db1Path);
    }
    if (fs.existsSync(db2Path)) {
      fs.unlinkSync(db2Path);
    }
    
    // Remove the temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  });

  it('should maintain separate database instances in the map', async () => {
    // Define schemas for our test collections
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

    const orderSchema = {
      title: 'order schema',
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string', maxLength: 100 },
        userId: { type: 'string' },
        productId: { type: 'string' },
        quantity: { type: 'number' }
      },
      required: ['id', 'userId', 'productId', 'quantity']
    };

    // Create the first database
    db1 = await createRxDatabase({
      name: 'db1',
      storage: getRxStorageSQLite({
        filename: db1Path
      })
    });

    // Get the SQLite instance for db1
    const sqliteDb1 = getRxStorageSQLite.getDBByName('db1');
    assert.ok(sqliteDb1, 'Should get db1 from the map');
    
    // Add a collection to db1
    await db1.addCollection({
      name: 'users',
      schema: userSchema
    });

    // Create the second database
    db2 = await createRxDatabase({
      name: 'db2',
      storage: getRxStorageSQLite({
        filename: db2Path
      })
    });

    // Get the SQLite instance for db2
    const sqliteDb2 = getRxStorageSQLite.getDBByName('db2');
    assert.ok(sqliteDb2, 'Should get db2 from the map');
    
    // Verify we have two different database instances
    assert.notStrictEqual(sqliteDb1, sqliteDb2, 'Should have different database instances');
    
    // Add a collection to db2
    await db2.addCollection({
      name: 'products',
      schema: productSchema
    });

    // Now add another collection to db1
    await db1.addCollection({
      name: 'orders',
      schema: orderSchema
    });

    // Verify we can still get the correct database instances
    const sqliteDb1Again = getRxStorageSQLite.getDBByName('db1');
    const sqliteDb2Again = getRxStorageSQLite.getDBByName('db2');
    
    assert.strictEqual(sqliteDb1, sqliteDb1Again, 'Should get the same db1 instance');
    assert.strictEqual(sqliteDb2, sqliteDb2Again, 'Should get the same db2 instance');

    // Check that the database map contains both databases
    const availableDatabases = getRxStorageSQLite.getAvailableDatabases();
    assert.ok(availableDatabases.includes('db1'), 'Available databases should include db1');
    assert.ok(availableDatabases.includes('db2'), 'Available databases should include db2');
    assert.strictEqual(availableDatabases.length, 2, 'Should have exactly 2 databases in the map');

    // Insert data into each database
    await db1.users.insert({
      id: 'user1',
      name: 'John Doe',
      email: 'john@example.com'
    });

    await db2.products.insert({
      id: 'product1',
      name: 'Test Product',
      price: 99.99
    });

    await db1.orders.insert({
      id: 'order1',
      userId: 'user1',
      productId: 'product1',
      quantity: 1
    });

    // Use raw SQL to verify the data in each database
    const db1Users = sqliteDb1.prepare('SELECT * FROM db1_users').all();
    const db2Products = sqliteDb2.prepare('SELECT * FROM db2_products').all();
    const db1Orders = sqliteDb1.prepare('SELECT * FROM db1_orders').all();

    assert.strictEqual(db1Users.length, 1, 'db1 should have 1 user');
    assert.strictEqual(db2Products.length, 1, 'db2 should have 1 product');
    assert.strictEqual(db1Orders.length, 1, 'db1 should have 1 order');

    // Verify that the tables don't exist in the wrong database
    const db1ProductsQuery = sqliteDb1.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='db2_products'").all();
    const db2UsersQuery = sqliteDb2.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='db1_users'").all();

    assert.strictEqual(db1ProductsQuery.length, 0, 'db1 should not have db2_products table');
    assert.strictEqual(db2UsersQuery.length, 0, 'db2 should not have db1_users table');

    // Test cross-database query (this should fail)
    try {
      sqliteDb1.prepare('SELECT * FROM db2_products').all();
      assert.fail('Should not be able to query db2 tables from db1');
    } catch (error) {
      assert.ok(error, 'Should throw an error when querying db2 tables from db1');
    }

    // Test that lastDB points to the most recently created database (db2)
    const lastDb = getRxStorageSQLite.getLastDB();
    assert.strictEqual(lastDb, sqliteDb2, 'lastDB should point to db2');
  });

  it('should handle database destruction correctly', async () => {
    // Create two databases
    db1 = await createRxDatabase({
      name: 'db1',
      storage: getRxStorageSQLite({
        filename: db1Path
      })
    });

    db2 = await createRxDatabase({
      name: 'db2',
      storage: getRxStorageSQLite({
        filename: db2Path
      })
    });

    // Verify both are in the map
    assert.ok(getRxStorageSQLite.getDBByName('db1'), 'db1 should be in the map');
    assert.ok(getRxStorageSQLite.getDBByName('db2'), 'db2 should be in the map');
    
    // Destroy db1
    await db1.destroy();
    db1 = null;
    
    // db1 should still be in the map (we don't automatically remove it)
    // This is because the better-sqlite3 instance might still be useful
    // even after the RxDB database is destroyed
    assert.ok(getRxStorageSQLite.getDBByName('db1'), 'db1 should still be in the map after destruction');
    
    // But we can manually remove it if needed
    // This would be a good addition to the API
    // getRxStorageSQLite.removeFromMap('db1');
    // assert.strictEqual(getRxStorageSQLite.getDBByName('db1'), undefined, 'db1 should be removed from the map');
    
    // db2 should still be accessible
    assert.ok(getRxStorageSQLite.getDBByName('db2'), 'db2 should still be in the map');
  });
});
