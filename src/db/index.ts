// Import core RxDB functionality
import { createRxDatabase, addRxPlugin } from 'rxdb';

// Import storage
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';

// Import dev-mode plugin
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';

// Import our custom validator
import wrappedValidateSpecStorage from './spec-validator';
import {
  recipeSchema,
  ingredientSchema,
  metadataSchema,
  recipeIngredientSchema,
  recipeStepSchema,
  bookmarkSchema,
  recipeDocMethods,
  ingredientDocMethods,
  metadataDocMethods,
  recipeIngredientDocMethods,
  recipeStepDocMethods,
  bookmarkDocMethods
} from './schemas';

// Set up RxDB
console.log('Setting up RxDB validator...');

// Add the dev-mode plugin
console.log('Adding dev-mode plugin...');
addRxPlugin(RxDBDevModePlugin);

// Disable dev-mode warnings
if (RxDBDevModePlugin.disableWarnings) {
  RxDBDevModePlugin.disableWarnings();
  console.log('Disabled dev-mode warnings');
}

// Database instance
let dbPromise: Promise<any> | null = null;

// Initialize database
export const initDatabase = async () => {
  console.log('Initializing database...');

  if (dbPromise) {
    console.log('Database promise already exists, returning existing promise');
    return dbPromise;
  }

  try {
    console.log('Creating RxDB database...');

    // Create the database with memory storage and our custom validator
    dbPromise = createRxDatabase({
      name: 'recipedb',
      storage: wrappedValidateSpecStorage({
        storage: getRxStorageMemory()
      }),
      multiInstance: false,
      ignoreDuplicate: true,
      // Enable dev mode
      devMode: true
    }).then(async (db) => {
      console.log('RxDB Database created successfully');

      console.log('Adding collections...');
      // Add collections with methods
      const collections = await db.addCollections({
        recipes: {
          schema: recipeSchema,
          methods: recipeDocMethods
        },
        ingredients: {
          schema: ingredientSchema,
          methods: ingredientDocMethods
        },
        metadata: {
          schema: metadataSchema,
          methods: metadataDocMethods
        },
        recipeIngredients: {
          schema: recipeIngredientSchema,
          methods: recipeIngredientDocMethods
        },
        recipeSteps: {
          schema: recipeStepSchema,
          methods: recipeStepDocMethods
        },
        bookmarks: {
          schema: bookmarkSchema,
          methods: bookmarkDocMethods
        }
      });

      console.log('Collections added successfully');
      return { db, collections };
    });

    console.log('Returning database promise');
    return dbPromise;
  } catch (error) {
    console.error('Error initializing database:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
};

// Get database instance
export const getDatabase = async () => {
  if (!dbPromise) {
    return initDatabase();
  }
  return dbPromise;
};

// Clean up database
export const cleanupDatabase = async () => {
  if (dbPromise) {
    const { db } = await dbPromise;
    await db.destroy();
    dbPromise = null;
  }
};
