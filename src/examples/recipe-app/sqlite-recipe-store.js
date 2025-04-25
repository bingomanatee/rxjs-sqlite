/**
 * Script to store normalized recipe data in SQLite directly and export it
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const Database = require('better-sqlite3');

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

// Function to create the database and tables
function createDatabase() {
  console.log('Creating SQLite database...');
  
  // Create or open the database
  const dbPath = path.join(__dirname, 'recipe-database.sqlite');
  const db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create tables
  
  // Categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);
  
  // Cuisines table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cuisines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);
  
  // Ingredients table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      isPlural INTEGER NOT NULL,
      category TEXT
    )
  `);
  
  // Units table
  db.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      abbreviation TEXT,
      type TEXT
    )
  `);
  
  // Recipes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      cuisineId TEXT NOT NULL,
      instructions TEXT NOT NULL,
      originalInstructions TEXT,
      thumbnail TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (categoryId) REFERENCES categories(id),
      FOREIGN KEY (cuisineId) REFERENCES cuisines(id)
    )
  `);
  
  // Recipe tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipe_tags (
      id TEXT PRIMARY KEY,
      recipeId TEXT NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (recipeId) REFERENCES recipes(id)
    )
  `);
  
  // Recipe ingredients table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipeId TEXT NOT NULL,
      ingredientId TEXT NOT NULL,
      originalMeasure TEXT,
      quantity REAL,
      unit TEXT,
      additionalInfo TEXT,
      FOREIGN KEY (recipeId) REFERENCES recipes(id),
      FOREIGN KEY (ingredientId) REFERENCES ingredients(id)
    )
  `);
  
  // Sources table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      recipeId TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT,
      platform TEXT,
      domain TEXT,
      description TEXT,
      FOREIGN KEY (recipeId) REFERENCES recipes(id)
    )
  `);
  
  console.log('Database and tables created');
  
  return db;
}

// Function to populate the database
async function populateDatabase(db) {
  try {
    // Load normalized data
    const normalizedData = await loadNormalizedData();
    
    // Load processed recipes
    const processedRecipes = await loadProcessedRecipes();
    
    // Begin transaction
    const transaction = db.transaction(() => {
      // Insert categories
      console.log(`Inserting ${normalizedData.categories.length} categories...`);
      const insertCategory = db.prepare('INSERT OR REPLACE INTO categories (id, name) VALUES (?, ?)');
      for (const category of normalizedData.categories) {
        insertCategory.run(category.id, category.name);
      }
      
      // Insert cuisines
      console.log(`Inserting ${normalizedData.cuisines.length} cuisines...`);
      const insertCuisine = db.prepare('INSERT OR REPLACE INTO cuisines (id, name) VALUES (?, ?)');
      for (const cuisine of normalizedData.cuisines) {
        insertCuisine.run(cuisine.id, cuisine.name);
      }
      
      // Insert ingredients
      console.log(`Inserting ${normalizedData.ingredients.length} ingredients...`);
      const insertIngredient = db.prepare('INSERT OR REPLACE INTO ingredients (id, name, isPlural, category) VALUES (?, ?, ?, ?)');
      for (const ingredient of normalizedData.ingredients) {
        insertIngredient.run(
          ingredient.id,
          ingredient.name,
          ingredient.isPlural ? 1 : 0,
          ingredient.category
        );
      }
      
      // Insert units
      console.log(`Inserting ${normalizedData.units.length} units...`);
      const insertUnit = db.prepare('INSERT OR REPLACE INTO units (id, name, abbreviation, type) VALUES (?, ?, ?, ?)');
      for (const unit of normalizedData.units) {
        insertUnit.run(
          unit.id,
          unit.name,
          unit.abbreviation,
          unit.type
        );
      }
      
      // Insert recipes
      console.log(`Inserting ${processedRecipes.length} recipes...`);
      const insertRecipe = db.prepare(`
        INSERT OR REPLACE INTO recipes (
          id, name, categoryId, cuisineId, instructions, originalInstructions, thumbnail, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const insertTag = db.prepare('INSERT OR REPLACE INTO recipe_tags (id, recipeId, tag) VALUES (?, ?, ?)');
      
      for (const recipe of processedRecipes) {
        insertRecipe.run(
          recipe.id,
          recipe.name,
          recipe.categoryId,
          recipe.cuisineId,
          recipe.instructions,
          recipe.originalInstructions,
          recipe.thumbnail,
          recipe.createdAt || new Date().toISOString(),
          recipe.updatedAt || new Date().toISOString()
        );
        
        // Insert tags
        if (recipe.tags && recipe.tags.length > 0) {
          for (const tag of recipe.tags) {
            const tagId = `${recipe.id}_${tag.replace(/[^a-zA-Z0-9]/g, '')}`;
            insertTag.run(tagId, recipe.id, tag);
          }
        }
      }
      
      // Insert recipe ingredients
      console.log(`Inserting ${normalizedData.recipeIngredients.length} recipe-ingredient relationships...`);
      const insertRecipeIngredient = db.prepare(`
        INSERT OR REPLACE INTO recipe_ingredients (
          id, recipeId, ingredientId, originalMeasure, quantity, unit, additionalInfo
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const ri of normalizedData.recipeIngredients) {
        insertRecipeIngredient.run(
          ri.id,
          ri.recipeId,
          ri.ingredientId,
          ri.originalMeasure,
          ri.quantity,
          ri.unit,
          ri.additionalInfo
        );
      }
      
      // Insert sources
      console.log(`Inserting ${normalizedData.sources.length} sources...`);
      const insertSource = db.prepare(`
        INSERT OR REPLACE INTO sources (
          id, recipeId, url, type, platform, domain, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const source of normalizedData.sources) {
        insertSource.run(
          source.id,
          source.recipeId,
          source.url,
          source.type,
          source.platform,
          source.domain,
          source.description
        );
      }
    });
    
    // Execute transaction
    transaction();
    
    console.log('Database populated successfully');
  } catch (error) {
    console.error('Error populating database:', error);
    throw error;
  }
}

// Function to export data from SQLite
async function exportData(db) {
  try {
    console.log('Exporting data from SQLite...');
    
    // Create export directory
    const exportDir = path.join(__dirname, 'output', 'sqlite-export');
    await mkdirAsync(exportDir, { recursive: true });
    
    // Export recipes
    const recipes = db.prepare('SELECT * FROM recipes').all();
    
    // Add tags to recipes
    const recipeTags = db.prepare('SELECT recipeId, tag FROM recipe_tags').all();
    const recipeTagsMap = {};
    
    for (const rt of recipeTags) {
      if (!recipeTagsMap[rt.recipeId]) {
        recipeTagsMap[rt.recipeId] = [];
      }
      recipeTagsMap[rt.recipeId].push(rt.tag);
    }
    
    for (const recipe of recipes) {
      recipe.tags = recipeTagsMap[recipe.id] || [];
    }
    
    await writeFileAsync(
      path.join(exportDir, 'recipes.json'),
      JSON.stringify(recipes, null, 2)
    );
    
    // Export ingredients
    const ingredients = db.prepare('SELECT * FROM ingredients').all();
    await writeFileAsync(
      path.join(exportDir, 'ingredients.json'),
      JSON.stringify(ingredients, null, 2)
    );
    
    // Export categories
    const categories = db.prepare('SELECT * FROM categories').all();
    await writeFileAsync(
      path.join(exportDir, 'categories.json'),
      JSON.stringify(categories, null, 2)
    );
    
    // Export cuisines
    const cuisines = db.prepare('SELECT * FROM cuisines').all();
    await writeFileAsync(
      path.join(exportDir, 'cuisines.json'),
      JSON.stringify(cuisines, null, 2)
    );
    
    // Export recipe ingredients
    const recipeIngredients = db.prepare('SELECT * FROM recipe_ingredients').all();
    await writeFileAsync(
      path.join(exportDir, 'recipe-ingredients.json'),
      JSON.stringify(recipeIngredients, null, 2)
    );
    
    // Export units
    const units = db.prepare('SELECT * FROM units').all();
    await writeFileAsync(
      path.join(exportDir, 'units.json'),
      JSON.stringify(units, null, 2)
    );
    
    // Export sources
    const sources = db.prepare('SELECT * FROM sources').all();
    await writeFileAsync(
      path.join(exportDir, 'sources.json'),
      JSON.stringify(sources, null, 2)
    );
    
    console.log(`Exported data to ${exportDir}`);
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

// Function to perform example queries
function performExampleQueries(db) {
  try {
    console.log('\nPerforming example queries...');
    
    // Query 1: Find all recipes in a specific category
    console.log('\nQuery 1: Find all recipes in the "Dessert" category');
    const dessertCategory = db.prepare('SELECT id FROM categories WHERE name = ?').get('Dessert');
    
    if (dessertCategory) {
      const dessertRecipes = db.prepare('SELECT * FROM recipes WHERE categoryId = ?').all(dessertCategory.id);
      
      console.log(`Found ${dessertRecipes.length} dessert recipes`);
      
      if (dessertRecipes.length > 0) {
        console.log(`Example: ${dessertRecipes[0].name}`);
      }
    }
    
    // Query 2: Find all recipes with a specific ingredient
    console.log('\nQuery 2: Find all recipes with "Chicken"');
    const chickenIngredient = db.prepare('SELECT id FROM ingredients WHERE name LIKE ?').get('%Chicken%');
    
    if (chickenIngredient) {
      const chickenRecipes = db.prepare(`
        SELECT r.* FROM recipes r
        JOIN recipe_ingredients ri ON r.id = ri.recipeId
        WHERE ri.ingredientId = ?
      `).all(chickenIngredient.id);
      
      console.log(`Found ${chickenRecipes.length} recipes with chicken`);
      
      if (chickenRecipes.length > 0) {
        console.log(`Example: ${chickenRecipes[0].name}`);
      }
    }
    
    // Query 3: Find all recipes from a specific cuisine
    console.log('\nQuery 3: Find all recipes from "Italian" cuisine');
    const italianCuisine = db.prepare('SELECT id FROM cuisines WHERE name = ?').get('Italian');
    
    if (italianCuisine) {
      const italianRecipes = db.prepare('SELECT * FROM recipes WHERE cuisineId = ?').all(italianCuisine.id);
      
      console.log(`Found ${italianRecipes.length} Italian recipes`);
      
      if (italianRecipes.length > 0) {
        console.log(`Example: ${italianRecipes[0].name}`);
      }
    }
    
    // Query 4: Find recipes with multiple ingredients
    console.log('\nQuery 4: Find recipes with both "Chicken" and "Tomato"');
    const chickenAndTomatoRecipes = db.prepare(`
      SELECT r.* FROM recipes r
      WHERE r.id IN (
        SELECT ri1.recipeId FROM recipe_ingredients ri1
        JOIN ingredients i1 ON ri1.ingredientId = i1.id
        WHERE i1.name LIKE '%Chicken%'
      )
      AND r.id IN (
        SELECT ri2.recipeId FROM recipe_ingredients ri2
        JOIN ingredients i2 ON ri2.ingredientId = i2.id
        WHERE i2.name LIKE '%Tomato%'
      )
    `).all();
    
    console.log(`Found ${chickenAndTomatoRecipes.length} recipes with both chicken and tomato`);
    
    if (chickenAndTomatoRecipes.length > 0) {
      console.log(`Example: ${chickenAndTomatoRecipes[0].name}`);
    }
    
    // Query 5: Find recipes with a specific tag
    console.log('\nQuery 5: Find recipes with the tag "Spicy"');
    const spicyRecipes = db.prepare(`
      SELECT r.* FROM recipes r
      JOIN recipe_tags rt ON r.id = rt.recipeId
      WHERE rt.tag = ?
    `).all('Spicy');
    
    console.log(`Found ${spicyRecipes.length} spicy recipes`);
    
    if (spicyRecipes.length > 0) {
      console.log(`Example: ${spicyRecipes[0].name}`);
    }
    
    // Query 6: Find recipes with video sources
    console.log('\nQuery 6: Find recipes with video tutorials');
    const videoRecipes = db.prepare(`
      SELECT r.* FROM recipes r
      JOIN sources s ON r.id = s.recipeId
      WHERE s.type = 'video'
    `).all();
    
    console.log(`Found ${videoRecipes.length} recipes with video tutorials`);
    
    if (videoRecipes.length > 0) {
      console.log(`Example: ${videoRecipes[0].name}`);
      
      // Get the video source for this recipe
      const recipeVideoSource = db.prepare(`
        SELECT * FROM sources
        WHERE recipeId = ? AND type = 'video'
        LIMIT 1
      `).get(videoRecipes[0].id);
      
      if (recipeVideoSource) {
        console.log(`Video URL: ${recipeVideoSource.url}`);
      }
    }
    
    // Query 7: Find recipes with specific measurement units
    console.log('\nQuery 7: Find recipes that use cups');
    const cupRecipes = db.prepare(`
      SELECT DISTINCT r.* FROM recipes r
      JOIN recipe_ingredients ri ON r.id = ri.recipeId
      WHERE ri.unit LIKE '%cup%'
    `).all();
    
    console.log(`Found ${cupRecipes.length} recipes that use cups`);
    
    if (cupRecipes.length > 0) {
      console.log(`Example: ${cupRecipes[0].name}`);
      
      // Get the ingredients that use cups in this recipe
      const recipeCupIngredients = db.prepare(`
        SELECT ri.*, i.name as ingredientName FROM recipe_ingredients ri
        JOIN ingredients i ON ri.ingredientId = i.id
        WHERE ri.recipeId = ? AND ri.unit LIKE '%cup%'
      `).all(cupRecipes[0].id);
      
      if (recipeCupIngredients.length > 0) {
        console.log('Ingredients measured in cups:');
        
        for (const ri of recipeCupIngredients) {
          console.log(`- ${ri.quantity} ${ri.unit} of ${ri.ingredientName}`);
        }
      }
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
    db = createDatabase();
    
    // Populate the database
    await populateDatabase(db);
    
    // Perform example queries
    performExampleQueries(db);
    
    // Export data from SQLite
    await exportData(db);
    
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the database
    if (db) {
      db.close();
      console.log('Database closed');
    }
  }
}

// Run the script
main();
