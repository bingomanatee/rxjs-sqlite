/**
 * direct-sqlite.js
 *
 * This script demonstrates using SQLite directly to store and retrieve recipe data,
 * and then exporting the data to individual JSON files.
 */
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);

// Configuration
const DB_FILE = path.join(__dirname, "recipe-database.sqlite");
const OUTPUT_DIR = path.join(__dirname, "output", "record-files");

// Sample data
const sampleData = {
  recipes: [
    {
      id: "recipe-1",
      name: "Spaghetti Carbonara",
      categoryId: "cat-pasta",
      cuisineId: "cuis-italian",
      instructions:
        "Cook pasta. Mix eggs, cheese, and pepper. Combine with pasta and bacon.",
      thumbnail: "https://example.com/carbonara.jpg",
      createdAt: "2023-01-01T12:00:00Z",
      updatedAt: "2023-01-01T12:00:00Z",
    },
    {
      id: "recipe-2",
      name: "Chicken Curry",
      categoryId: "cat-curry",
      cuisineId: "cuis-indian",
      instructions: "Cook chicken with curry sauce and serve with rice.",
      thumbnail: "https://example.com/curry.jpg",
      createdAt: "2023-01-02T12:00:00Z",
      updatedAt: "2023-01-02T12:00:00Z",
    },
  ],
  ingredients: [
    {
      id: "ing-1",
      name: "spaghetti",
      isPlural: true,
      category: "pasta",
    },
    {
      id: "ing-2",
      name: "egg",
      isPlural: false,
      category: "dairy",
    },
    {
      id: "ing-3",
      name: "bacon",
      isPlural: false,
      category: "meat",
    },
    {
      id: "ing-4",
      name: "chicken",
      isPlural: false,
      category: "meat",
    },
    {
      id: "ing-5",
      name: "curry powder",
      isPlural: false,
      category: "spice",
    },
  ],
  metadata: [
    {
      id: "cat-pasta",
      type: "category",
      value: "pasta",
      displayName: "Pasta",
    },
    {
      id: "cat-curry",
      type: "category",
      value: "curry",
      displayName: "Curry",
    },
    {
      id: "cuis-italian",
      type: "cuisine",
      value: "italian",
      displayName: "Italian",
    },
    {
      id: "cuis-indian",
      type: "cuisine",
      value: "indian",
      displayName: "Indian",
    },
    {
      id: "tag-quick",
      type: "tag",
      value: "quick",
      displayName: "Quick & Easy",
    },
    {
      id: "tag-spicy",
      type: "tag",
      value: "spicy",
      displayName: "Spicy",
    },
  ],
  recipe_ingredients: [
    {
      id: "ri-1",
      recipeId: "recipe-1",
      ingredientId: "ing-1",
      originalMeasure: "200g",
      quantity: 200,
      unit: "g",
      additionalInfo: null,
    },
    {
      id: "ri-2",
      recipeId: "recipe-1",
      ingredientId: "ing-2",
      originalMeasure: "2",
      quantity: 2,
      unit: null,
      additionalInfo: null,
    },
    {
      id: "ri-3",
      recipeId: "recipe-1",
      ingredientId: "ing-3",
      originalMeasure: "100g",
      quantity: 100,
      unit: "g",
      additionalInfo: "diced",
    },
    {
      id: "ri-4",
      recipeId: "recipe-2",
      ingredientId: "ing-4",
      originalMeasure: "500g",
      quantity: 500,
      unit: "g",
      additionalInfo: "diced",
    },
    {
      id: "ri-5",
      recipeId: "recipe-2",
      ingredientId: "ing-5",
      originalMeasure: "2 tbsp",
      quantity: 2,
      unit: "tbsp",
      additionalInfo: null,
    },
  ],
  recipe_metadata: [
    {
      id: "rm-1",
      recipeId: "recipe-1",
      metadataId: "tag-quick",
    },
    {
      id: "rm-2",
      recipeId: "recipe-2",
      metadataId: "tag-spicy",
    },
  ],
  sources: [
    {
      id: "src-1",
      recipeId: "recipe-1",
      url: "https://example.com/carbonara",
      type: "website",
      platform: null,
      domain: "example.com",
      description: "Classic Carbonara Recipe",
    },
    {
      id: "src-2",
      recipeId: "recipe-2",
      url: "https://example.com/curry",
      type: "website",
      platform: null,
      domain: "example.com",
      description: "Easy Chicken Curry",
    },
  ],
};

// Original instructions for recipes
const originalInstructions = {
  "recipe-1":
    "Cook spaghetti according to package instructions. In a bowl, whisk eggs, grated Pecorino Romano, and black pepper. Cook bacon until crispy. Drain pasta, reserving some water. Combine pasta with bacon, then quickly stir in egg mixture. Add pasta water if needed. Serve immediately.",
  "recipe-2":
    "Heat oil in a large pan. Add onions and cook until soft. Add garlic, ginger, and curry powder. Cook for 1 minute. Add chicken pieces and cook until browned. Add coconut milk and simmer for 20 minutes. Serve with rice.",
};

