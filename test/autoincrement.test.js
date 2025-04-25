const { createRxDatabase } = require('rxdb');
const { getRelationalRxStorageSQLite } = require('../dist/rxdb-adapter.cjs');
const { strict: assert } = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('RxDB SQLite Autoincrement Tests', () => {
  let db;
  let tempDir;
  let dbPath;

  beforeEach(async () => {
    // Create a temporary directory for the test database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdb-test-'));
    dbPath = path.join(tempDir, 'test-db.sqlite');
    
    // Clean up any existing database
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (db) {
      await db.destroy();
      db = null;
    }
    
    // Remove the temporary database file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    
    // Remove the temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  });

  it('should handle autoincrement primary keys', async () => {
    // Create a schema with an autoincrement primary key
    const taskSchema = {
      title: 'task schema',
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { 
          type: 'integer', 
          autoIncrement: true  // This indicates it's an autoincrement field
        },
        title: { type: 'string' },
        description: { type: 'string' },
        completed: { type: 'boolean', default: false },
        createdAt: { type: 'string' }
      },
      required: ['title']
    };

    // Create the database with the relational adapter
    db = await createRxDatabase({
      name: 'testdb',
      storage: getRelationalRxStorageSQLite({
        filename: dbPath
      }),
      // Use a custom validator to handle nullable fields
      validationStrategy: {
        validateBeforeInsert: false,
        validateBeforeSave: false,
        validateOnQuery: false
      }
    });

    // Add the collection
    const tasks = await db.addCollection({
      name: 'tasks',
      schema: taskSchema
    });

    // Insert a document without specifying the ID (should be auto-generated)
    const task1 = await tasks.insert({
      title: 'Task 1',
      description: 'Description for task 1',
      completed: false,
      createdAt: new Date().toISOString()
    });

    // The ID should be automatically generated
    assert.equal(typeof task1.get('id'), 'number');
    assert.equal(task1.get('id'), 1);

    // Insert another document
    const task2 = await tasks.insert({
      title: 'Task 2',
      description: 'Description for task 2',
      completed: true,
      createdAt: new Date().toISOString()
    });

    // The ID should be incremented
    assert.equal(task2.get('id'), 2);

    // Insert a third document
    const task3 = await tasks.insert({
      title: 'Task 3',
      description: 'Description for task 3',
      completed: false,
      createdAt: new Date().toISOString()
    });

    // The ID should be incremented again
    assert.equal(task3.get('id'), 3);

    // Delete a document
    await task2.remove();

    // Insert a fourth document - should get ID 4, not reuse ID 2
    const task4 = await tasks.insert({
      title: 'Task 4',
      description: 'Description for task 4',
      completed: false,
      createdAt: new Date().toISOString()
    });

    // The ID should be incremented, not reuse the deleted ID
    assert.equal(task4.get('id'), 4);

    // Query the documents
    const allTasks = await tasks.find().exec();
    assert.equal(allTasks.length, 3); // 3 documents (one was deleted)

    // The IDs should be 1, 3, and 4 (2 was deleted)
    const ids = allTasks.map(task => task.get('id')).sort();
    assert.deepEqual(ids, [1, 3, 4]);
  });

  it('should handle autoincrement with custom primary key name', async () => {
    // Create a schema with an autoincrement primary key with a custom name
    const productSchema = {
      title: 'product schema',
      version: 0,
      primaryKey: 'productId', // Custom primary key name
      type: 'object',
      properties: {
        productId: { 
          type: 'integer', 
          autoIncrement: true  // This indicates it's an autoincrement field
        },
        name: { type: 'string' },
        price: { type: 'number' },
        inStock: { type: 'boolean', default: true },
        createdAt: { type: 'string' }
      },
      required: ['name', 'price']
    };

    // Create the database with the relational adapter
    db = await createRxDatabase({
      name: 'testdb',
      storage: getRelationalRxStorageSQLite({
        filename: dbPath
      }),
      // Use a custom validator to handle nullable fields
      validationStrategy: {
        validateBeforeInsert: false,
        validateBeforeSave: false,
        validateOnQuery: false
      }
    });

    // Add the collection
    const products = await db.addCollection({
      name: 'products',
      schema: productSchema
    });

    // Insert a document without specifying the ID (should be auto-generated)
    const product1 = await products.insert({
      name: 'Product 1',
      price: 9.99,
      inStock: true,
      createdAt: new Date().toISOString()
    });

    // The ID should be automatically generated
    assert.equal(typeof product1.get('productId'), 'number');
    assert.equal(product1.get('productId'), 1);

    // Insert another document
    const product2 = await products.insert({
      name: 'Product 2',
      price: 19.99,
      inStock: false,
      createdAt: new Date().toISOString()
    });

    // The ID should be incremented
    assert.equal(product2.get('productId'), 2);

    // Query the documents
    const allProducts = await products.find().exec();
    assert.equal(allProducts.length, 2);

    // The IDs should be 1 and 2
    const ids = allProducts.map(product => product.get('productId')).sort();
    assert.deepEqual(ids, [1, 2]);
  });

  it('should handle mixed autoincrement and string IDs in different collections', async () => {
    // Create schemas with different ID types
    const taskSchema = {
      title: 'task schema',
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { 
          type: 'integer', 
          autoIncrement: true  // Autoincrement integer ID
        },
        title: { type: 'string' },
        completed: { type: 'boolean', default: false }
      },
      required: ['title']
    };

    const userSchema = {
      title: 'user schema',
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string' },  // String ID
        name: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['id', 'name', 'email']
    };

    // Create the database with the relational adapter
    db = await createRxDatabase({
      name: 'testdb',
      storage: getRelationalRxStorageSQLite({
        filename: dbPath
      }),
      validationStrategy: {
        validateBeforeInsert: false,
        validateBeforeSave: false,
        validateOnQuery: false
      }
    });

    // Add the collections
    const tasks = await db.addCollection({
      name: 'tasks',
      schema: taskSchema
    });

    const users = await db.addCollection({
      name: 'users',
      schema: userSchema
    });

    // Insert a task without specifying the ID (should be auto-generated)
    const task1 = await tasks.insert({
      title: 'Task 1',
      completed: false
    });

    // The task ID should be automatically generated
    assert.equal(typeof task1.get('id'), 'number');
    assert.equal(task1.get('id'), 1);

    // Insert a user with a specified string ID
    const user1 = await users.insert({
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com'
    });

    // The user ID should be the string we specified
    assert.equal(typeof user1.get('id'), 'string');
    assert.equal(user1.get('id'), 'user-1');

    // Insert another task
    const task2 = await tasks.insert({
      title: 'Task 2',
      completed: true
    });

    // The task ID should be incremented
    assert.equal(task2.get('id'), 2);

    // Query the documents
    const allTasks = await tasks.find().exec();
    assert.equal(allTasks.length, 2);

    const allUsers = await users.find().exec();
    assert.equal(allUsers.length, 1);
  });
});
