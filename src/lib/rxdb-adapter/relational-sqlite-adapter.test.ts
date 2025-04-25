/**
 * Tests for the Relational SQLite Adapter
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { createRxDatabase } from 'rxdb';
import { getRelationalRxStorageSQLite } from './relational-sqlite-adapter';
import path from 'path';
import fs from 'fs';

describe('Relational SQLite Adapter', () => {
  // Generate a unique database name for each test run
  const dbName = `test-relational-db-${Date.now()}`;
  const dbPath = path.join(__dirname, '..', '..', '..', `${dbName}.sqlite`);
  let db: any;

  // Clear the database map before running tests
  beforeAll(() => {
    // @ts-ignore - Accessing static map
    if (getRelationalRxStorageSQLite.databaseMap) {
      // @ts-ignore - Accessing static map
      getRelationalRxStorageSQLite.databaseMap.clear();
    }
  });

  // Define a schema with various field types
  const recipeSchema = {
    title: 'recipe schema',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
      id: { type: 'string', maxLength: 100 },
      name: { type: 'string' },
      description: { type: 'string' },
      preparationTime: { type: 'number' },
      cookingTime: { type: 'number' },
      servings: { type: 'number' },
      difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
      isVegetarian: { type: 'boolean' },
      isVegan: { type: 'boolean' },
      isGlutenFree: { type: 'boolean' },
      // Example of nullable fields using multi-type arrays
      categoryId: { type: ['string', 'null'] },
      cuisineId: { type: ['string', 'null'] },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' }
    },
    required: ['id', 'name']
  };

  // Sample recipe data
  const sampleRecipes = [
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'recipe-2',
      name: 'Chicken Curry',
      description: 'A flavorful Indian curry',
      preparationTime: 15,
      cookingTime: 30,
      servings: 4,
      difficulty: 'medium',
      isVegetarian: false,
      isVegan: false,
      isGlutenFree: true,
      categoryId: 'cat-curry',
      cuisineId: 'cuis-indian',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'recipe-3',
      name: 'Greek Salad',
      description: 'A refreshing Mediterranean salad',
      preparationTime: 15,
      cookingTime: 0,
      servings: 2,
      difficulty: 'easy',
      isVegetarian: true,
      isVegan: false,
      isGlutenFree: true,
      categoryId: null,  // Test null value
      cuisineId: 'cuis-greek',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  beforeEach(async () => {
    // Generate a unique database name for each test
    const uniqueDbName = `${dbName}-${Math.floor(Math.random() * 1000000)}`;
    const uniqueDbPath = path.join(__dirname, '..', '..', '..', `${uniqueDbName}.sqlite`);

    // Remove any existing test database file
    if (fs.existsSync(uniqueDbPath)) {
      try {
        fs.unlinkSync(uniqueDbPath);
      } catch (error) {
        console.error('Error removing database file:', error);
      }
    }

    // Create a new database with the relational SQLite adapter
    db = await createRxDatabase({
      name: uniqueDbName,
      storage: getRelationalRxStorageSQLite({
        filename: uniqueDbPath
      }),
      // Enable dev mode to catch validation errors
      devMode: true,
      options: {
        validationStrategy: {
          validateBeforeInsert: true,
          validateBeforeSave: true,
          validateOnQuery: false
        }
      }
    });

    // Add a collection for recipes
    await db.addCollections({
      recipes: {
        schema: recipeSchema
      }
    });
  });

  afterEach(async () => {
    // Clean up the database
    if (db) {
      try {
        // Try to destroy the database if the method exists
        if (typeof db.destroy === 'function') {
          await db.destroy();
        } else if (typeof db.close === 'function') {
          // Fallback to close if destroy is not available
          await db.close();
        }
      } catch (error) {
        console.error('Error cleaning up database:', error);
      }

      // Get the database path from the database name
      const dbFilePath = path.join(__dirname, '..', '..', '..', `${db.name}.sqlite`);

      // Remove the test database file
      if (fs.existsSync(dbFilePath)) {
        try {
          fs.unlinkSync(dbFilePath);
        } catch (error) {
          console.error('Error removing database file:', error);
        }
      }
    }
  });

  it('should create a database with a collection', () => {
    expect(db).toBeDefined();
    expect(db.collections.recipes).toBeDefined();
  });

  it('should insert documents', async () => {
    // Insert a document
    const insertedDoc = await db.collections.recipes.insert(sampleRecipes[0]);

    // Verify the document was inserted
    expect(insertedDoc).toBeDefined();
    expect(insertedDoc.id).toBe(sampleRecipes[0].id);
    expect(insertedDoc.name).toBe(sampleRecipes[0].name);
  });

  it('should retrieve documents', async () => {
    // Insert a document
    await db.collections.recipes.insert(sampleRecipes[0]);

    // Retrieve the document
    const doc = await db.collections.recipes.findOne(sampleRecipes[0].id).exec();

    // Verify the document was retrieved
    expect(doc).toBeDefined();
    expect(doc.id).toBe(sampleRecipes[0].id);
    expect(doc.name).toBe(sampleRecipes[0].name);
  });

  it('should update documents', async () => {
    // Insert a document
    const doc = await db.collections.recipes.insert(sampleRecipes[0]);

    // Update the document
    await doc.patch({
      name: 'Updated Recipe Name'
    });

    // Retrieve the updated document
    const updatedDoc = await db.collections.recipes.findOne(sampleRecipes[0].id).exec();

    // Verify the document was updated
    expect(updatedDoc.name).toBe('Updated Recipe Name');
  });

  it('should delete documents', async () => {
    // Insert a document
    const doc = await db.collections.recipes.insert(sampleRecipes[0]);

    // Delete the document
    await doc.remove();

    // Try to retrieve the deleted document
    const deletedDoc = await db.collections.recipes.findOne(sampleRecipes[0].id).exec();

    // Verify the document was deleted
    expect(deletedDoc).toBeNull();
  });

  it('should handle nullable fields', async () => {
    // Insert a document with a null field
    const doc = await db.collections.recipes.insert(sampleRecipes[2]);

    // Retrieve the document
    const retrievedDoc = await db.collections.recipes.findOne(sampleRecipes[2].id).exec();

    // Verify the null field was preserved
    expect(retrievedDoc.categoryId).toBeNull();
  });

  it('should query documents with various conditions', async () => {
    // Insert multiple documents
    await db.collections.recipes.bulkInsert(sampleRecipes);

    // Query by equality
    const italianRecipes = await db.collections.recipes.find({
      selector: {
        cuisineId: 'cuis-italian'
      }
    }).exec();

    expect(italianRecipes.length).toBe(1);
    expect(italianRecipes[0].name).toBe('Spaghetti Carbonara');

    // Query by boolean field
    const vegetarianRecipes = await db.collections.recipes.find({
      selector: {
        isVegetarian: true
      }
    }).exec();

    expect(vegetarianRecipes.length).toBe(1);
    expect(vegetarianRecipes[0].name).toBe('Greek Salad');

    // Query by numeric comparison
    const quickRecipes = await db.collections.recipes.find({
      selector: {
        preparationTime: {
          $lte: 10
        }
      }
    }).exec();

    expect(quickRecipes.length).toBe(1);
    expect(quickRecipes[0].name).toBe('Spaghetti Carbonara');

    // Query with multiple conditions
    const glutenFreeNonVeganRecipes = await db.collections.recipes.find({
      selector: {
        isGlutenFree: true,
        isVegan: false
      }
    }).exec();

    expect(glutenFreeNonVeganRecipes.length).toBe(2);

    // Query with $or
    const pastaOrCurryRecipes = await db.collections.recipes.find({
      selector: {
        $or: [
          { categoryId: 'cat-pasta' },
          { categoryId: 'cat-curry' }
        ]
      }
    }).exec();

    expect(pastaOrCurryRecipes.length).toBe(2);

    // Query with null value
    const recipesWithNullCategory = await db.collections.recipes.find({
      selector: {
        categoryId: null
      }
    }).exec();

    expect(recipesWithNullCategory.length).toBe(1);
    expect(recipesWithNullCategory[0].name).toBe('Greek Salad');
  });

  it('should access the underlying SQLite database', () => {
    // Get the SQLite database instance
    const sqliteDb = getRelationalRxStorageSQLite.getLastDB();

    // Verify the database instance is available
    expect(sqliteDb).toBeDefined();

    // Check the table structure
    const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table';").all();

    // There should be a table for the recipes collection
    const recipeTableName = `${dbName}_recipes`;
    const tableExists = tables.some((table: any) => table.name === recipeTableName);
    expect(tableExists).toBe(true);

    // Check the columns in the table
    const columns = sqliteDb.prepare(`PRAGMA table_info(${recipeTableName});`).all();

    // Verify that columns were created for each field in the schema
    expect(columns.some((col: any) => col.name === 'id')).toBe(true);
    expect(columns.some((col: any) => col.name === 'name')).toBe(true);
    expect(columns.some((col: any) => col.name === 'description')).toBe(true);
    expect(columns.some((col: any) => col.name === 'preparationTime')).toBe(true);
    expect(columns.some((col: any) => col.name === 'isVegetarian')).toBe(true);
    expect(columns.some((col: any) => col.name === 'categoryId')).toBe(true);

    // Verify that the nullable field is correctly defined
    const categoryIdColumn = columns.find((col: any) => col.name === 'categoryId');
    expect(categoryIdColumn.notnull).toBe(0); // 0 means NULL is allowed
  });
});
