/**
 * Low-level test to diagnose SQLite data insertion and query issues
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

describe('SQLite Direct Operations', () => {
  // Create a temporary database file
  const dbPath = path.join(__dirname, 'test-direct.sqlite');

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

  it('should correctly insert and query data with direct SQLite operations', () => {
    // Create a new database connection
    const db = new Database(dbPath);

    // Create a test table with the same structure as our adapter uses
    const createTableSql = `
      CREATE TABLE test_table (
        "id" TEXT PRIMARY KEY,
        "_deleted" INTEGER DEFAULT 0,
        "_rev" TEXT DEFAULT "",
        "name" TEXT,
        "preparationTime" INTEGER,
        "isGlutenFree" INTEGER,
        "_attachments" TEXT DEFAULT "{}",
        "_meta" TEXT DEFAULT "{}"
      )
    `;

    db.exec(createTableSql);
    console.log('Table created');

    // Test 1: Insert a row with standard method
    const insertStmt = db.prepare(`
      INSERT INTO test_table
      ("id", "_deleted", "_rev", "name", "preparationTime", "isGlutenFree", "_attachments", "_meta")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result1 = insertStmt.run(
      'recipe-1',
      0,
      '1-test',
      'Spaghetti Carbonara',
      10,
      0,
      '{}',
      '{}'
    );

    console.log('Insert result 1:', result1);

    // Test 2: Insert a row with named parameters
    const insertNamedStmt = db.prepare(`
      INSERT INTO test_table
      ("id", "_deleted", "_rev", "name", "preparationTime", "isGlutenFree", "_attachments", "_meta")
      VALUES (@id, @deleted, @rev, @name, @prepTime, @glutenFree, @attachments, @meta)
    `);

    const result2 = insertNamedStmt.run({
      id: 'recipe-2',
      deleted: 0,
      rev: '1-test',
      name: 'Chicken Curry',
      prepTime: 15,
      glutenFree: 1,
      attachments: '{}',
      meta: '{}'
    });

    console.log('Insert result 2:', result2);

    // Test 3: Insert with object keys and values
    const row = {
      id: 'recipe-3',
      _deleted: 0,
      _rev: '1-test',
      name: 'Greek Salad',
      preparationTime: 5,
      isGlutenFree: 1,
      _attachments: '{}',
      _meta: '{}'
    };

    const columns = Object.keys(row).map(col => `"${col}"`).join(', ');
    const placeholders = Object.keys(row).map(() => '?').join(', ');
    const values = Object.values(row);

    const insertDynamicSql = `INSERT INTO test_table (${columns}) VALUES (${placeholders})`;
    console.log('Dynamic SQL:', insertDynamicSql);
    console.log('Values:', values);

    const insertDynamicStmt = db.prepare(insertDynamicSql);
    const result3 = insertDynamicStmt.run(...values);

    console.log('Insert result 3:', result3);

    // Verify all rows were inserted
    const allRows = db.prepare('SELECT * FROM test_table').all();
    console.log('All rows:', JSON.stringify(allRows, null, 2));
    expect(allRows.length).toBe(3);

    // Test query with preparationTime <= 10
    const queryStmt = db.prepare('SELECT * FROM test_table WHERE "preparationTime" <= ?');
    const queryResults = queryStmt.all(10);
    console.log('Query results (prep time <= 10):', JSON.stringify(queryResults, null, 2));
    expect(queryResults.length).toBe(2); // Should find recipe-1 and recipe-3

    // Test query with isGlutenFree = 1
    const glutenFreeStmt = db.prepare('SELECT * FROM test_table WHERE "isGlutenFree" = ?');
    const glutenFreeResults = glutenFreeStmt.all(1);
    console.log('Query results (gluten free):', JSON.stringify(glutenFreeResults, null, 2));
    expect(glutenFreeResults.length).toBe(2); // Should find recipe-2 and recipe-3

    // Test query with multiple conditions
    const multiQueryStmt = db.prepare('SELECT * FROM test_table WHERE "preparationTime" <= ? AND "isGlutenFree" = ?');
    const multiQueryResults = multiQueryStmt.all(10, 1);
    console.log('Query results (prep time <= 10 AND gluten free):', JSON.stringify(multiQueryResults, null, 2));
    expect(multiQueryResults.length).toBe(1); // Should find only recipe-3

    // Close the database
    db.close();
  });

  it('should correctly handle whitespace and newlines in SQL', () => {
    // Create a new database connection
    const db = new Database(dbPath);

    // Create a test table
    db.exec('CREATE TABLE test_table ("id" TEXT PRIMARY KEY, "value" TEXT)');

    // Test with SQL containing whitespace and newlines
    const insertSql = `
      INSERT INTO test_table
      ("id", "value")
      VALUES
      (?, ?)
    `;

    const stmt = db.prepare(insertSql);
    const result = stmt.run('test-1', 'test-value');

    console.log('Insert with whitespace result:', result);

    // Verify the row was inserted
    const row = db.prepare('SELECT * FROM test_table WHERE "id" = ?').get('test-1');
    console.log('Row with whitespace SQL:', row);
    expect(row).not.toBeNull();
    expect(row.value).toBe('test-value');

    // Close the database
    db.close();
  });

  it('should correctly handle boolean conversion', () => {
    // Create a new database connection
    const db = new Database(dbPath);

    // Create a test table
    db.exec('CREATE TABLE test_booleans ("id" TEXT PRIMARY KEY, "boolValue" INTEGER)');

    // Insert with boolean values
    const insertStmt = db.prepare('INSERT INTO test_booleans ("id", "boolValue") VALUES (?, ?)');

    // Test with direct boolean values
    try {
      insertStmt.run('bool-true', true);
      insertStmt.run('bool-false', false);
      console.log('Direct boolean insertion succeeded');
    } catch (error) {
      console.error('Direct boolean insertion failed:', error.message);

      // Try with converted values
      insertStmt.run('bool-true', 1);
      insertStmt.run('bool-false', 0);
      console.log('Converted boolean insertion succeeded');
    }

    // Query with boolean values
    const rows = db.prepare('SELECT * FROM test_booleans').all();
    console.log('Boolean rows:', rows);

    // Test querying with boolean condition
    try {
      const trueRows = db.prepare('SELECT * FROM test_booleans WHERE "boolValue" = ?').all(true);
      console.log('Query with boolean true:', trueRows);
    } catch (error) {
      console.error('Query with boolean failed:', error.message);

      // Try with converted value
      const trueRows = db.prepare('SELECT * FROM test_booleans WHERE "boolValue" = ?').all(1);
      console.log('Query with integer 1:', trueRows);
    }

    // Close the database
    db.close();
  });

  it('should simulate the adapter bulkWrite method', () => {
    // Create a new database connection
    const db = new Database(dbPath);

    // Create a test table with the same structure as our adapter uses
    const createTableSql = `
      CREATE TABLE test_table (
        "id" TEXT PRIMARY KEY,
        "_deleted" INTEGER DEFAULT 0,
        "_rev" TEXT DEFAULT "",
        "name" TEXT,
        "preparationTime" INTEGER,
        "isGlutenFree" INTEGER,
        "_attachments" TEXT DEFAULT "{}",
        "_meta" TEXT DEFAULT "{}"
      )
    `;

    db.exec(createTableSql);
    console.log('Table created for bulkWrite simulation');

    // Simulate the document to row conversion
    const documents = [
      {
        id: 'recipe-1',
        name: 'Spaghetti Carbonara',
        description: 'A classic Italian pasta dish',
        preparationTime: 10,
        cookingTime: 15,
        servings: 4,
        difficulty: 'medium',
        isVegetarian: false,
        isVegan: false,
        isGlutenFree: false,
        categoryId: 'cat-pasta',
        cuisineId: 'cuis-italian',
        createdAt: '2025-04-25T23:50:01.907Z',
        updatedAt: '2025-04-25T23:50:01.907Z',
        _meta: { lwt: 1745625001989.01 },
        _deleted: false,
        _attachments: {},
        _rev: '1-ccwmfyrkin'
      }
    ];

    // Convert documents to rows (similar to our adapter)
    const rows = documents.map(doc => {
      return {
        id: doc.id,
        _deleted: doc._deleted ? 1 : 0,
        _rev: doc._rev || '1-initial',
        name: doc.name,
        preparationTime: doc.preparationTime,
        isGlutenFree: doc.isGlutenFree ? 1 : 0,
        _attachments: typeof doc._attachments === 'object' ? JSON.stringify(doc._attachments) : '{}',
        _meta: typeof doc._meta === 'object' ? JSON.stringify(doc._meta) : '{}'
      };
    });

    // Simulate the bulkWrite method
    try {
      // Start transaction
      db.exec('BEGIN TRANSACTION');

      for (const row of rows) {
        // Build column names and placeholders for SQL
        const columns = Object.keys(row).map(col => `"${col}"`).join(', ');
        const placeholders = Object.keys(row).map(() => '?').join(', ');
        const values = Object.values(row);

        const insertSql = `INSERT INTO test_table (${columns}) VALUES (${placeholders})`;
        console.log('Bulk insert SQL:', insertSql);
        console.log('Bulk insert values:', values);

        const stmt = db.prepare(insertSql);
        const result = stmt.run(...values);
        console.log('Bulk insert result:', result);
      }

      // Commit transaction
      db.exec('COMMIT');
      console.log('Transaction committed');
    } catch (error) {
      // Rollback on error
      db.exec('ROLLBACK');
      console.error('Error in bulkWrite simulation:', error);
      throw error;
    }

    // Verify the data was inserted
    const allRows = db.prepare('SELECT * FROM test_table').all();
    console.log('All rows after bulkWrite:', JSON.stringify(allRows, null, 2));
    expect(allRows.length).toBe(1);

    // Test query with preparationTime <= 10
    const queryStmt = db.prepare('SELECT * FROM test_table WHERE "preparationTime" <= ?');
    const queryResults = queryStmt.all(10);
    console.log('Query results after bulkWrite (prep time <= 10):', JSON.stringify(queryResults, null, 2));
    expect(queryResults.length).toBe(1);

    // Close the database
    db.close();
  });
});