// Create the database and tables
function createDatabase() {
  console.log("Creating database...");

  // Create or open the database
  const db = new Database(DB_FILE);

  // Disable foreign keys for simplicity
  db.pragma("foreign_keys = OFF");

  // Create tables without foreign key constraints for simplicity
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      categoryId TEXT,
      cuisineId TEXT,
      instructions TEXT NOT NULL,
      thumbnail TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      isPlural INTEGER,
      category TEXT
    );

    CREATE TABLE IF NOT EXISTS metadata (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      displayName TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipeId TEXT NOT NULL,
      ingredientId TEXT NOT NULL,
      originalMeasure TEXT,
      quantity REAL,
      unit TEXT,
      additionalInfo TEXT
    );

    CREATE TABLE IF NOT EXISTS recipe_metadata (
      id TEXT PRIMARY KEY,
      recipeId TEXT NOT NULL,
      metadataId TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      recipeId TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT,
      platform TEXT,
      domain TEXT,
      description TEXT
    );
  `);

  console.log("Database and tables created");

  return db;
}

// Insert data into the database
function insertData(db) {
  console.log("Inserting data into database...");

  // Insert metadata first (needed for foreign keys)
  const insertMetadata = db.prepare(
    "INSERT OR REPLACE INTO metadata (id, type, value, displayName, description) VALUES (?, ?, ?, ?, ?)"
  );
  for (const metadata of sampleData.metadata) {
    insertMetadata.run(
      metadata.id,
      metadata.type,
      metadata.value,
      metadata.displayName,
      metadata.description || null
    );
  }
  console.log(`Inserted ${sampleData.metadata.length} metadata records`);

  // Insert ingredients (needed for recipe_ingredients)
  const insertIngredient = db.prepare(
    "INSERT OR REPLACE INTO ingredients (id, name, isPlural, category) VALUES (?, ?, ?, ?)"
  );
  for (const ingredient of sampleData.ingredients) {
    insertIngredient.run(
      ingredient.id,
      ingredient.name,
      ingredient.isPlural ? 1 : 0,
      ingredient.category || null
    );
  }
  console.log(`Inserted ${sampleData.ingredients.length} ingredients`);

  // Insert recipes (needed for recipe_ingredients, recipe_metadata, and sources)
  const insertRecipe = db.prepare(
    "INSERT OR REPLACE INTO recipes (id, name, categoryId, cuisineId, instructions, thumbnail, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (const recipe of sampleData.recipes) {
    insertRecipe.run(
      recipe.id,
      recipe.name,
      recipe.categoryId || null,
      recipe.cuisineId || null,
      recipe.instructions,
      recipe.thumbnail || null,
      recipe.createdAt || null,
      recipe.updatedAt || null
    );
  }
  console.log(`Inserted ${sampleData.recipes.length} recipes`);

  // Now that recipes and ingredients exist, insert recipe_ingredients
  const insertRecipeIngredient = db.prepare(
    "INSERT OR REPLACE INTO recipe_ingredients (id, recipeId, ingredientId, originalMeasure, quantity, unit, additionalInfo) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  for (const recipeIngredient of sampleData.recipe_ingredients) {
    insertRecipeIngredient.run(
      recipeIngredient.id,
      recipeIngredient.recipeId,
      recipeIngredient.ingredientId,
      recipeIngredient.originalMeasure || null,
      recipeIngredient.quantity || null,
      recipeIngredient.unit || null,
      recipeIngredient.additionalInfo || null
    );
  }
  console.log(
    `Inserted ${sampleData.recipe_ingredients.length} recipe ingredients`
  );

  // Now that recipes and metadata exist, insert recipe_metadata
  const insertRecipeMetadata = db.prepare(
    "INSERT OR REPLACE INTO recipe_metadata (id, recipeId, metadataId) VALUES (?, ?, ?)"
  );
  for (const recipeMetadata of sampleData.recipe_metadata) {
    insertRecipeMetadata.run(
      recipeMetadata.id,
      recipeMetadata.recipeId,
      recipeMetadata.metadataId
    );
  }
  console.log(
    `Inserted ${sampleData.recipe_metadata.length} recipe metadata records`
  );

  // Now that recipes exist, insert sources
  const insertSource = db.prepare(
    "INSERT OR REPLACE INTO sources (id, recipeId, url, type, platform, domain, description) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  for (const source of sampleData.sources) {
    insertSource.run(
      source.id,
      source.recipeId,
      source.url,
      source.type || null,
      source.platform || null,
      source.domain || null,
      source.description || null
    );
  }
  console.log(`Inserted ${sampleData.sources.length} sources`);

  console.log("Data insertion completed");
}

// Create the output directory structure
async function createDirectoryStructure() {
  console.log("Creating directory structure...");

  // Create the main output directory
  await mkdirAsync(OUTPUT_DIR, { recursive: true });

  // Create a directory for each table
  const tables = [
    "recipes",
    "ingredients",
    "metadata",
    "recipe_ingredients",
    "recipe_metadata",
    "sources",
  ];
  for (const table of tables) {
    await mkdirAsync(path.join(OUTPUT_DIR, table), { recursive: true });
  }

  // Create a directory for original instructions
  await mkdirAsync(path.join(OUTPUT_DIR, "instructions"), { recursive: true });

  console.log("Directory structure created");
}

// Write a record to a file
async function writeRecordToFile(table, record) {
  const id = record.id;
  const filePath = path.join(OUTPUT_DIR, table, `${id}.json`);

  await writeFileAsync(filePath, JSON.stringify(record, null, 2));
  return filePath;
}

// Write original instructions to a file
async function writeInstructionsToFile(recipeId, instructions) {
  const filePath = path.join(OUTPUT_DIR, "instructions", `${recipeId}.txt`);

  await writeFileAsync(filePath, instructions);
  return filePath;
}

// Export data from the database to individual files
async function exportData(db) {
  console.log("Exporting data to individual files...");

  // Create directory structure
  await createDirectoryStructure();

  // Export recipes
  const recipes = db.prepare("SELECT * FROM recipes").all();
  console.log(`Exporting ${recipes.length} recipes...`);
  for (const recipe of recipes) {
    await writeRecordToFile("recipes", recipe);

    // Write original instructions if available
    if (originalInstructions[recipe.id]) {
      await writeInstructionsToFile(recipe.id, originalInstructions[recipe.id]);
    }
  }

  // Export ingredients
  const ingredients = db.prepare("SELECT * FROM ingredients").all();
  console.log(`Exporting ${ingredients.length} ingredients...`);
  for (const ingredient of ingredients) {
    await writeRecordToFile("ingredients", ingredient);
  }

  // Export metadata
  const metadata = db.prepare("SELECT * FROM metadata").all();
  console.log(`Exporting ${metadata.length} metadata records...`);
  for (const meta of metadata) {
    await writeRecordToFile("metadata", meta);
  }

  // Export recipe ingredients
  const recipeIngredients = db
    .prepare("SELECT * FROM recipe_ingredients")
    .all();
  console.log(`Exporting ${recipeIngredients.length} recipe ingredients...`);
  for (const recipeIngredient of recipeIngredients) {
    await writeRecordToFile("recipe_ingredients", recipeIngredient);
  }

  // Export recipe metadata
  const recipeMetadata = db.prepare("SELECT * FROM recipe_metadata").all();
  console.log(`Exporting ${recipeMetadata.length} recipe metadata records...`);
  for (const recipeMeta of recipeMetadata) {
    await writeRecordToFile("recipe_metadata", recipeMeta);
  }

  // Export sources
  const sources = db.prepare("SELECT * FROM sources").all();
  console.log(`Exporting ${sources.length} sources...`);
  for (const source of sources) {
    await writeRecordToFile("sources", source);
  }

  console.log("Data export completed");

  // Create a README file with instructions
  const readmePath = path.join(OUTPUT_DIR, "README.md");
  const readmeContent = `# Recipe Database Dump

