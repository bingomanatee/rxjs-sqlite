/**
 * Test to verify the direct insert approach
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { RelationalStorageInstanceSQLite } from './relational-sqlite-storage-instance';
import { RxDocumentData, RxJsonSchema } from 'rxdb';

interface TestDocument {
  name: string;
  preparationTime: number;
  isGlutenFree: boolean;
}

describe('Direct Insert Test', () => {
  // Create a temporary database file
  const dbPath = path.join(__dirname, 'test-direct-insert.sqlite');
  
  // Clean up any existing test database
  beforeEach(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });
  
  afterEach(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should insert documents directly into the database', async () => {
    // Create a schema for the test
    const schema: RxJsonSchema<TestDocument> = {
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: {
          type: 'string',
          maxLength: 100
        },
        name: {
          type: 'string'
        },
        preparationTime: {
          type: 'number'
        },
        isGlutenFree: {
          type: 'boolean'
        }
      },
      required: ['id', 'name', 'preparationTime', 'isGlutenFree']
    };
    
    // Create a storage instance
    const storageInstance = new RelationalStorageInstanceSQLite({
      databaseName: 'test_db',
      collectionName: 'test_recipes',
      schema,
      options: {
        devMode: true
      }
    }, {
      databasePromise: Promise.resolve(new Database(dbPath))
    });
    
    // Initialize the storage instance
    await storageInstance.initialize();
    
    // Create test documents
    const documents: RxDocumentData<TestDocument>[] = [
      {
        id: 'recipe-1',
        name: 'Spaghetti Carbonara',
        preparationTime: 10,
        isGlutenFree: false,
        _deleted: false,
        _rev: '1-test'
      },
      {
        id: 'recipe-2',
        name: 'Chicken Curry',
        preparationTime: 15,
        isGlutenFree: true,
        _deleted: false,
        _rev: '1-test'
      }
    ];
    
    // Insert documents using bulkWrite
    for (const doc of documents) {
      await storageInstance.bulkWrite([
        {
          document: doc,
          previous: null
        }
      ], 'test');
    }
    
    // Check what's in the database
    const db = new Database(dbPath);
    const allRows = db.prepare('SELECT * FROM test_db__test_recipes').all();
    console.log('All rows in database after bulkWrite:', JSON.stringify(allRows, null, 2));
    
    // Verify the data was inserted
    expect(allRows.length).toBe(2);
    expect(allRows[0].name).toBe('Spaghetti Carbonara');
    expect(allRows[1].name).toBe('Chicken Curry');
    
    // Close the database
    db.close();
    
    // Close the storage instance
    await storageInstance.close();
  });
});
