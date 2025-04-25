/**
 * Script to store normalized recipe data in RxDB with SQLite adapter and export it
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

// Import RxDB
const { createRxDatabase, addRxPlugin } = require('rxdb');
const { RxDBQueryBuilderPlugin } = require('rxdb/dist/plugins/query-builder');
const { RxDBValidatePlugin } = require('rxdb/dist/plugins/validate');

// Import our SQLite adapter
const { getRxStorageSQLite } = require('../../lib/rxdb-adapter/sqlite-adapter');

// Add RxDB plugins
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBValidatePlugin);

// Define schemas for our collections
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
    categoryId: {
      type: 'string',
      ref: 'categories'
    },
    cuisineId: {
      type: 'string',
      ref: 'cuisines'
    },
    instructions: {
      type: 'string'
    },
    originalInstructions: {
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
    source: {
      type: 'string'
    }
  },
  required: ['id', 'name', 'instructions']
};

const ingredientSchema = {
  title: 'ingredient schema',
  version: 0,
  description: 'Ingredient data',
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
    isPlural: {
      type: 'boolean'
    },
    category: {
      type: 'string'
    }
  },
  required: ['id', 'name']
};

const categorySchema = {
  title: 'category schema',
  version: 0,
  description: 'Recipe category data',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    name: {
      type: 'string'
    }
  },
  required: ['id', 'name']
};

const cuisineSchema = {
  title: 'cuisine schema',
  version: 0,
  description: 'Recipe cuisine data',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    name: {
      type: 'string'
    }
  },
  required: ['id', 'name']
};

const recipeIngredientSchema = {
  title: 'recipe ingredient schema',
  version: 0,
  description: 'Recipe-ingredient relationship data',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    recipeId: {
      type: 'string',
      ref: 'recipes'
    },
    ingredientId: {
      type: 'string',
      ref: 'ingredients'
    },
    measure: {
      type: 'string'
    }
  },
  required: ['id', 'recipeId', 'ingredientId']
};

// Function to create the database and collections
async function createDatabase() {
  console.log('Creating RxDB database with SQLite adapter...');
  
  // Create the database with the SQLite adapter
  const db = await createRxDatabase({
    name: 'recipedb',
    storage: getRxStorageSQLite({
      // Path to the SQLite database file
      filename: path.join(__dirname, 'recipe-database.sqlite')
    })
  });
  
  console.log('Database created');
  
  // Create the collections
  await db.addCollections({
    recipes: {
      schema: recipeSchema
    },
    ingredients: {
      schema: ingredientSchema
    },
    categories: {
      schema: categorySchema
    },
    cuisines: {
      schema: cuisineSchema
    },
    recipeIngredients: {
      schema: recipeIngredientSchema
    }
  });
  
  console.log('Collections created');
  
  return db;
}

// Function to load normalized data
async function loadNormalizedData() {
  try {
    const filePath = path.join(__dirname, 'output', 'normalized', 'normalized-data.json');
    const data = await readFileAsync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading normalized data:', error);
    throw error;
  }
}

// Function to load processed recipes
async function loadProcessedRecipes() {
  try {
    const filePath = path.join(__dirname, 'output', 'normalized', 'processed-recipes.json');
    const data = await readFileAsync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading processed recipes:', error);
    throw error;
  }
}

// Function to populate the database
async function populateDatabase(db) {
  try {
    // Load normalized data
    const normalizedData = await loadNormalizedData();
    
    // Load processed recipes
    const processedRecipes = await loadProcessedRecipes();
    
    // Insert categories
    console.log(`Inserting ${normalizedData.categories.length} categories...`);
    for (const category of normalizedData.categories) {
      await db.categories.insert(category);
    }
    
    // Insert cuisines
    console.log(`Inserting ${normalizedData.cuisines.length} cuisines...`);
    for (const cuisine of normalizedData.cuisines) {
      await db.cuisines.insert(cuisine);
    }
    
    // Insert ingredients
    console.log(`Inserting ${normalizedData.ingredients.length} ingredients...`);
    for (const ingredient of normalizedData.ingredients) {
      await db.ingredients.insert(ingredient);
    }
    
    // Insert recipes with processed instructions
    console.log(`Inserting ${processedRecipes.length} recipes...`);
    for (const recipe of processedRecipes) {
      await db.recipes.insert(recipe);
    }
    
    // Insert recipe ingredients
    console.log(`Inserting ${normalizedData.recipeIngredients.length} recipe-ingredient relationships...`);
    for (const recipeIngredient of normalizedData.recipeIngredients) {
      await db.recipeIngredients.insert(recipeIngredient);
    }
    
    console.log('Database populated successfully');
  } catch (error) {
    console.error('Error populating database:', error);
    throw error;
  }
}

// Function to export data from RxDB
async function exportData(db) {
  try {
    console.log('Exporting data from RxDB...');
    
    // Create export directory
    const exportDir = path.join(__dirname, 'output', 'rxdb-export');
    await mkdirAsync(exportDir, { recursive: true });
    
    // Export recipes
    const recipes = await db.recipes.find().exec();
    await writeFileAsync(
      path.join(exportDir, 'recipes.json'),
      JSON.stringify(recipes, null, 2)
    );
    
    // Export ingredients
    const ingredients = await db.ingredients.find().exec();
    await writeFileAsync(
      path.join(exportDir, 'ingredients.json'),
      JSON.stringify(ingredients, null, 2)
    );
    
    // Export categories
    const categories = await db.categories.find().exec();
    await writeFileAsync(
      path.join(exportDir, 'categories.json'),
      JSON.stringify(categories, null, 2)
    );
    
    // Export cuisines
    const cuisines = await db.cuisines.find().exec();
    await writeFileAsync(
      path.join(exportDir, 'cuisines.json'),
      JSON.stringify(cuisines, null, 2)
    );
    
    // Export recipe ingredients
    const recipeIngredients = await db.recipeIngredients.find().exec();
    await writeFileAsync(
      path.join(exportDir, 'recipe-ingredients.json'),
      JSON.stringify(recipeIngredients, null, 2)
    );
    
    console.log(`Exported data to ${exportDir}`);
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

// Function to perform example queries
async function performExampleQueries(db) {
  try {
    console.log('\nPerforming example queries...');
    
    // Query 1: Find all recipes in a specific category
    console.log('\nQuery 1: Find all recipes in the "Dessert" category');
    const dessertCategory = await db.categories.findOne({
      selector: {
        name: 'Dessert'
      }
    }).exec();
    
    if (dessertCategory) {
      const dessertRecipes = await db.recipes.find({
        selector: {
          categoryId: dessertCategory.id
        }
      }).exec();
      
      console.log(`Found ${dessertRecipes.length} dessert recipes`);
      
      if (dessertRecipes.length > 0) {
        console.log(`Example: ${dessertRecipes[0].name}`);
      }
    }
    
    // Query 2: Find all recipes with a specific ingredient
    console.log('\nQuery 2: Find all recipes with "Chicken"');
    const chickenIngredient = await db.ingredients.findOne({
      selector: {
        name: {
          $regex: 'Chicken'
        }
      }
    }).exec();
    
    if (chickenIngredient) {
      const chickenRecipeIngredients = await db.recipeIngredients.find({
        selector: {
          ingredientId: chickenIngredient.id
        }
      }).exec();
      
      const chickenRecipeIds = chickenRecipeIngredients.map(ri => ri.recipeId);
      
      const chickenRecipes = await db.recipes.find({
        selector: {
          id: {
            $in: chickenRecipeIds
          }
        }
      }).exec();
      
      console.log(`Found ${chickenRecipes.length} recipes with chicken`);
      
      if (chickenRecipes.length > 0) {
        console.log(`Example: ${chickenRecipes[0].name}`);
      }
    }
    
    // Query 3: Find all recipes from a specific cuisine
    console.log('\nQuery 3: Find all recipes from "Italian" cuisine');
    const italianCuisine = await db.cuisines.findOne({
      selector: {
        name: 'Italian'
      }
    }).exec();
    
    if (italianCuisine) {
      const italianRecipes = await db.recipes.find({
        selector: {
          cuisineId: italianCuisine.id
        }
      }).exec();
      
      console.log(`Found ${italianRecipes.length} Italian recipes`);
      
      if (italianRecipes.length > 0) {
        console.log(`Example: ${italianRecipes[0].name}`);
      }
    }
    
    // Query 4: Find recipes with multiple ingredients
    console.log('\nQuery 4: Find recipes with both "Chicken" and "Tomato"');
    const tomatoIngredient = await db.ingredients.findOne({
      selector: {
        name: {
          $regex: 'Tomato'
        }
      }
    }).exec();
    
    if (chickenIngredient && tomatoIngredient) {
      const chickenRecipeIngredients = await db.recipeIngredients.find({
        selector: {
          ingredientId: chickenIngredient.id
        }
      }).exec();
      
      const tomatoRecipeIngredients = await db.recipeIngredients.find({
        selector: {
          ingredientId: tomatoIngredient.id
        }
      }).exec();
      
      const chickenRecipeIds = new Set(chickenRecipeIngredients.map(ri => ri.recipeId));
      const tomatoRecipeIds = new Set(tomatoRecipeIngredients.map(ri => ri.recipeId));
      
      const bothIngredientsRecipeIds = [...chickenRecipeIds].filter(id => tomatoRecipeIds.has(id));
      
      const bothIngredientsRecipes = await db.recipes.find({
        selector: {
          id: {
            $in: bothIngredientsRecipeIds
          }
        }
      }).exec();
      
      console.log(`Found ${bothIngredientsRecipes.length} recipes with both chicken and tomato`);
      
      if (bothIngredientsRecipes.length > 0) {
        console.log(`Example: ${bothIngredientsRecipes[0].name}`);
      }
    }
    
    // Query 5: Find recipes with a specific tag
    console.log('\nQuery 5: Find recipes with the tag "Spicy"');
    const spicyRecipes = await db.recipes.find({
      selector: {
        tags: {
          $in: ['Spicy']
        }
      }
    }).exec();
    
    console.log(`Found ${spicyRecipes.length} spicy recipes`);
    
    if (spicyRecipes.length > 0) {
      console.log(`Example: ${spicyRecipes[0].name}`);
    }
  } catch (error) {
    console.error('Error performing example queries:', error);
    throw error;
  }
}

// Main function
async function main() {
  let db = null;
  
  try {
    // Create the database
    db = await createDatabase();
    
    // Populate the database
    await populateDatabase(db);
    
    // Perform example queries
    await performExampleQueries(db);
    
    // Export data from RxDB
    await exportData(db);
    
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the database
    if (db) {
      await db.remove();
      console.log('Database closed');
    }
  }
}

// Run the script
main();
