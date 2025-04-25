const { createRxDatabase } = require('rxdb');
const { getRxStorageSQLite } = require('../dist/rxdb-adapter.cjs');
const { strict: assert } = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('RxDB SQLite Same Collection Names Test', () => {
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

  it('should handle same collection names with different schemas in different databases', async () => {
    // Define two different schemas for the same collection name "items"
    const itemsSchema1 = {
      title: 'items schema 1',
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        category: { type: 'string' },
        // Schema 1 specific fields
        quantity: { type: 'number' },
        inStock: { type: 'boolean' }
      },
      required: ['id', 'name', 'category']
    };

    const itemsSchema2 = {
      title: 'items schema 2',
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        // Schema 2 specific fields
        description: { type: 'string' },
        price: { type: 'number' },
        tags: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['id', 'name']
    };

    // Create two databases with different names
    db1 = await createRxDatabase({
      name: 'inventory',
      storage: getRxStorageSQLite({
        filename: db1Path
      })
    });

    db2 = await createRxDatabase({
      name: 'catalog',
      storage: getRxStorageSQLite({
        filename: db2Path
      })
    });

    // Get the SQLite instances
    const sqliteDb1 = getRxStorageSQLite.getDBByName('inventory');
    const sqliteDb2 = getRxStorageSQLite.getDBByName('catalog');
    
    // Verify we have two different database instances
    assert.ok(sqliteDb1, 'Should get inventory db from the map');
    assert.ok(sqliteDb2, 'Should get catalog db from the map');
    assert.notStrictEqual(sqliteDb1, sqliteDb2, 'Should have different database instances');
    
    // Add collections with the SAME NAME but different schemas to both databases
    const items1 = await db1.addCollection({
      name: 'items', // Same collection name in both databases
      schema: itemsSchema1
    });

    const items2 = await db2.addCollection({
      name: 'items', // Same collection name in both databases
      schema: itemsSchema2
    });

    // Insert data into each collection according to their schema
    await items1.insert({
      id: 'item1',
      name: 'Inventory Item',
      category: 'Equipment',
      quantity: 10,
      inStock: true
    });

    await items2.insert({
      id: 'item1',
      name: 'Catalog Item',
      description: 'A detailed description',
      price: 99.99,
      tags: ['new', 'featured']
    });

    // Verify that each database has its own 'items' table with the correct schema
    // Check table structure for db1
    const db1TableInfo = sqliteDb1.prepare("PRAGMA table_info(inventory_items)").all();
    const db1TableNames = db1TableInfo.map(col => col.name);
    
    // Check table structure for db2
    const db2TableInfo = sqliteDb2.prepare("PRAGMA table_info(catalog_items)").all();
    const db2TableNames = db2TableInfo.map(col => col.name);
    
    // Verify the tables exist with the correct names
    assert.ok(db1TableNames.length > 0, 'inventory_items table should exist');
    assert.ok(db2TableNames.length > 0, 'catalog_items table should exist');

    // Query data from each collection
    const inventoryItems = await items1.find().exec();
    const catalogItems = await items2.find().exec();
    
    // Verify the data is correct and separate
    assert.strictEqual(inventoryItems.length, 1, 'Should have 1 inventory item');
    assert.strictEqual(catalogItems.length, 1, 'Should have 1 catalog item');
    
    const inventoryItem = inventoryItems[0].toJSON();
    const catalogItem = catalogItems[0].toJSON();
    
    // Verify inventory item has the correct schema-specific fields
    assert.strictEqual(inventoryItem.name, 'Inventory Item');
    assert.strictEqual(inventoryItem.category, 'Equipment');
    assert.strictEqual(inventoryItem.quantity, 10);
    assert.strictEqual(inventoryItem.inStock, true);
    assert.strictEqual(inventoryItem.description, undefined); // Should not have catalog fields
    assert.strictEqual(inventoryItem.price, undefined); // Should not have catalog fields
    
    // Verify catalog item has the correct schema-specific fields
    assert.strictEqual(catalogItem.name, 'Catalog Item');
    assert.strictEqual(catalogItem.description, 'A detailed description');
    assert.strictEqual(catalogItem.price, 99.99);
    assert.deepStrictEqual(catalogItem.tags, ['new', 'featured']);
    assert.strictEqual(catalogItem.category, undefined); // Should not have inventory fields
    assert.strictEqual(catalogItem.quantity, undefined); // Should not have inventory fields
    assert.strictEqual(catalogItem.inStock, undefined); // Should not have inventory fields

    // Use raw SQL to verify the data in each database
    const rawInventoryItems = sqliteDb1.prepare('SELECT * FROM inventory_items').all();
    const rawCatalogItems = sqliteDb2.prepare('SELECT * FROM catalog_items').all();
    
    assert.strictEqual(rawInventoryItems.length, 1, 'Should have 1 raw inventory item');
    assert.strictEqual(rawCatalogItems.length, 1, 'Should have 1 raw catalog item');
    
    // Try to access the wrong table in each database (should fail)
    try {
      sqliteDb1.prepare('SELECT * FROM catalog_items').all();
      assert.fail('Should not be able to query catalog_items from inventory database');
    } catch (error) {
      assert.ok(error, 'Should throw an error when querying catalog_items from inventory database');
    }
    
    try {
      sqliteDb2.prepare('SELECT * FROM inventory_items').all();
      assert.fail('Should not be able to query inventory_items from catalog database');
    } catch (error) {
      assert.ok(error, 'Should throw an error when querying inventory_items from catalog database');
    }

    // Test cross-database operations - try to insert data with the wrong schema
    try {
      // Try to insert a catalog-style item into the inventory collection
      await items1.insert({
        id: 'item2',
        name: 'Wrong Schema Item',
        description: 'This should fail',
        price: 123.45,
        tags: ['test']
      });
      assert.fail('Should not be able to insert catalog-style item into inventory collection');
    } catch (error) {
      assert.ok(error, 'Should throw an error when inserting with wrong schema');
    }
    
    try {
      // Try to insert an inventory-style item into the catalog collection
      await items2.insert({
        id: 'item2',
        name: 'Wrong Schema Item',
        category: 'Test',
        quantity: 5,
        inStock: false
      });
      assert.fail('Should not be able to insert inventory-style item into catalog collection');
    } catch (error) {
      assert.ok(error, 'Should throw an error when inserting with wrong schema');
    }
    
    // Verify that no cross-contamination occurred
    const inventoryItemsAfter = await items1.find().exec();
    const catalogItemsAfter = await items2.find().exec();
    
    assert.strictEqual(inventoryItemsAfter.length, 1, 'Should still have only 1 inventory item');
    assert.strictEqual(catalogItemsAfter.length, 1, 'Should still have only 1 catalog item');
  });
});
