/**
 * Script to fetch recipes from TheMealDB API and store them in a SQLite database
 * using the RxDB SQLite adapter
 */
import axios from 'axios';
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { RxDBQueryBuilderPlugin } from 'rxdb/dist/plugins/query-builder';
import { RxDBValidatePlugin } from 'rxdb/dist/plugins/validate';
import fs from 'fs/promises';
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

// Function to fetch recipes from TheMealDB API
async function fetchRecipes(limit = 100) {
  console.log(`Fetching up to ${limit} recipes from TheMealDB API...`);

  const recipes: any[] = [];
  const categories = await fetchCategories();

  // Fetch recipes for each category
  for (const category of categories) {
    if (recipes.length >= limit) break;

    console.log(`Fetching recipes for category: ${category}`);
    const categoryRecipes = await fetchRecipesByCategory(category);

    // Add recipes up to the limit
    const remainingSlots: number = limit - recipes.length;
    recipes.push(...categoryRecipes.slice(0, remainingSlots));

    console.log(`Fetched ${categoryRecipes.length} recipes for category ${category}`);
    console.log(`Total recipes so far: ${recipes.length}/${limit}`);

    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return recipes;
}

// Function to fetch all categories
async function fetchCategories(): Promise<string[]> {
  try {
    const response = await axios.get('https://www.themealdb.com/api/json/v1/1/categories.php');
    return response.data.categories.map((category: any) => category.strCategory);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

// Function to fetch recipes by category
async function fetchRecipesByCategory(category: string) {
  try {
    const response = await axios.get(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(category)}`);

    if (!response.data.meals) {
      return [];
    }

    const recipes = [];

    // Fetch details for each recipe
    for (const meal of response.data.meals.slice(0, 5)) { // Limit to 5 recipes per category
      const recipeDetails = await fetchRecipeDetails(meal.idMeal);
      if (recipeDetails) {
        recipes.push(recipeDetails);
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return recipes;
  } catch (error) {
    console.error(`Error fetching recipes for category ${category}:`, error);
    return [];
  }
}

// Function to fetch recipe details
async function fetchRecipeDetails(id: string) {
  try {
    const response = await axios.get(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`);

    if (!response.data.meals || !response.data.meals[0]) {
      return null;
    }

    const meal = response.data.meals[0];

    // Extract ingredients and measures
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ingredient = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];

      if (ingredient && ingredient.trim() !== '') {
        ingredients.push({
          name: ingredient,
          measure: measure || ''
        });
      }
    }

    // Extract tags
    const tags = meal.strTags ? meal.strTags.split(',').map((tag: string) => tag.trim()) : [];

    // Create recipe object
    return {
      id: meal.idMeal,
      name: meal.strMeal,
      category: meal.strCategory,
      area: meal.strArea,
      instructions: meal.strInstructions,
      thumbnail: meal.strMealThumb,
      tags,
      youtube: meal.strYoutube,
      ingredients,
      source: meal.strSource || ''
    };
  } catch (error) {
    console.error(`Error fetching recipe details for ID ${id}:`, error);
    return null;
  }
}

// Function to store recipes in RxDB
async function storeRecipes(recipes: any[]) {
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

  // Insert recipes
  console.log(`Inserting ${recipes.length} recipes...`);

  for (const recipe of recipes) {
    try {
      await db.recipes.insert(recipe);
    } catch (error) {
      console.error(`Error inserting recipe ${recipe.id}:`, error);
    }
  }

  console.log('All recipes inserted');

  // Export recipes as JSON
  const allRecipes = await db.recipes.find().exec();

  const outputDir = path.join(__dirname, 'output');
  await fs.mkdir(outputDir, { recursive: true });

  await fs.writeFile(
    path.join(outputDir, 'recipes.json'),
    JSON.stringify(allRecipes, null, 2)
  );

  console.log(`Exported ${allRecipes.length} recipes to ${path.join(outputDir, 'recipes.json')}`);

  // Close the database
  await db.remove();
  console.log('Database closed');
}

// Main function
async function main() {
  try {
    // Fetch recipes
    const recipes = await fetchRecipes(100);
    console.log(`Fetched ${recipes.length} recipes`);

    // Store recipes in RxDB
    await storeRecipes(recipes);

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
main();
