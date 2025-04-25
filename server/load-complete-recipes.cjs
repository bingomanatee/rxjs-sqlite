/**
 * Load complete recipes with steps and ingredients from JSON backups
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// Connect to the database
const dbPath = path.join(__dirname, "data", "rxdb-recipedb.sqlite");
const db = new Database(dbPath);

// Temporarily disable foreign key constraints
db.pragma("foreign_keys = OFF");

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS metadata (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    displayName TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    categoryId TEXT,
    cuisineId TEXT,
    instructions TEXT,
    thumbnail TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (categoryId) REFERENCES metadata(id),
    FOREIGN KEY (cuisineId) REFERENCES metadata(id)
  );

  CREATE TABLE IF NOT EXISTS recipe_steps (
    id TEXT PRIMARY KEY,
    recipeId TEXT NOT NULL,
    stepNumber INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    duration INTEGER DEFAULT 0,
    image TEXT,
    FOREIGN KEY (recipeId) REFERENCES recipes(id)
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    isPlural BOOLEAN DEFAULT 0,
    category TEXT,
    description TEXT,
    nutritionalInfo TEXT,
    substitutes TEXT
  );

  CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipeId TEXT NOT NULL,
    ingredientId TEXT NOT NULL,
    originalMeasure TEXT,
    quantity REAL,
    unit TEXT,
    additionalInfo TEXT,
    stepNumber INTEGER,
    FOREIGN KEY (recipeId) REFERENCES recipes(id),
    FOREIGN KEY (ingredientId) REFERENCES ingredients(id)
  );
`);

// Load JSON data from backup files
const normalizedDir = path.join(
  __dirname,
  "..",
  "src",
  "examples",
  "recipe-app",
  "output",
  "normalized"
);

// Load recipes
const recipesPath = path.join(normalizedDir, "recipes.json");
let recipes = [];
if (fs.existsSync(recipesPath)) {
  try {
    recipes = JSON.parse(fs.readFileSync(recipesPath, "utf8"));
    console.log(`Loaded ${recipes.length} recipes from ${recipesPath}`);
  } catch (error) {
    console.error(`Error loading recipes from ${recipesPath}:`, error);
  }
}

// Load recipe steps
const stepsPath = path.join(normalizedDir, "recipe-steps.json");
let steps = [];
if (fs.existsSync(stepsPath)) {
  try {
    steps = JSON.parse(fs.readFileSync(stepsPath, "utf8"));
    console.log(`Loaded ${steps.length} recipe steps from ${stepsPath}`);
  } catch (error) {
    console.error(`Error loading recipe steps from ${stepsPath}:`, error);
  }
}

// If no steps were found, try to load from the rxdb-export directory
if (steps.length === 0) {
  const exportDir = path.join(
    __dirname,
    "..",
    "src",
    "examples",
    "recipe-app",
    "output",
    "rxdb-export",
    "recipeSteps"
  );
  if (fs.existsSync(exportDir)) {
    try {
      const stepFiles = fs.readdirSync(exportDir);
      for (const file of stepFiles) {
        if (file.endsWith(".json")) {
          const stepData = JSON.parse(
            fs.readFileSync(path.join(exportDir, file), "utf8")
          );
          steps.push(stepData);
        }
      }
      console.log(
        `Loaded ${steps.length} recipe steps from rxdb-export directory`
      );
    } catch (error) {
      console.error(
        `Error loading recipe steps from rxdb-export directory:`,
        error
      );
    }
  }
}

// Load ingredients
const ingredientsPath = path.join(normalizedDir, "ingredients.json");
let ingredients = [];
if (fs.existsSync(ingredientsPath)) {
  try {
    ingredients = JSON.parse(fs.readFileSync(ingredientsPath, "utf8"));
    console.log(
      `Loaded ${ingredients.length} ingredients from ${ingredientsPath}`
    );
  } catch (error) {
    console.error(`Error loading ingredients from ${ingredientsPath}:`, error);
  }
}

// Load recipe ingredients
const recipeIngredientsPath = path.join(
  normalizedDir,
  "recipe-ingredients.json"
);
let recipeIngredients = [];
if (fs.existsSync(recipeIngredientsPath)) {
  try {
    recipeIngredients = JSON.parse(
      fs.readFileSync(recipeIngredientsPath, "utf8")
    );
    console.log(
      `Loaded ${recipeIngredients.length} recipe ingredients from ${recipeIngredientsPath}`
    );
  } catch (error) {
    console.error(
      `Error loading recipe ingredients from ${recipeIngredientsPath}:`,
      error
    );
  }
}

// Always load metadata from add-recipes.cjs to ensure we have the required categories and cuisines
console.log("Loading metadata from add-recipes.cjs");
const addRecipesPath = path.join(__dirname, "add-recipes.cjs");
let metadata = [];
if (fs.existsSync(addRecipesPath)) {
  try {
    const addRecipesContent = fs.readFileSync(addRecipesPath, "utf8");

    // Extract metadata array
    const metadataMatch = addRecipesContent.match(
      /const metadata = (\[[\s\S]*?\]);/
    );
    if (metadataMatch && metadataMatch[1]) {
      metadata = eval(metadataMatch[1]);
      console.log(
        `Loaded ${metadata.length} metadata items from add-recipes.cjs`
      );
    }

    // If no recipes were found, load them from add-recipes.cjs
    if (recipes.length === 0) {
      console.log("No JSON data found, loading recipes from add-recipes.cjs");
      // Extract recipes array
      const recipesMatch = addRecipesContent.match(
        /const recipes = (\[[\s\S]*?\]);/
      );
      if (recipesMatch && recipesMatch[1]) {
        // Use eval to parse the recipes array (not ideal, but works for this purpose)
        recipes = eval(recipesMatch[1]);
        console.log(`Loaded ${recipes.length} recipes from add-recipes.cjs`);
      }
    }
  } catch (error) {
    console.error("Error loading data from add-recipes.cjs:", error);
  }
}

// Prepare SQL statements
const insertMetadata = db.prepare(
  "INSERT OR REPLACE INTO metadata (id, type, value, displayName, description) VALUES (?, ?, ?, ?, ?)"
);

const insertRecipe = db.prepare(
  "INSERT OR REPLACE INTO recipes (id, name, categoryId, cuisineId, instructions, thumbnail, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);

const insertIngredient = db.prepare(
  "INSERT OR REPLACE INTO ingredients (id, name, isPlural, category, description, nutritionalInfo, substitutes) VALUES (?, ?, ?, ?, ?, ?, ?)"
);

const insertRecipeStep = db.prepare(
  "INSERT OR REPLACE INTO recipe_steps (id, recipeId, stepNumber, instruction, duration, image) VALUES (?, ?, ?, ?, ?, ?)"
);

const insertRecipeIngredient = db.prepare(
  "INSERT OR REPLACE INTO recipe_ingredients (id, recipeId, ingredientId, originalMeasure, quantity, unit, additionalInfo, stepNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);

// Execute transactions in the correct order to respect foreign key constraints
try {
  // 1. Insert metadata first (categories, cuisines, etc.)
  db.transaction(() => {
    for (const item of metadata) {
      insertMetadata.run(
        item.id,
        item.type,
        item.value,
        item.displayName,
        item.description || null
      );
    }
  })();
  console.log(`Inserted ${metadata.length} metadata items`);

  // 2. Insert recipes (depends on metadata)
  db.transaction(() => {
    for (const recipe of recipes) {
      insertRecipe.run(
        recipe.id,
        recipe.name,
        recipe.categoryId || null,
        recipe.cuisineId || null,
        recipe.instructions || null,
        recipe.thumbnail || null,
        recipe.createdAt || new Date().toISOString(),
        recipe.updatedAt || new Date().toISOString()
      );
    }
  })();
  console.log(`Inserted ${recipes.length} recipes`);

  // 3. Insert ingredients (independent)
  db.transaction(() => {
    for (const ingredient of ingredients) {
      insertIngredient.run(
        ingredient.id,
        ingredient.name,
        ingredient.isPlural ? 1 : 0,
        ingredient.category || null,
        ingredient.description || null,
        ingredient.nutritionalInfo || null,
        ingredient.substitutes ? JSON.stringify(ingredient.substitutes) : null
      );
    }
  })();
  console.log(`Inserted ${ingredients.length} ingredients`);

  // 4. Insert recipe steps (depends on recipes)
  db.transaction(() => {
    for (const step of steps) {
      // Skip steps for recipes that don't exist
      const recipeExists = db
        .prepare("SELECT 1 FROM recipes WHERE id = ?")
        .get(step.recipeId);
      if (!recipeExists) {
        console.log(
          `Skipping step ${step.id} for non-existent recipe ${step.recipeId}`
        );
        continue;
      }

      insertRecipeStep.run(
        step.id,
        step.recipeId,
        step.stepNumber,
        step.instruction,
        step.duration || 0,
        step.image || null
      );
    }
  })();
  console.log(`Inserted recipe steps`);

  // 5. Insert recipe ingredients (depends on recipes and ingredients)
  db.transaction(() => {
    let insertedCount = 0;
    let skippedCount = 0;

    for (const ri of recipeIngredients) {
      // Skip recipe ingredients for recipes or ingredients that don't exist
      const recipeExists = db
        .prepare("SELECT 1 FROM recipes WHERE id = ?")
        .get(ri.recipeId);
      const ingredientExists = db
        .prepare("SELECT 1 FROM ingredients WHERE id = ?")
        .get(ri.ingredientId);

      if (!recipeExists || !ingredientExists) {
        skippedCount++;
        continue;
      }

      insertRecipeIngredient.run(
        ri.id,
        ri.recipeId,
        ri.ingredientId,
        ri.originalMeasure || null,
        ri.quantity || null,
        ri.unit || null,
        ri.additionalInfo || null,
        ri.stepNumber || null
      );
      insertedCount++;
    }

    console.log(
      `Inserted ${insertedCount} recipe ingredients (skipped ${skippedCount})`
    );
  })();
} catch (error) {
  console.error("Error inserting data:", error);
}

// Re-enable foreign key constraints
db.pragma("foreign_keys = ON");

console.log("Database updated successfully");

// Close the database connection
db.close();
