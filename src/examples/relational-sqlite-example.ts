/**
 * Example of using the Relational SQLite Adapter with RxDB
 */
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { getRelationalRxStorageSQLite } from '../lib/rxdb-adapter/relational-sqlite-adapter';
import path from 'path';

// Add the dev-mode plugin
addRxPlugin(RxDBDevModePlugin);

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
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'number' },
          unit: { type: 'string' }
        }
      }
    },
    instructions: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    categoryId: { type: ['string', 'null'] },
    cuisineId: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id', 'name', 'instructions']
};

// Sample recipe data
const sampleRecipes = [
  {
    id: 'recipe-1',
    name: 'Spaghetti Carbonara',
    description: 'A classic Italian pasta dish with eggs, cheese, pancetta, and black pepper.',
    preparationTime: 10,
    cookingTime: 15,
    servings: 4,
    difficulty: 'medium',
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
    ingredients: [
      { name: 'spaghetti', amount: 400, unit: 'g' },
      { name: 'pancetta', amount: 150, unit: 'g' },
      { name: 'eggs', amount: 3, unit: 'pcs' },
      { name: 'parmesan cheese', amount: 50, unit: 'g' },
      { name: 'black pepper', amount: 1, unit: 'tsp' },
      { name: 'salt', amount: 1, unit: 'tsp' }
    ],
    instructions: 'Cook pasta. Mix eggs, cheese, and pepper. Combine with pasta and bacon.',
    tags: ['pasta', 'italian', 'quick'],
    categoryId: 'cat-pasta',
    cuisineId: 'cuis-italian',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'recipe-2',
    name: 'Chicken Curry',
    description: 'A flavorful Indian curry with tender chicken pieces in a rich sauce.',
    preparationTime: 15,
    cookingTime: 30,
    servings: 4,
    difficulty: 'medium',
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: true,
    ingredients: [
      { name: 'chicken', amount: 500, unit: 'g' },
      { name: 'onion', amount: 1, unit: 'pcs' },
      { name: 'garlic', amount: 3, unit: 'cloves' },
      { name: 'curry powder', amount: 2, unit: 'tbsp' },
      { name: 'coconut milk', amount: 400, unit: 'ml' },
      { name: 'vegetable oil', amount: 2, unit: 'tbsp' }
    ],
    instructions: 'Cook chicken with curry sauce and serve with rice.',
    tags: ['curry', 'indian', 'spicy'],
    categoryId: 'cat-curry',
    cuisineId: 'cuis-indian',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

/**
 * Main function to demonstrate the relational SQLite adapter
 */
async function main() {
  console.log('Creating RxDB database with relational SQLite adapter...');
  
  // Create the database with the relational SQLite adapter
  const db = await createRxDatabase({
    name: 'relational-example',
    storage: getRelationalRxStorageSQLite({
      // Specify the path to store the database file
      filename: path.join(__dirname, '..', '..', 'relational-example.sqlite')
    })
  });

  console.log('Database created successfully.');

  // Add a collection for recipes
  const collections = await db.addCollections({
    recipes: {
      schema: recipeSchema
    }
  });

  console.log('Recipe collection created.');

  // Insert sample recipes
  for (const recipe of sampleRecipes) {
    try {
      await collections.recipes.insert(recipe);
      console.log(`Inserted recipe: ${recipe.name}`);
    } catch (error) {
      console.error(`Error inserting recipe ${recipe.name}:`, error);
    }
  }

  // Query all recipes
  const allRecipes = await collections.recipes.find().exec();
  console.log(`Found ${allRecipes.length} recipes:`);
  allRecipes.forEach(recipe => {
    console.log(`- ${recipe.name} (${recipe.difficulty})`);
  });

  // Query recipes by difficulty
  const easyRecipes = await collections.recipes.find({
    selector: {
      difficulty: 'easy'
    }
  }).exec();
  console.log(`Found ${easyRecipes.length} easy recipes.`);

  // Query vegetarian recipes
  const vegetarianRecipes = await collections.recipes.find({
    selector: {
      isVegetarian: true
    }
  }).exec();
  console.log(`Found ${vegetarianRecipes.length} vegetarian recipes.`);

  // Query recipes with specific ingredients
  const pastaRecipes = await collections.recipes.find({
    selector: {
      'ingredients': {
        $elemMatch: {
          'name': 'spaghetti'
        }
      }
    }
  }).exec();
  console.log(`Found ${pastaRecipes.length} pasta recipes.`);

  // Get the underlying SQLite database instance
  const sqliteDb = getRelationalRxStorageSQLite.getLastDB();
  
  // Execute a raw SQL query to demonstrate direct access
  const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table';").all();
  console.log('Database tables:');
  tables.forEach((table: any) => {
    console.log(`- ${table.name}`);
    
    // Show table schema
    const schema = sqliteDb.prepare(`PRAGMA table_info(${table.name});`).all();
    schema.forEach((column: any) => {
      console.log(`  - ${column.name} (${column.type})`);
    });
  });

  // Close the database
  await db.destroy();
  console.log('Database closed.');
}

// Run the example
main().catch(error => {
  console.error('Error in example:', error);
});
