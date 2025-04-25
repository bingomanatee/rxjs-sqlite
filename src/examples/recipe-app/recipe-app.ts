/**
 * Recipe App using RxDB with SQLite adapter
 * This app demonstrates how to use the RxDB SQLite adapter to store and query recipes
 */
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { RxDBQueryBuilderPlugin } from 'rxdb/dist/plugins/query-builder';
import { RxDBValidatePlugin } from 'rxdb/dist/plugins/validate';
import path from 'path';
import { getRxStorageSQLite } from '../../lib/rxdb-adapter/sqlite-adapter';

// Add RxDB plugins
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBValidatePlugin);

// Define the schema for a recipe
const recipeSchema = {
  title: 'recipe schema',
  version: 0,
  description: 'Recipe data',
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
    category: {
      type: 'string'
    },
    area: {
      type: 'string'
    },
    instructions: {
      type: 'string'
    },
    thumbnail: {
      type: 'string'
    },
    tags: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    youtube: {
      type: 'string'
    },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string'
          },
          measure: {
            type: 'string'
          }
        }
      }
    },
    source: {
      type: 'string'
    }
  },
  required: ['id', 'name', 'instructions']
};

// Create the database and collections
async function createDatabase() {
  console.log('Creating RxDB database with SQLite adapter...');

  // Create the database with the SQLite adapter
  const db = await createRxDatabase({
    name: 'recipedb',
    storage: getRxStorageSQLite({
      // Path to the SQLite database file
      filename: path.join(__dirname, 'recipes.sqlite')
    })
  });

  console.log('Database created');

  // Create the recipes collection
  await db.addCollections({
    recipes: {
      schema: recipeSchema
    }
  });

  console.log('Recipes collection created');

  return db;
}

// Function to display recipe information
function displayRecipe(recipe: any) {
  console.log('\n==============================================');
  console.log(`Recipe: ${recipe.name}`);
  console.log(`Category: ${recipe.category} | Cuisine: ${recipe.area}`);
  console.log('==============================================');

  console.log('\nIngredients:');
  recipe.ingredients.forEach((ingredient: any) => {
    console.log(`- ${ingredient.measure} ${ingredient.name}`);
  });

  console.log('\nInstructions:');
  console.log(recipe.instructions);

  if (recipe.youtube) {
    console.log(`\nVideo: ${recipe.youtube}`);
  }

  if (recipe.source) {
    console.log(`Source: ${recipe.source}`);
  }

  console.log('==============================================\n');
}

// Function to search recipes by name
async function searchRecipesByName(db: any, searchTerm: string) {
  console.log(`Searching for recipes with name containing "${searchTerm}"...`);

  const recipes = await db.recipes.find({
    selector: {
      name: {
        $regex: new RegExp(searchTerm, 'i')
      }
    }
  }).exec();

  console.log(`Found ${recipes.length} recipes matching "${searchTerm}"`);

  return recipes;
}

// Function to search recipes by ingredient
async function searchRecipesByIngredient(db: any, ingredient: string) {
  console.log(`Searching for recipes with ingredient containing "${ingredient}"...`);

  // This is a more complex query that requires checking array elements
  // We'll use a workaround by fetching all recipes and filtering in memory
  const allRecipes = await db.recipes.find().exec();

  const matchingRecipes = allRecipes.filter(recipe =>
    recipe.ingredients.some((ing: any) =>
      ing.name.toLowerCase().includes(ingredient.toLowerCase())
    )
  );

  console.log(`Found ${matchingRecipes.length} recipes with ingredient "${ingredient}"`);

  return matchingRecipes;
}

// Function to get recipes by category
async function getRecipesByCategory(db: any, category: string) {
  console.log(`Getting recipes in category "${category}"...`);

  const recipes = await db.recipes.find({
    selector: {
      category: {
        $eq: category
      }
    }
  }).exec();

  console.log(`Found ${recipes.length} recipes in category "${category}"`);

  return recipes;
}

