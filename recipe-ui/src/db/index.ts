import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';

// Add the dev-mode plugin in development with default validator
if (import.meta.env.DEV) {
  addRxPlugin(RxDBDevModePlugin);
}

// Database instance
let dbPromise: Promise<any> | null = null;

// Initialize database
export const initDatabase = async () => {
  if (dbPromise) return dbPromise;

  dbPromise = createRxDatabase({
    name: 'recipedb',
    storage: getRxStorageMemory(),
    // Disable dev mode for now to avoid schema validation errors
    devMode: false
  }).then(async (db) => {
    console.log('RxDB Database created');

    // Add collections
    const collections = await db.addCollections({
      recipes: { 
        schema: {
          title: 'recipe schema',
          version: 0,
          primaryKey: 'id',
          type: 'object',
          properties: {
            id: { type: 'string', maxLength: 100 },
            name: { type: 'string' },
            categoryId: { type: 'string' },
            cuisineId: { type: 'string' },
            instructions: { type: 'string' },
            thumbnail: { type: 'string' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' }
          },
          required: ['id']
        }
      }
    });

    return { db, collections };
  });

  return dbPromise;
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
