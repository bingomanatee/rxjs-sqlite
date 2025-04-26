/**
 * Test to bypass the adapter and insert directly into the database
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

describe('Bypass Adapter Test', () => {
  // Create a temporary database file
  const dbPath = path.join(__dirname, 'test-bypass-adapter.sqlite');
  
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

  it('should insert documents directly into the database bypassing the adapter', async () => {
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
    
    // Insert documents directly using the database
    const db = new Database(dbPath);
    
    // Start a transaction
    db.exec('BEGIN TRANSACTION');
    
    try {
      for (const doc of documents) {
        // Convert document to row
        const row = {
          id: doc.id,
          _deleted: doc._deleted ? 1 : 0,
          _rev: doc._rev || '1-initial',
          name: doc.name,
          preparationTime: doc.preparationTime,
          isGlutenFree: doc.isGlutenFree ? 1 : 0,
          _attachments: '{}',
          _meta: '{}'
        };
        
        // Build the SQL statement
        const columns = Object.keys(row).map(col => `"${col}"`).join(', ');
        const placeholders = Object.keys(row).map(() => '?').join(', ');
        const values = Object.values(row);
        
        const insertSql = `INSERT INTO test_db__test_recipes (${columns}) VALUES (${placeholders})`;
        console.log('Insert SQL:', insertSql);
        console.log('Insert values:', values);
        
        // Execute the insert
        const stmt = db.prepare(insertSql);
        const result = stmt.run(...values);
        console.log('Insert result:', result);
      }
      
      // Commit the transaction
      db.exec('COMMIT');
      console.log('Transaction committed');
    } catch (error) {
      // Rollback on error
      db.exec('ROLLBACK');
      console.error('Error inserting data:', error);
      throw error;
    }
    
    // Check what's in the database
    const allRows = db.prepare('SELECT * FROM test_db__test_recipes').all();
    console.log('All rows in database after direct insert:', JSON.stringify(allRows, null, 2));
    
    // Verify the data was inserted
    expect(allRows.length).toBe(2);
    expect(allRows[0].name).toBe('Spaghetti Carbonara');
    expect(allRows[1].name).toBe('Chicken Curry');
    
    // Now try to query using the adapter
    const queryResult = await storageInstance.query({
      query: {
        selector: {
          preparationTime: {
            $lte: 10
          }
        },
        sort: [{ id: 'asc' }],
        skip: 0,
        limit: 10
      }
    });
    
    console.log('Query results (prep time <= 10):', JSON.stringify(queryResult.documents, null, 2));
    expect(queryResult.documents.length).toBe(1);
    expect(queryResult.documents[0].name).toBe('Spaghetti Carbonara');
    
    // Close the database
    db.close();
    
    // Close the storage instance
    await storageInstance.close();
  });
});
