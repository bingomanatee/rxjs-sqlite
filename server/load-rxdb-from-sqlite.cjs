/**
 * Load data from SQLite into RxDB
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { createRxDatabase, addRxPlugin } = require("rxdb");
const { RxDBDevModePlugin } = require("rxdb/plugins/dev-mode");
const { getRxStorageMemory } = require("rxdb/plugins/storage-memory");
const { wrappedValidateAjvStorage } = require("rxdb/plugins/validate-ajv");

// Connect to the SQLite database
const sqliteDbPath = path.join(__dirname, "data", "rxdb-recipedb.sqlite");
const sqliteDb = new Database(sqliteDbPath);

// Define collection schemas
const recipeSchema = {
  title: "recipe schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    name: { type: "string" },
    categoryId: { type: ["string", "null"], default: null },
    cuisineId: { type: ["string", "null"], default: null },
    instructions: { type: ["string", "null"], default: null },
    thumbnail: { type: ["string", "null"], default: null },
    createdAt: { type: ["string", "null"], default: null },
    updatedAt: { type: ["string", "null"], default: null },
  },
  required: ["id"],
};

const ingredientSchema = {
  title: "ingredient schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    name: { type: "string" },
    isPlural: { type: "boolean" },
    category: { type: ["string", "null"], default: null },
    description: { type: ["string", "null"], default: null },
    nutritionalInfo: { type: ["string", "null"], default: null },
    substitutes: { type: "array", items: { type: "string" } },
  },
  required: ["id"],
};

const metadataSchema = {
  title: "metadata schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    type: { type: "string" },
    value: { type: "string" },
    displayName: { type: "string" },
    description: { type: ["string", "null"], default: null },
  },
  required: ["id"],
};

const recipeIngredientSchema = {
  title: "recipe ingredient schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    recipeId: { type: "string" },
    ingredientId: { type: "string" },
    originalMeasure: { type: ["string", "null"], default: null },
    quantity: { type: ["number", "null"], default: null },
    unit: { type: ["string", "null"], default: null },
    additionalInfo: { type: ["string", "null"], default: null },
    stepNumber: { type: ["number", "null"], default: null },
  },
  required: ["id"],
};

const recipeStepSchema = {
  title: "recipe step schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    recipeId: { type: "string" },
    stepNumber: { type: "number" },
    instruction: { type: "string" },
    duration: { type: ["number", "null"], default: null },
    image: { type: ["string", "null"], default: null },
  },
  required: ["id"],
};

async function main() {
  try {
    // Add the dev-mode plugin with warnings disabled
    addRxPlugin(RxDBDevModePlugin);

    // Disable dev-mode warnings to reduce console output
    if (RxDBDevModePlugin.disableWarnings) {
      RxDBDevModePlugin.disableWarnings();
    }

    // Create RxDB database with memory adapter
    const db = await createRxDatabase({
      name: "recipedb",
      storage: wrappedValidateAjvStorage({
        storage: getRxStorageMemory(),
      }),
    });

    // Add collections to database
    const collections = await db.addCollections({
      recipes: { schema: recipeSchema },
      ingredients: { schema: ingredientSchema },
      metadata: { schema: metadataSchema },
      recipeIngredients: { schema: recipeIngredientSchema },
      recipeSteps: { schema: recipeStepSchema },
    });

    // Load data from SQLite
    console.log("Loading data from SQLite database...");

    // Load metadata
    const metadata = sqliteDb.prepare("SELECT * FROM metadata").all();
    console.log(`Found ${metadata.length} metadata items in SQLite`);
    for (const item of metadata) {
      await collections.metadata.insert(item);
    }
    console.log(`Inserted ${metadata.length} metadata items into RxDB`);

    // Load recipes
    const recipes = sqliteDb.prepare("SELECT * FROM recipes").all();
    console.log(`Found ${recipes.length} recipes in SQLite`);
    for (const recipe of recipes) {
      await collections.recipes.insert(recipe);
    }
    console.log(`Inserted ${recipes.length} recipes into RxDB`);

    // Load ingredients
    const ingredients = sqliteDb.prepare("SELECT * FROM ingredients").all();
    console.log(`Found ${ingredients.length} ingredients in SQLite`);
    let insertedCount = 0;
    let errorCount = 0;

    for (const ingredient of ingredients) {
      try {
        // Convert substitutes from JSON string to array
        if (ingredient.substitutes) {
          try {
            ingredient.substitutes = JSON.parse(ingredient.substitutes);
          } catch (error) {
            console.error(
              `Error parsing substitutes for ingredient ${ingredient.id}:`,
              error
            );
            ingredient.substitutes = [];
          }
        } else {
          ingredient.substitutes = [];
        }

        // Convert isPlural from integer to boolean
        ingredient.isPlural = ingredient.isPlural === 1;

        await collections.ingredients.insert(ingredient);
        insertedCount++;
      } catch (error) {
        errorCount++;
        console.error(
          `Error inserting ingredient ${ingredient.id}:`,
          error.message
        );
      }
    }
    console.log(
      `Inserted ${insertedCount} ingredients into RxDB (${errorCount} errors)`
    );

    // Load recipe steps
    const steps = sqliteDb.prepare("SELECT * FROM recipe_steps").all();
    console.log(`Found ${steps.length} recipe steps in SQLite`);
    let stepsInserted = 0;
    let stepsErrors = 0;

    for (const step of steps) {
      try {
        await collections.recipeSteps.insert(step);
        stepsInserted++;
      } catch (error) {
        stepsErrors++;
        console.error(`Error inserting step ${step.id}:`, error.message);
      }
    }
    console.log(
      `Inserted ${stepsInserted} recipe steps into RxDB (${stepsErrors} errors)`
    );

    // Load recipe ingredients
    const recipeIngredients = sqliteDb
      .prepare("SELECT * FROM recipe_ingredients")
      .all();
    console.log(
      `Found ${recipeIngredients.length} recipe ingredients in SQLite`
    );
    let riInserted = 0;
    let riErrors = 0;

    for (const ri of recipeIngredients) {
      try {
        await collections.recipeIngredients.insert(ri);
        riInserted++;
      } catch (error) {
        riErrors++;
        console.error(
          `Error inserting recipe ingredient ${ri.id}:`,
          error.message
        );
      }
    }
    console.log(
      `Inserted ${riInserted} recipe ingredients into RxDB (${riErrors} errors)`
    );

    console.log("Data loaded successfully from SQLite to RxDB");

    // Export RxDB data to JSON files
    const outputDir = path.join(
      __dirname,
      "..",
      "src",
      "examples",
      "recipe-app",
      "output",
      "rxdb-export"
    );
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Export each collection
    for (const [collectionName, collection] of Object.entries(collections)) {
      const collectionDir = path.join(outputDir, collectionName);
      if (!fs.existsSync(collectionDir)) {
        fs.mkdirSync(collectionDir, { recursive: true });
      }

      const docs = await collection.find().exec();
      console.log(`Exporting ${docs.length} documents from ${collectionName}`);

      for (const doc of docs) {
        const docData = doc.toJSON();
        const filePath = path.join(collectionDir, `${docData.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(docData, null, 2));
      }
    }

    console.log("RxDB data exported to JSON files");

    // Close the SQLite database
    sqliteDb.close();

    // Close the RxDB database
    await db.destroy();
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