This directory contains a dump of the recipe database, with each record stored as an individual JSON file.

## Directory Structure

- \`recipes/\`: Contains all records from the \`recipes\` table
- \`ingredients/\`: Contains all records from the \`ingredients\` table
- \`metadata/\`: Contains all records from the \`metadata\` table
- \`recipe_ingredients/\`: Contains all records from the \`recipe_ingredients\` table
- \`recipe_metadata/\`: Contains all records from the \`recipe_metadata\` table
- \`sources/\`: Contains all records from the \`sources\` table
- \`instructions/\`: Contains the original instructions for each recipe

## Record Counts

- \`recipes\`: ${recipes.length} records
- \`ingredients\`: ${ingredients.length} records
- \`metadata\`: ${metadata.length} records
- \`recipe_ingredients\`: ${recipeIngredients.length} records
- \`recipe_metadata\`: ${recipeMetadata.length} records
- \`sources\`: ${sources.length} records

## Recreating the Database

To recreate the database:

1. Create a new database with the same schema
2. For each directory, read all JSON files and insert the records into the corresponding table
3. For the \`instructions/\` directory, read the text files and associate them with the corresponding recipes

This structure allows for easy version control of individual records and simplifies the process of recreating the database from scratch.
`;

  await writeFileAsync(readmePath, readmeContent);
  console.log(`Created README file: ${readmePath}`);
}

// Main function
async function main() {
  try {
    console.log("Starting direct SQLite example...");

    // Create the database and tables
    const db = createDatabase();

    // Insert data into the database
    insertData(db);

    // Export data to individual files
    await exportData(db);

    // Close the database
    db.close();

    console.log("Direct SQLite example completed successfully");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the script
main();
