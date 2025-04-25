const { createRxDatabase } = require('rxdb');
const { getRxStorageSQLite } = require('../dist/rxdb-adapter.cjs');
const { strict: assert } = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('RxDB Validation Strategy Tests', () => {
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

  it('should allow validation before insert with a custom validator', async () => {
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
        bio: { type: ['string', 'null'], default: null }
      },
      required: ['id', 'name', 'email']
    };

    // Create a custom validator that tracks validation calls
    const validationCalls = {
      beforeInsert: 0,
      beforeSave: 0,
      onQuery: 0
    };

    const customValidator = {
      validate: (schema, data) => {
        // Track which validation point was called based on the context
        if (db._validationContext === 'beforeInsert') {
          validationCalls.beforeInsert++;
        } else if (db._validationContext === 'beforeSave') {
          validationCalls.beforeSave++;
        } else if (db._validationContext === 'onQuery') {
          validationCalls.onQuery++;
        }
        
        // Always return valid for this test
        return {
          valid: true,
          errors: []
        };
      }
    };

    // Add a validation context tracker to the database
    db = await createRxDatabase({
      name: 'testdb',
      storage: getRxStorageSQLite({
        filename: dbPath
      }),
      // Enable dev mode to ensure validation is called
      devMode: true,
      // Use our custom validator
      validationInstance: customValidator,
      // Set specific validation strategy - enable beforeInsert, disable others
      validationStrategy: {
        validateBeforeInsert: true,
        validateBeforeSave: false,
        validateOnQuery: false
      }
    });

    // Add _validationContext property to track which validation point is being called
    db._validationContext = null;
    const originalValidate = db.validateDocumentData.bind(db);
    db.validateDocumentData = (schema, data, context) => {
      db._validationContext = context;
      const result = originalValidate(schema, data, context);
      db._validationContext = null;
      return result;
    };

    // Add the collection
    const users = await db.addCollection({
      name: 'users',
      schema: userSchema
    });

    // Test inserting a document - should trigger beforeInsert validation
    await users.insert({
      id: 'user1',
      name: 'John Doe',
      email: 'john@example.com',
      bio: 'Software developer'
    });

    // Test updating a document - should not trigger beforeSave validation
    const user = await users.findOne('user1').exec();
    await user.patch({
      bio: 'Updated bio'
    });

    // Test querying - should not trigger onQuery validation
    await users.find({
      selector: {
        name: 'John Doe'
      }
    }).exec();

    // Verify that only beforeInsert validation was called
    assert.equal(validationCalls.beforeInsert > 0, true, 'validateBeforeInsert should be called');
    assert.equal(validationCalls.beforeSave, 0, 'validateBeforeSave should not be called');
    assert.equal(validationCalls.onQuery, 0, 'validateOnQuery should not be called');
  });

  it('should allow different validation strategy combinations', async () => {
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
        bio: { type: ['string', 'null'], default: null }
      },
      required: ['id', 'name', 'email']
    };

    // Test different validation strategy combinations
    const testCases = [
      {
        strategy: {
          validateBeforeInsert: true,
          validateBeforeSave: true,
          validateOnQuery: true
        },
        description: 'All validations enabled'
      },
      {
        strategy: {
          validateBeforeInsert: true,
          validateBeforeSave: false,
          validateOnQuery: false
        },
        description: 'Only validateBeforeInsert enabled'
      },
      {
        strategy: {
          validateBeforeInsert: false,
          validateBeforeSave: true,
          validateOnQuery: false
        },
        description: 'Only validateBeforeSave enabled'
      },
      {
        strategy: {
          validateBeforeInsert: false,
          validateBeforeSave: false,
          validateOnQuery: true
        },
        description: 'Only validateOnQuery enabled'
      },
      {
        strategy: {
          validateBeforeInsert: false,
          validateBeforeSave: false,
          validateOnQuery: false
        },
        description: 'All validations disabled'
      }
    ];

    for (const testCase of testCases) {
      // Clean up previous database
      if (db) {
        await db.destroy();
        db = null;
      }
      
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }

      // Create a custom validator that tracks validation calls
      const validationCalls = {
        beforeInsert: 0,
        beforeSave: 0,
        onQuery: 0
      };

      const customValidator = {
        validate: (schema, data) => {
          // Track which validation point was called based on the context
          if (db._validationContext === 'beforeInsert') {
            validationCalls.beforeInsert++;
          } else if (db._validationContext === 'beforeSave') {
            validationCalls.beforeSave++;
          } else if (db._validationContext === 'onQuery') {
            validationCalls.onQuery++;
          }
          
          // Always return valid for this test
          return {
            valid: true,
            errors: []
          };
        }
      };

      // Create database with the test case's validation strategy
      db = await createRxDatabase({
        name: 'testdb',
        storage: getRxStorageSQLite({
          filename: dbPath
        }),
        devMode: true,
        validationInstance: customValidator,
        validationStrategy: testCase.strategy
      });

      // Add _validationContext property to track which validation point is being called
      db._validationContext = null;
      const originalValidate = db.validateDocumentData.bind(db);
      db.validateDocumentData = (schema, data, context) => {
        db._validationContext = context;
        const result = originalValidate(schema, data, context);
        db._validationContext = null;
        return result;
      };

      // Add the collection
      const users = await db.addCollection({
        name: 'users',
        schema: userSchema
      });

      // Perform operations that would trigger validation
      await users.insert({
        id: 'user1',
        name: 'John Doe',
        email: 'john@example.com',
        bio: 'Software developer'
      });

      const user = await users.findOne('user1').exec();
      await user.patch({
        bio: 'Updated bio'
      });

      await users.find({
        selector: {
          name: 'John Doe'
        }
      }).exec();

      // Verify that validation was called according to the strategy
      assert.equal(
        validationCalls.beforeInsert > 0, 
        testCase.strategy.validateBeforeInsert, 
        `${testCase.description}: validateBeforeInsert should ${testCase.strategy.validateBeforeInsert ? '' : 'not '}be called`
      );
      
      assert.equal(
        validationCalls.beforeSave > 0, 
        testCase.strategy.validateBeforeSave, 
        `${testCase.description}: validateBeforeSave should ${testCase.strategy.validateBeforeSave ? '' : 'not '}be called`
      );
      
      assert.equal(
        validationCalls.onQuery > 0, 
        testCase.strategy.validateOnQuery, 
        `${testCase.description}: validateOnQuery should ${testCase.strategy.validateOnQuery ? '' : 'not '}be called`
      );
    }
  });
});
