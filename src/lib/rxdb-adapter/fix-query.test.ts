/**
 * Test to verify the fix for the query functionality
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelationalStorageInstanceSQLite } from './relational-sqlite-storage-instance';
import { RxDocumentData, RxJsonSchema } from 'rxdb';
import * as fs from 'fs';
import * as path from 'path';

interface TestDocument {
  name: string;
  preparationTime: number;
  isGlutenFree: boolean;
}

describe('SQLite Query Fix', () => {
  // Create a temporary database file
  const dbPath = path.join(__dirname, 'test-fix-query.sqlite');

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

  it('should correctly insert and query data with the adapter', async () => {
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
      databasePromise: Promise.resolve(require('better-sqlite3')(dbPath))
    });

    // Initialize the storage instance
    await storageInstance.initialize();

    // Insert test documents
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
      },
      {
        id: 'recipe-3',
        name: 'Greek Salad',
        preparationTime: 5,
        isGlutenFree: true,
        _deleted: false,
        _rev: '1-test'
      }
    ];

    // Insert documents directly using the database
    const dbInsert = require('better-sqlite3')(dbPath);

    // Start a transaction
    dbInsert.exec('BEGIN TRANSACTION');

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
        const stmt = dbInsert.prepare(insertSql);
        const result = stmt.run(...values);
        console.log('Insert result:', result);
      }

      // Commit the transaction
      dbInsert.exec('COMMIT');
      console.log('Transaction committed');
    } catch (error) {
      // Rollback on error
      dbInsert.exec('ROLLBACK');
      console.error('Error inserting data:', error);
      throw error;
    } finally {
      // Close the database
      dbInsert.close();
    }

    // Let's check what's in the database first
    const db = require('better-sqlite3')(dbPath);
    const allRows = db.prepare('SELECT * FROM test_db__test_recipes').all();
    console.log('All rows in database:', JSON.stringify(allRows, null, 2));

    // Query by preparationTime <= 10
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
    expect(queryResult.documents.length).toBe(2);
    expect(queryResult.documents[0].name).toBe('Spaghetti Carbonara');
    expect(queryResult.documents[1].name).toBe('Greek Salad');

    // Query by isGlutenFree = true
    const glutenFreeResult = await storageInstance.query({
      query: {
        selector: {
          isGlutenFree: true
        },
        sort: [{ id: 'asc' }],
        skip: 0,
        limit: 10
      }
    });

    console.log('Query results (gluten free):', JSON.stringify(glutenFreeResult.documents, null, 2));
    expect(glutenFreeResult.documents.length).toBe(2);
    expect(glutenFreeResult.documents[0].name).toBe('Chicken Curry');
    expect(glutenFreeResult.documents[1].name).toBe('Greek Salad');

    // Query with multiple conditions
    const multiQueryResult = await storageInstance.query({
      query: {
        selector: {
          preparationTime: {
            $lte: 10
          },
          isGlutenFree: true
        },
        sort: [{ id: 'asc' }],
        skip: 0,
        limit: 10
      }
    });

    console.log('Query results (prep time <= 10 AND gluten free):', JSON.stringify(multiQueryResult.documents, null, 2));
    expect(multiQueryResult.documents.length).toBe(1);
    expect(multiQueryResult.documents[0].name).toBe('Greek Salad');

    // Close the storage instance
    await storageInstance.close();
  });
});