// Function to get recipes by cuisine (area)
async function getRecipesByCuisine(db: any, cuisine: string) {
  console.log(`Getting recipes from cuisine "${cuisine}"...`);

  const recipes = await db.recipes.find({
    selector: {
      area: {
        $eq: cuisine
      }
    }
  }).exec();

  console.log(`Found ${recipes.length} recipes from cuisine "${cuisine}"`);

  return recipes;
}

// Function to get all categories
async function getAllCategories(db: any) {
  const recipes = await db.recipes.find().exec();

  // Extract unique categories
  const categories = [...new Set(recipes.map(recipe => recipe.category))];

  return categories;
}

// Function to get all cuisines (areas)
async function getAllCuisines(db: any) {
  const recipes = await db.recipes.find().exec();

  // Extract unique cuisines
  const cuisines = [...new Set(recipes.map(recipe => recipe.area))];

  return cuisines;
}

// Function to get recipe stats
async function getRecipeStats(db: any) {
  const recipes = await db.recipes.find().exec();

  const categories = await getAllCategories(db);
  const cuisines = await getAllCuisines(db);

  // Count recipes by category
  const recipesByCategory = categories.map(category => {
    const count = recipes.filter(recipe => recipe.category === category).length;
    return { category, count };
  });

  // Count recipes by cuisine
  const recipesByCuisine = cuisines.map(cuisine => {
    const count = recipes.filter(recipe => recipe.area === cuisine).length;
    return { cuisine, count };
  });

  // Get total ingredient count
  const totalIngredients = recipes.reduce((total, recipe) => total + recipe.ingredients.length, 0);

  // Get unique ingredients
  const uniqueIngredients = new Set();
  recipes.forEach(recipe => {
    recipe.ingredients.forEach((ingredient: any) => {
      uniqueIngredients.add(ingredient.name.toLowerCase());
    });
  });

  return {
    totalRecipes: recipes.length,
    categories: recipesByCategory,
    cuisines: recipesByCuisine,
    totalIngredients,
    uniqueIngredientCount: uniqueIngredients.size
  };
}

// Main function
async function main() {
  try {
    // Create the database
    const db = await createDatabase();

    // Get recipe count
    const recipeCount = await db.recipes.count().exec();
    console.log(`Database contains ${recipeCount} recipes`);

    if (recipeCount === 0) {
      console.log('No recipes found. Please run fetch-recipes.ts first to populate the database.');
      await db.destroy();
      return;
    }

    // Get recipe stats
    const stats = await getRecipeStats(db);
    console.log('\nRecipe Stats:');
    console.log(`Total Recipes: ${stats.totalRecipes}`);
    console.log(`Total Ingredients Used: ${stats.totalIngredients}`);
    console.log(`Unique Ingredients: ${stats.uniqueIngredientCount}`);

    console.log('\nRecipes by Category:');
    stats.categories.forEach(cat => {
      console.log(`- ${cat.category}: ${cat.count} recipes`);
    });

    console.log('\nRecipes by Cuisine:');
    stats.cuisines.forEach(cuisine => {
      console.log(`- ${cuisine.cuisine}: ${cuisine.count} recipes`);
    });

    // Demo: Search recipes by name
    const chickenRecipes = await searchRecipesByName(db, 'chicken');
    if (chickenRecipes.length > 0) {
      console.log('\nSample Chicken Recipe:');
      displayRecipe(chickenRecipes[0]);
    }

    // Demo: Search recipes by ingredient
    const tomatoRecipes = await searchRecipesByIngredient(db, 'tomato');
    if (tomatoRecipes.length > 0) {
      console.log('\nSample Recipe with Tomato:');
      displayRecipe(tomatoRecipes[0]);
    }

    // Demo: Get recipes by category
    const dessertRecipes = await getRecipesByCategory(db, 'Dessert');
    if (dessertRecipes.length > 0) {
      console.log('\nSample Dessert Recipe:');
      displayRecipe(dessertRecipes[0]);
    }

    // Demo: Get recipes by cuisine
    const italianRecipes = await getRecipesByCuisine(db, 'Italian');
    if (italianRecipes.length > 0) {
      console.log('\nSample Italian Recipe:');
      displayRecipe(italianRecipes[0]);
    }

    // Close the database
    await db.remove();
    console.log('\nDatabase closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the app
main();
