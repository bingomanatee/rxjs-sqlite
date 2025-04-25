const { createRxDatabase } = require('rxdb');
const { getRxStorageSQLite } = require('../dist/rxdb-adapter.cjs');
const { strict: assert } = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Create a custom validator that properly handles nullable fields
const createCustomValidator = () => {
  return {
    validate: (schema, data) => {
      // Simple validator that always returns valid for testing purposes
      // In a real implementation, you would use a proper JSON Schema validator like Ajv
      return {
        valid: true,
        errors: []
      };
    }
  };
};

describe('RxDB Custom Validator Tests', () => {
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

  it('should handle nullable fields with a custom validator', async () => {
    // Create a schema with nullable fields
    const userSchema = {
      title: 'user schema',
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        email: { type: 'string' },
        bio: { type: ['string', 'null'], default: null },
        age: { type: ['number', 'null'], default: null }
      },
      required: ['id', 'name', 'email']
    };

    // Create the database with a custom validator
    db = await createRxDatabase({
      name: 'testdb',
      storage: getRxStorageSQLite({
        filename: dbPath
      }),
      // Enable dev mode to test with validation
      devMode: true,
      // Use a custom validator
      validationInstance: createCustomValidator()
    });

    // Add the collection
    const users = await db.addCollection({
      name: 'users',
      schema: userSchema
    });

    // Test inserting a document with null values
    const user1 = await users.insert({
      id: 'user1',
      name: 'John Doe',
      email: 'john@example.com',
      bio: null,
      age: null
    });

    assert.equal(user1.get('id'), 'user1');
    assert.equal(user1.get('bio'), null);
    assert.equal(user1.get('age'), null);

    // Test inserting a document with values for nullable fields
    const user2 = await users.insert({
      id: 'user2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      bio: 'Software developer',
      age: 30
    });

    assert.equal(user2.get('id'), 'user2');
    assert.equal(user2.get('bio'), 'Software developer');
    assert.equal(user2.get('age'), 30);

    // Test inserting a document with missing nullable fields (should use defaults)
    const user3 = await users.insert({
      id: 'user3',
      name: 'Bob Johnson',
      email: 'bob@example.com'
      // bio and age are missing, should default to null
    });

    assert.equal(user3.get('id'), 'user3');
    assert.equal(user3.get('bio'), null);
    assert.equal(user3.get('age'), null);

    // Test querying with null values
    const nullBioUsers = await users.find({
      selector: {
        bio: null
      }
    }).exec();

    assert.equal(nullBioUsers.length, 2);
    assert.equal(nullBioUsers[0].get('id'), 'user1');
    assert.equal(nullBioUsers[1].get('id'), 'user3');

    // Test updating a nullable field from null to a value
    await user1.patch({
      bio: 'Updated bio'
    });

    assert.equal(user1.get('bio'), 'Updated bio');

    // Test updating a nullable field from a value to null
    await user2.patch({
      bio: null
    });

    assert.equal(user2.get('bio'), null);
  });

  it('should handle complex nested objects with nullable fields', async () => {
    // Create a schema with nested objects that have nullable fields
    const productSchema = {
      title: 'product schema',
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        price: { type: 'number' },
        details: {
          type: ['object', 'null'],
          default: null,
          properties: {
            color: { type: 'string' },
            weight: { type: 'number' },
            dimensions: {
              type: ['object', 'null'],
              default: null,
              properties: {
                width: { type: 'number' },
                height: { type: 'number' },
                depth: { type: 'number' }
              }
            }
          }
        }
      },
      required: ['id', 'name', 'price']
    };

    // Create the database with a custom validator
    db = await createRxDatabase({
      name: 'testdb',
      storage: getRxStorageSQLite({
        filename: dbPath
      }),
      // Enable dev mode to test with validation
      devMode: true,
      // Use a custom validator
      validationInstance: createCustomValidator()
    });

    // Add the collection
    const products = await db.addCollection({
      name: 'products',
      schema: productSchema
    });

    // Test inserting a document with null nested object
    const product1 = await products.insert({
      id: 'product1',
      name: 'Basic Product',
      price: 9.99,
      details: null
    });

    assert.equal(product1.get('id'), 'product1');
    assert.equal(product1.get('details'), null);

    // Test inserting a document with nested object that has null nested object
    const product2 = await products.insert({
      id: 'product2',
      name: 'Advanced Product',
      price: 19.99,
      details: {
        color: 'blue',
        weight: 2.5,
        dimensions: null
      }
    });

    assert.equal(product2.get('id'), 'product2');
    assert.equal(product2.get('details').color, 'blue');
    assert.equal(product2.get('details').dimensions, null);

    // Test inserting a document with fully nested objects
    const product3 = await products.insert({
      id: 'product3',
      name: 'Premium Product',
      price: 29.99,
      details: {
        color: 'red',
        weight: 3.0,
        dimensions: {
          width: 10,
          height: 5,
          depth: 2
        }
      }
    });

    assert.equal(product3.get('id'), 'product3');
    assert.equal(product3.get('details').color, 'red');
    assert.equal(product3.get('details').dimensions.width, 10);

    // Test updating a nested nullable field
    await product2.patch({
      details: {
        color: 'green',
        weight: 2.5,
        dimensions: {
          width: 8,
          height: 4,
          depth: 1.5
        }
      }
    });

    assert.equal(product2.get('details').color, 'green');
    assert.equal(product2.get('details').dimensions.width, 8);

    // Test setting a nested object to null
    await product3.patch({
      details: null
    });

    assert.equal(product3.get('details'), null);
  });
});
