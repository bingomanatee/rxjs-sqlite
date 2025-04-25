/**
 * Recipe App Server
 * This server uses RxDB with the SQLite adapter to store and retrieve recipe data
 */
const express = require("express");
const cors = require("cors");
const { createRxDatabase, addRxPlugin } = require("rxdb");
const { RxDBDevModePlugin } = require("rxdb/plugins/dev-mode");
const { getRxStorageMemory } = require("rxdb/plugins/storage-memory");
// We're not using the AJV validator as it doesn't work with our schema
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { parseRecipeSteps } = require("./recipe-step-parser");

// Setup directories
const logDir = path.join(__dirname, "logs");
const dataDir = path.join(__dirname, "data");

// Ensure directories exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const logFile = path.join(logDir, "recipe-server.log");
const logStream = fs.createWriteStream(logFile, { flags: "a" });

// Custom logger that writes to both console and file
const logger = {
  log: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message}\n`;
    console.log(message);
    try {
      logStream.write(logMessage);
    } catch (err) {
      console.error("Error writing to log file:", err.message);
    }
  },
  error: (message, error) => {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ERROR: ${message}\n`;
    if (error) {
      // Only log essential error info, not the full object
      logMessage += `Error details: ${error.message || error}\n`;
      if (error.stack) {
        logMessage += `Stack trace: ${error.stack}\n`;
      }
    }
    console.error(message);
    try {
      logStream.write(logMessage);
    } catch (err) {
      console.error("Error writing to log file:", err.message);
    }
  },
};

/**
 * SQLite basics implementation using better-sqlite3
 */
function getSQLiteBasicsBetterSQLite(options = {}) {
  return {
    open: async (name) => {
      // Create a new database connection
      const db = new Database(name, options);

      // Enable WAL mode for better performance
      db.pragma("journal_mode = WAL");

      return db;
    },

    setPragma: async (db, key, value) => {
      db.pragma(`${key} = ${value}`);
    },

    journalMode: "WAL",
  };
}

/**
 * RxStorage implementation for SQLite using better-sqlite3
 */
class RxStorageSQLite {
  constructor(settings) {
    this.name = "sqlite";
    this.settings = settings;
  }

  /**
   * Create a storage instance for a collection
   */
  async createStorageInstance(params) {
    // Create a database connection
    const databaseName = params.databaseName;
    // Use a fixed path in the server directory
    const dbPath = path.join(
      __dirname,
      "data",
      `${this.settings.databaseNamePrefix || ""}${databaseName}.sqlite`
    );

    // Create the database connection
    const db = await this.settings.sqliteBasics.open(dbPath);

    // Set up the database with WAL mode for better performance
    if (this.settings.sqliteBasics.journalMode) {
      await this.settings.sqliteBasics.setPragma(
        db,
        "journal_mode",
        this.settings.sqliteBasics.journalMode
      );
    }

    // Store the database instance in the static property
    getRxStorageSQLite.lastDB = db;

    // Create the table for the collection if it doesn't exist
    const tableName = `${databaseName}_${params.collectionName}`;
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        _deleted INTEGER DEFAULT 0,
        _rev TEXT NOT NULL
      )
    `);

    // Create a storage instance
    const storageInstance = {
      databaseName: params.databaseName,
      collectionName: params.collectionName,
      schema: params.schema,
      internals: { databasePromise: Promise.resolve(db), sqlite: db },

      // Initialize the storage instance
      initialize: async () => {},

      // Write documents
      bulkWrite: async (documentWrites) => {
        const response = {
          success: [],
          error: [],
        };

        for (const writeRow of documentWrites) {
          try {
            const document = writeRow.document;
            const id = document.id;
            const documentJson = JSON.stringify(document);

            // Check if document exists
            const existingDoc = db
              .prepare(`SELECT id FROM ${tableName} WHERE id = ?`)
              .get(id);

            if (existingDoc) {
              // Update existing document
              db.prepare(
                `
                UPDATE ${tableName}
                SET data = ?, _deleted = ?, _rev = ?
                WHERE id = ?
              `
              ).run(documentJson, document._deleted ? 1 : 0, document._rev, id);
            } else {
              // Insert new document
              db.prepare(
                `
                INSERT INTO ${tableName} (id, data, _deleted, _rev)
                VALUES (?, ?, ?, ?)
              `
              ).run(id, documentJson, document._deleted ? 1 : 0, document._rev);
            }

            response.success.push(document);
          } catch (error) {
            console.error("Error writing document:", error);
            response.error.push({
              documentId: writeRow.document.id,
              error,
            });
          }
        }

        return response;
      },

      // Find documents by ID
      findDocumentsById: async (ids, withDeleted = false) => {
        if (ids.length === 0) {
          return [];
        }

        const placeholders = ids.map(() => "?").join(",");
        let query = `SELECT data FROM ${tableName} WHERE id IN (${placeholders})`;

        if (!withDeleted) {
          query += " AND _deleted = 0";
        }

        const rows = db.prepare(query).all(ids);

        return rows.map((row) => JSON.parse(row.data));
      },

      // Query documents
      query: async (preparedQuery) => {
        // Simple implementation that returns all documents
        const rows = db
          .prepare(`SELECT data FROM ${tableName} WHERE _deleted = 0`)
          .all();

        return {
          documents: rows.map((row) => JSON.parse(row.data)),
        };
      },

      // Count documents
      count: async () => {
        const count = db
          .prepare(
            `SELECT COUNT(*) as count FROM ${tableName} WHERE _deleted = 0`
          )
          .get().count;

        return {
          count,
          mode: "fast",
        };
      },

      // Get attachment data
      getAttachmentData: async () => "",

      // Get changed documents
      getChangedDocumentsSince: async () => ({
        documents: [],
        checkpoint: {},
      }),

      // Change stream
      changeStream: () => {
        const stream = {
          subscribe: () => ({
            unsubscribe: () => {},
          }),
          pipe: (...operators) => {
            // Return a new observable that has the operators applied
            return {
              subscribe: (observer) => {
                // Apply the operators to the observer
                return { unsubscribe: () => {} };
              },
            };
          },
        };
        return stream;
      },

      // Clean up deleted documents
      cleanup: async () => true,

      // Close the storage instance
      close: async () => {
        // Close the database connection
        if (db) {
          db.close();
        }
      },
    };

    return storageInstance;
  }
}

/**
 * Factory function to create a SQLite storage adapter
 */
function getRxStorageSQLite(options = {}) {
  const sqliteBasics = getSQLiteBasicsBetterSQLite(options);

  return new RxStorageSQLite({
    sqliteBasics,
    databaseNamePrefix: "rxdb-",
  });
}

// Add a static method to get the last created database instance
getRxStorageSQLite.getLastDB = function () {
  return getRxStorageSQLite.lastDB;
};

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
let db;
let collections;

// Load data from exported JSON files
const sampleData = {
  recipes: [],
  ingredients: [],
  metadata: [],
  recipeIngredients: [],
  recipeSteps: [],
};

// Load recipes
const recipesDir = path.join(
  __dirname,
  "..",
  "src",
  "examples",
  "recipe-app",
  "output",
  "rxdb-export",
  "recipes"
);
if (fs.existsSync(recipesDir)) {
  const recipeFiles = fs.readdirSync(recipesDir);
  for (const file of recipeFiles) {
    if (file.endsWith(".json")) {
      try {
        const recipeData = JSON.parse(
          fs.readFileSync(path.join(recipesDir, file), "utf8")
        );
        sampleData.recipes.push(recipeData);
      } catch (error) {
        console.error(`Error loading recipe from ${file}:`, error);
      }
    }
  }
  console.log(`Loaded ${sampleData.recipes.length} recipes from JSON files`);
}

// Load ingredients
const ingredientsDir = path.join(
  __dirname,
  "..",
  "src",
  "examples",
  "recipe-app",
  "output",
  "rxdb-export",
  "ingredients"
);
if (fs.existsSync(ingredientsDir)) {
  const ingredientFiles = fs.readdirSync(ingredientsDir);
  for (const file of ingredientFiles) {
    if (file.endsWith(".json")) {
      try {
        const ingredientData = JSON.parse(
          fs.readFileSync(path.join(ingredientsDir, file), "utf8")
        );
        sampleData.ingredients.push(ingredientData);
      } catch (error) {
        console.error(`Error loading ingredient from ${file}:`, error);
      }
    }
  }
  console.log(
    `Loaded ${sampleData.ingredients.length} ingredients from JSON files`
  );
}

// Load metadata
const metadataDir = path.join(
  __dirname,
  "..",
  "src",
  "examples",
  "recipe-app",
  "output",
  "rxdb-export",
  "metadata"
);
if (fs.existsSync(metadataDir)) {
  const metadataFiles = fs.readdirSync(metadataDir);
  for (const file of metadataFiles) {
    if (file.endsWith(".json")) {
      try {
        const metadataData = JSON.parse(
          fs.readFileSync(path.join(metadataDir, file), "utf8")
        );
        sampleData.metadata.push(metadataData);
      } catch (error) {
        console.error(`Error loading metadata from ${file}:`, error);
      }
    }
  }
  console.log(
    `Loaded ${sampleData.metadata.length} metadata items from JSON files`
  );
}

// Load recipe ingredients
const recipeIngredientsDir = path.join(
  __dirname,
  "..",
  "src",
  "examples",
  "recipe-app",
  "output",
  "rxdb-export",
  "recipeIngredients"
);
if (fs.existsSync(recipeIngredientsDir)) {
  const recipeIngredientFiles = fs.readdirSync(recipeIngredientsDir);
  for (const file of recipeIngredientFiles) {
    if (file.endsWith(".json")) {
      try {
        const recipeIngredientData = JSON.parse(
          fs.readFileSync(path.join(recipeIngredientsDir, file), "utf8")
        );
        sampleData.recipeIngredients.push(recipeIngredientData);
      } catch (error) {
        console.error(`Error loading recipe ingredient from ${file}:`, error);
      }
    }
  }
  console.log(
    `Loaded ${sampleData.recipeIngredients.length} recipe ingredients from JSON files`
  );
}

// Load recipe steps
const recipeStepsDir = path.join(
  __dirname,
  "..",
  "src",
  "examples",
  "recipe-app",
  "output",
  "rxdb-export",
  "recipeSteps"
);
if (fs.existsSync(recipeStepsDir)) {
  const recipeStepFiles = fs.readdirSync(recipeStepsDir);
  for (const file of recipeStepFiles) {
    if (file.endsWith(".json")) {
      try {
        const recipeStepData = JSON.parse(
          fs.readFileSync(path.join(recipeStepsDir, file), "utf8")
        );
        sampleData.recipeSteps.push(recipeStepData);
      } catch (error) {
        console.error(`Error loading recipe step from ${file}:`, error);
      }
    }
  }
  console.log(
    `Loaded ${sampleData.recipeSteps.length} recipe steps from JSON files`
  );
}

// If no data was loaded, use fallback sample data
if (sampleData.recipes.length === 0) {
  console.log("No data found in JSON files, using fallback sample data");
  sampleData.recipes = [
    {
      id: "recipe-1",
      name: "Spaghetti Carbonara",
      categoryId: "cat-pasta",
      cuisineId: "cuis-italian",
      instructions:
        "Cook pasta. Mix eggs, cheese, and pepper. Combine with pasta and bacon.",
      thumbnail:
        "https://www.allrecipes.com/thmb/Vg2cRidr2zcYhWGvPD8M18xM_WY=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/11973-spaghetti-carbonara-ii-DDMFS-4x3-6edea51e421e4457ac0c3269f3be5157.jpg",
      createdAt: "2023-01-01T12:00:00Z",
      updatedAt: "2023-01-01T12:00:00Z",
    },
    {
      id: "recipe-2",
      name: "Chicken Curry",
      categoryId: "cat-curry",
      cuisineId: "cuis-indian",
      instructions: "Cook chicken with curry sauce and serve with rice.",
      thumbnail:
        "https://www.allrecipes.com/thmb/I_M3fmEbQfvl_SZfPnKZf1fQJGw=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/46822-indian-chicken-curry-mfs-step-6-148-4b82a5a5a9a54a13a45375c6a6c894d8.jpg",
      createdAt: "2023-01-02T12:00:00Z",
      updatedAt: "2023-01-02T12:00:00Z",
    },
  ];
}

async function initDatabase() {
  // Skip adding the dev-mode plugin to avoid validation issues
  console.log("Skipping dev-mode plugin to avoid validation issues");

  // Update existing recipes to populate description field
  try {
    const dbPath = path.join(__dirname, "data", "rxdb-recipedb.sqlite");
    const sqliteDb = new Database(dbPath);

    // Check if we need to populate descriptions
    const needsDescriptions = sqliteDb
      .prepare(
        "SELECT COUNT(*) as count FROM recipes WHERE description IS NULL"
      )
      .get();

    if (needsDescriptions.count > 0) {
      logger.log(
        `Populating description field for ${needsDescriptions.count} recipes...`
      );

      // Update recipes with a description based on the first 150 characters of instructions
      sqliteDb
        .prepare(
          `
        UPDATE recipes
        SET description = CASE
          WHEN length(instructions) > 150
          THEN substr(instructions, 1, 150) || '...'
          ELSE instructions
        END
        WHERE description IS NULL
      `
        )
        .run();

      logger.log("Description field populated for existing recipes");
    }

    sqliteDb.close();
  } catch (error) {
    logger.error("Error populating description field:", error);
  }

  // Create RxDB database with SQLite adapter
  // Disable validation to avoid issues with nullable fields
  db = await createRxDatabase({
    name: "recipedb",
    storage: getRxStorageSQLite({
      filename: path.join(__dirname, "data", "rxdb-recipedb.sqlite"),
    }),
    // Disable dev mode completely
    devMode: false,
    options: {
      validationStrategy: {
        // Never validate documents to avoid issues with nullable fields
        validateBeforeInsert: false,
        validateBeforeSave: false,
        validateOnQuery: false,
      },
    },
  });

  // Define collection schemas
  const recipeSchema = {
    title: "recipe schema",
    version: 0,
    primaryKey: "id",
    type: "object",
    properties: {
      id: { type: "string", maxLength: 100 },
      name: { type: "string" },
      categoryId: { type: "string" },
      cuisineId: { type: "string" },
      description: { type: ["string", "null"], default: null },
      instructions: { type: "string" },
      thumbnail: { type: "string" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
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
      category: { type: "string" },
      description: { type: "string" },
      nutritionalInfo: { type: "string" },
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
      originalMeasure: { type: "string" },
      quantity: { type: "number" },
      unit: { type: ["string", "null"], default: null },
      additionalInfo: { type: ["string", "null"], default: null },
      stepNumber: { type: "number" },
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
      duration: { type: "number" },
      image: { type: ["string", "null"], default: null },
    },
    required: ["id"],
  };

  const bookmarkSchema = {
    title: "bookmark schema",
    version: 0,
    primaryKey: "id",
    type: "object",
    properties: {
      id: { type: "string", maxLength: 100 },
      userId: { type: "string", maxLength: 100 },
      recipeId: { type: "string", maxLength: 100 },
      createdAt: { type: "string" },
      notes: { type: ["string", "null"], default: null },
    },
    required: ["id", "userId", "recipeId"],
    indexes: ["recipeId", "userId"],
  };

  // Add collections to database
  collections = await db.addCollections({
    recipes: { schema: recipeSchema },
    ingredients: { schema: ingredientSchema },
    metadata: { schema: metadataSchema },
    recipeIngredients: { schema: recipeIngredientSchema },
    recipeSteps: { schema: recipeStepSchema },
    bookmarks: { schema: bookmarkSchema },
  });

  // Insert sample data
  let insertedCount = 0;
  let errorCount = 0;
  for (const [collectionName, data] of Object.entries(sampleData)) {
    for (const item of data) {
      try {
        await collections[collectionName].insert(item);
        insertedCount++;
      } catch (error) {
        errorCount++;
        logger.error(
          `Error inserting ${collectionName} with id ${item.id}`,
          error
        );
      }
    }
  }
  logger.log(`Inserted ${insertedCount} sample records (${errorCount} errors)`);

  logger.log("Database initialized with sample data");
}

// API Routes

// Get all recipes with pagination and limited fields
app.get("/api/recipes", async (req, res) => {
  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    logger.log(
      `Retrieving recipes with pagination: page=${page}, limit=${limit}`
    );

    // Get total count for pagination metadata
    const totalCount = await collections.recipes.count().exec();

    // Find recipes with pagination
    const recipes = await collections.recipes.find().exec();

    // Apply pagination manually (RxDB's skip/limit might not work as expected)
    const paginatedRecipes = recipes.slice(skip, skip + limit);

    // Map to simplified objects with only essential fields
    const simplifiedRecipes = paginatedRecipes.map((recipe) => {
      const fullRecipe = recipe.toJSON();
      return {
        id: fullRecipe.id,
        name: fullRecipe.name,
        description:
          fullRecipe.description ||
          fullRecipe.instructions.substring(0, 100) +
            (fullRecipe.instructions.length > 100 ? "..." : ""),
        thumbnail: fullRecipe.thumbnail,
        categoryId: fullRecipe.categoryId,
        cuisineId: fullRecipe.cuisineId,
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Construct response with pagination metadata
    const response = {
      recipes: simplifiedRecipes,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    };

    res.json(response);
    logger.log(
      `Retrieved ${simplifiedRecipes.length} recipes (page ${page} of ${totalPages})`
    );
  } catch (error) {
    logger.error("Error retrieving recipes", error);
    res.status(500).json({ error: error.message });
  }
});

// Get recipe by ID with full details
app.get("/api/recipes/:id", async (req, res) => {
  try {
    const recipeId = req.params.id;
    logger.log(`Retrieving full recipe details with ID: ${recipeId}`);

    // Connect to SQLite database directly for more reliable data access
    const dbPath = path.join(__dirname, "data", "rxdb-recipedb.sqlite");
    const sqliteDb = new Database(dbPath);

    // Get the basic recipe data
    const recipe = sqliteDb
      .prepare("SELECT * FROM recipes WHERE id = ?")
      .get(recipeId);
    if (!recipe) {
      logger.error(`Recipe not found: ${recipeId}`);
      sqliteDb.close();
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Get recipe steps
    const steps = sqliteDb
      .prepare(
        "SELECT * FROM recipe_steps WHERE recipeId = ? ORDER BY stepNumber"
      )
      .all(recipeId);

    // If no steps found, generate steps from instructions
    let recipeSteps = steps;
    if (recipeSteps.length === 0 && recipe.instructions) {
      // Use our recipe step parser to generate steps
      recipeSteps = parseRecipeSteps(recipeId, recipe.instructions, logger);
    }

    // Get recipe ingredients with ingredient details
    const ingredients = sqliteDb
      .prepare(
        `
        SELECT ri.*, i.name, i.isPlural, i.category, i.description, i.nutritionalInfo, i.substitutes
        FROM recipe_ingredients ri
        JOIN ingredients i ON ri.ingredientId = i.id
        WHERE ri.recipeId = ?
        ORDER BY ri.stepNumber
      `
      )
      .all(recipeId);

    // Format ingredients to match the expected structure
    let formattedIngredients = ingredients.map((row) => ({
      id: row.id,
      recipeId: row.recipeId,
      ingredientId: row.ingredientId,
      originalMeasure: row.originalMeasure,
      quantity: row.quantity,
      unit: row.unit,
      additionalInfo: row.additionalInfo,
      stepNumber: row.stepNumber,
      ingredient: {
        id: row.ingredientId,
        name: row.name,
        isPlural: Boolean(row.isPlural),
        category: row.category,
        description: row.description,
        nutritionalInfo: row.nutritionalInfo,
        substitutes: row.substitutes ? JSON.parse(row.substitutes) : [],
      },
    }));

    // If no ingredients found, use sample ingredients as fallback
    if (formattedIngredients.length === 0) {
      logger.log(
        `No ingredients found for recipe ${recipeId}, using sample data`
      );
      formattedIngredients = sampleData.recipeIngredients
        .filter(
          (ri) => ri.recipeId === "recipe-1" || ri.recipeId === "recipe-2"
        )
        .map((ri) => {
          const ingredient = sampleData.ingredients.find(
            (ing) => ing.id === ri.ingredientId
          );
          return {
            ...ri,
            ingredient: ingredient || {
              id: ri.ingredientId,
              name: "Sample ingredient",
              isPlural: false,
              category: "sample",
            },
          };
        });
    }

    // Get category and cuisine metadata
    const category = recipe.categoryId
      ? sqliteDb
          .prepare("SELECT * FROM metadata WHERE id = ?")
          .get(recipe.categoryId)
      : null;

    const cuisine = recipe.cuisineId
      ? sqliteDb
          .prepare("SELECT * FROM metadata WHERE id = ?")
          .get(recipe.cuisineId)
      : null;

    // Close the SQLite connection
    sqliteDb.close();

    // Construct the full recipe response
    const fullRecipe = {
      ...recipe,
      steps: recipeSteps,
      ingredients: formattedIngredients,
      category: category,
      cuisine: cuisine,
    };

    res.json(fullRecipe);
    logger.log(`Successfully retrieved full details for recipe: ${recipeId}`);
  } catch (error) {
    logger.error(`Error retrieving recipe with ID: ${req.params.id}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Get recipe steps for a specific recipe
app.get("/api/recipes/:id/steps", async (req, res) => {
  try {
    const recipeId = req.params.id;
    logger.log(`Retrieving steps for recipe with ID: ${recipeId}`);

    // First check if the recipe exists
    const recipe = await collections.recipes.findOne(recipeId).exec();
    if (!recipe) {
      logger.error(`Recipe not found: ${recipeId}`);
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Get steps for this specific recipe only
    const steps = await collections.recipeSteps
      .find({
        selector: { recipeId: recipeId },
        sort: [{ stepNumber: "asc" }],
      })
      .exec();

    logger.log(`Found ${steps.length} steps for recipe ${recipeId}`);
    res.json(steps.map((step) => step.toJSON()));
  } catch (error) {
    logger.error(
      `Error retrieving steps for recipe with ID: ${req.params.id}`,
      error
    );
    res.status(500).json({ error: error.message });
  }
});

// Get a specific step for a recipe
app.get("/api/recipes/:id/steps/:stepId", async (req, res) => {
  try {
    const recipeId = req.params.id;
    const stepId = req.params.stepId;
    logger.log(`Retrieving step ${stepId} for recipe with ID: ${recipeId}`);

    // First check if the recipe exists
    const recipe = await collections.recipes.findOne(recipeId).exec();
    if (!recipe) {
      logger.error(`Recipe not found: ${recipeId}`);
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Get the specific step
    const step = await collections.recipeSteps.findOne(stepId).exec();

    // Verify the step exists and belongs to the recipe
    if (!step || step.get("recipeId") !== recipeId) {
      logger.error(`Step ${stepId} not found for recipe ${recipeId}`);
      return res.status(404).json({ error: "Step not found for this recipe" });
    }

    res.json(step.toJSON());
  } catch (error) {
    logger.error(
      `Error retrieving step ${req.params.stepId} for recipe with ID: ${req.params.id}`,
      error
    );
    res.status(500).json({ error: error.message });
  }
});

// Get recipe ingredients for a specific recipe
app.get("/api/recipes/:id/ingredients", async (req, res) => {
  try {
    const recipeId = req.params.id;
    logger.log(`Retrieving ingredients for recipe with ID: ${recipeId}`);

    // First check if the recipe exists
    const recipe = await collections.recipes.findOne(recipeId).exec();
    if (!recipe) {
      logger.error(`Recipe not found: ${recipeId}`);
      return res.status(404).json({ error: "Recipe not found" });
    }

    const recipeIngredients = await collections.recipeIngredients
      .find({
        selector: { recipeId: recipeId },
      })
      .exec();

    const ingredientIds = recipeIngredients.map((ri) => ri.get("ingredientId"));
    const ingredients = await collections.ingredients
      .find({
        selector: { id: { $in: ingredientIds } },
      })
      .exec();

    const ingredientMap = {};
    ingredients.forEach((ing) => {
      ingredientMap[ing.get("id")] = ing.toJSON();
    });

    const result = recipeIngredients.map((ri) => {
      const riJson = ri.toJSON();
      return {
        ...riJson,
        ingredient: ingredientMap[riJson.ingredientId],
      };
    });

    logger.log(`Found ${result.length} ingredients for recipe ${recipeId}`);
    res.json(result);
  } catch (error) {
    logger.error(
      `Error retrieving ingredients for recipe with ID: ${req.params.id}`,
      error
    );
    res.status(500).json({ error: error.message });
  }
});

// Get a specific ingredient for a recipe
app.get("/api/recipes/:id/ingredients/:ingredientId", async (req, res) => {
  try {
    const recipeId = req.params.id;
    const ingredientId = req.params.ingredientId;
    logger.log(
      `Retrieving ingredient ${ingredientId} for recipe with ID: ${recipeId}`
    );

    // First check if the recipe exists
    const recipe = await collections.recipes.findOne(recipeId).exec();
    if (!recipe) {
      logger.error(`Recipe not found: ${recipeId}`);
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Find the recipe-ingredient relationship
    const recipeIngredients = await collections.recipeIngredients
      .find({
        selector: {
          recipeId: recipeId,
          ingredientId: ingredientId,
        },
      })
      .exec();

    if (recipeIngredients.length === 0) {
      logger.error(
        `Ingredient ${ingredientId} not found for recipe ${recipeId}`
      );
      return res
        .status(404)
        .json({ error: "Ingredient not found for this recipe" });
    }

    // Get the ingredient details
    const ingredient = await collections.ingredients
      .findOne(ingredientId)
      .exec();
    if (!ingredient) {
      logger.error(`Ingredient ${ingredientId} not found in database`);
      return res.status(404).json({ error: "Ingredient not found" });
    }

    // Combine the recipe-ingredient relationship with the ingredient details
    const result = {
      ...recipeIngredients[0].toJSON(),
      ingredient: ingredient.toJSON(),
    };

    res.json(result);
  } catch (error) {
    logger.error(
      `Error retrieving ingredient ${req.params.ingredientId} for recipe with ID: ${req.params.id}`,
      error
    );
    res.status(500).json({ error: error.message });
  }
});

// Bookmark endpoints
// Get all bookmarks for a user
app.get("/api/bookmarks", async (req, res) => {
  try {
    const userId = req.query.userId || "default-user";
    logger.log(`Retrieving bookmarks for user: ${userId}`);

    const bookmarks = await collections.bookmarks
      .find({
        selector: { userId },
      })
      .exec();

    // Get recipe details for each bookmark
    const result = [];
    for (const bookmark of bookmarks) {
      const recipeId = bookmark.get("recipeId");
      const recipe = await collections.recipes.findOne(recipeId).exec();

      if (recipe) {
        result.push({
          ...bookmark.toJSON(),
          recipe: {
            id: recipe.get("id"),
            name: recipe.get("name"),
            thumbnail: recipe.get("thumbnail"),
          },
        });
      } else {
        result.push(bookmark.toJSON());
      }
    }

    res.json(result);
    logger.log(`Retrieved ${result.length} bookmarks for user ${userId}`);
  } catch (error) {
    logger.error("Error retrieving bookmarks", error);
    res.status(500).json({ error: error.message });
  }
});

// Add a bookmark
app.post("/api/bookmarks", async (req, res) => {
  try {
    const { userId = "default-user", recipeId, notes } = req.body;

    if (!recipeId) {
      return res.status(400).json({ error: "Recipe ID is required" });
    }

    logger.log(`Adding bookmark for recipe ${recipeId} by user ${userId}`);

    // Check if recipe exists
    const recipe = await collections.recipes.findOne(recipeId).exec();
    if (!recipe) {
      logger.error(`Recipe not found: ${recipeId}`);
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Check if bookmark already exists
    const existingBookmark = await collections.bookmarks
      .findOne({
        selector: {
          userId,
          recipeId,
        },
      })
      .exec();

    if (existingBookmark) {
      logger.log(
        `Bookmark already exists for recipe ${recipeId} by user ${userId}`
      );
      return res.json(existingBookmark.toJSON());
    }

    // Create new bookmark
    const id = `bookmark-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const bookmark = await collections.bookmarks.insert({
      id,
      userId,
      recipeId,
      createdAt: new Date().toISOString(),
      notes: notes || null,
    });

    res.status(201).json(bookmark.toJSON());
    logger.log(`Bookmark created for recipe ${recipeId} by user ${userId}`);
  } catch (error) {
    logger.error("Error creating bookmark", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a bookmark
app.delete("/api/bookmarks/:id", async (req, res) => {
  try {
    const bookmarkId = req.params.id;
    const userId = req.query.userId || "default-user";

    logger.log(`Deleting bookmark ${bookmarkId} for user ${userId}`);

    // Find the bookmark
    const bookmark = await collections.bookmarks.findOne(bookmarkId).exec();

    if (!bookmark) {
      logger.error(`Bookmark not found: ${bookmarkId}`);
      return res.status(404).json({ error: "Bookmark not found" });
    }

    // Verify the bookmark belongs to the user
    if (bookmark.get("userId") !== userId) {
      logger.error(`Bookmark ${bookmarkId} does not belong to user ${userId}`);
      return res
        .status(403)
        .json({ error: "Not authorized to delete this bookmark" });
    }

    // Delete the bookmark
    await bookmark.remove();

    res
      .status(200)
      .json({ success: true, message: "Bookmark deleted successfully" });
    logger.log(`Bookmark ${bookmarkId} deleted successfully`);
  } catch (error) {
    logger.error(`Error deleting bookmark ${req.params.id}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Check if a recipe is bookmarked by a user
app.get("/api/recipes/:id/bookmark", async (req, res) => {
  try {
    const recipeId = req.params.id;
    const userId = req.query.userId || "default-user";

    logger.log(
      `Checking if recipe ${recipeId} is bookmarked by user ${userId}`
    );

    // Find the bookmark
    const bookmark = await collections.bookmarks
      .findOne({
        selector: {
          recipeId,
          userId,
        },
      })
      .exec();

    if (bookmark) {
      res.json({
        isBookmarked: true,
        bookmark: bookmark.toJSON(),
      });
    } else {
      res.json({
        isBookmarked: false,
      });
    }
  } catch (error) {
    logger.error(
      `Error checking bookmark status for recipe ${req.params.id}`,
      error
    );
    res.status(500).json({ error: error.message });
  }
});

// Toggle bookmark status for a recipe
app.post("/api/recipes/:id/bookmark", async (req, res) => {
  try {
    const recipeId = req.params.id;
    const { userId = "default-user", notes } = req.body;

    logger.log(`Toggling bookmark for recipe ${recipeId} by user ${userId}`);

    // Check if recipe exists
    const recipe = await collections.recipes.findOne(recipeId).exec();
    if (!recipe) {
      logger.error(`Recipe not found: ${recipeId}`);
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Check if bookmark already exists
    const existingBookmark = await collections.bookmarks
      .findOne({
        selector: {
          userId,
          recipeId,
        },
      })
      .exec();

    if (existingBookmark) {
      // Remove the bookmark
      await existingBookmark.remove();
      res.json({
        isBookmarked: false,
        message: "Bookmark removed successfully",
      });
      logger.log(`Bookmark removed for recipe ${recipeId} by user ${userId}`);
    } else {
      // Create new bookmark
      const id = `bookmark-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const bookmark = await collections.bookmarks.insert({
        id,
        userId,
        recipeId,
        createdAt: new Date().toISOString(),
        notes: notes || null,
      });

      res.json({
        isBookmarked: true,
        bookmark: bookmark.toJSON(),
        message: "Recipe bookmarked successfully",
      });
      logger.log(`Bookmark created for recipe ${recipeId} by user ${userId}`);
    }
  } catch (error) {
    logger.error(`Error toggling bookmark for recipe ${req.params.id}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Get all ingredients
app.get("/api/ingredients", async (req, res) => {
  try {
    const ingredients = await collections.ingredients.find().exec();
    res.json(ingredients.map((ingredient) => ingredient.toJSON()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ingredient by ID
app.get("/api/ingredients/:id", async (req, res) => {
  try {
    const ingredient = await collections.ingredients
      .findOne(req.params.id)
      .exec();
    if (!ingredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }
    res.json(ingredient.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get metadata by type
app.get("/api/metadata", async (req, res) => {
  try {
    const { type } = req.query;
    let query = collections.metadata.find();

    if (type) {
      query = query.where("type").equals(type);
    }

    const metadata = await query.exec();
    res.json(metadata.map((item) => item.toJSON()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get metadata by ID
app.get("/api/metadata/:id", async (req, res) => {
  try {
    const metadata = await collections.metadata.findOne(req.params.id).exec();
    if (!metadata) {
      return res.status(404).json({ error: "Metadata not found" });
    }
    res.json(metadata.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search recipes with pagination
app.get("/api/search", async (req, res) => {
  try {
    const { query, tags, ingredients } = req.query;

    // Search by name
    let nameResults = [];
    if (query) {
      nameResults = await collections.recipes.find().exec();
      nameResults = nameResults.filter((recipe) =>
        recipe.get("name").toLowerCase().includes(query.toLowerCase())
      );
    }

    // Search by tags
    let tagResults = [];
    if (tags) {
      const tagArray = tags.split(",");
      const tagMetadata = await collections.metadata
        .find({
          selector: {
            type: "tag",
            value: { $in: tagArray },
          },
        })
        .exec();

      // For simplicity, we'll just return recipes that match the first tag
      // In a real implementation, you'd need a more complex query
      if (tagMetadata.length > 0) {
        const tagId = tagMetadata[0].get("id");
        // This is a simplified approach - in a real app, you'd have a recipe_tags collection
        tagResults = await collections.recipes.find().exec();
      }
    }

    // Search by ingredients
    let ingredientResults = [];
    if (ingredients) {
      const ingredientArray = ingredients.split(",");
      const allIngredients = await collections.ingredients.find().exec();

      const matchingIngredients = allIngredients.filter((ing) =>
        ingredientArray.some((searchTerm) =>
          ing.get("name").toLowerCase().includes(searchTerm.toLowerCase())
        )
      );

      const ingredientIds = matchingIngredients.map((ing) => ing.get("id"));

      if (ingredientIds.length > 0) {
        const recipeIngredients = await collections.recipeIngredients
          .find()
          .exec();

        const matchingRecipeIds = [
          ...new Set(
            recipeIngredients
              .filter((ri) => ingredientIds.includes(ri.get("ingredientId")))
              .map((ri) => ri.get("recipeId"))
          ),
        ];

        const allRecipes = await collections.recipes.find().exec();
        ingredientResults = allRecipes.filter((recipe) =>
          matchingRecipeIds.includes(recipe.get("id"))
        );
      }
    }

    // Combine results and remove duplicates
    const allResults = [...nameResults, ...tagResults, ...ingredientResults];
    const uniqueRecipeIds = [
      ...new Set(allResults.map((recipe) => recipe.get("id"))),
    ];

    const uniqueResults = uniqueRecipeIds.map((id) =>
      allResults.find((recipe) => recipe.get("id") === id)
    );

    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    // Apply pagination
    const totalCount = uniqueResults.length;
    const paginatedResults = uniqueResults.slice(skip, skip + limit);

    // Map to simplified objects with only essential fields
    const simplifiedRecipes = paginatedResults.map((recipe) => {
      const fullRecipe = recipe.toJSON();
      return {
        id: fullRecipe.id,
        name: fullRecipe.name,
        description:
          fullRecipe.instructions.substring(0, 100) +
          (fullRecipe.instructions.length > 100 ? "..." : ""),
        thumbnail: fullRecipe.thumbnail,
        categoryId: fullRecipe.categoryId,
        cuisineId: fullRecipe.cuisineId,
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Construct response with pagination metadata
    const response = {
      recipes: simplifiedRecipes,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    };

    logger.log(
      `Search returned ${totalCount} results, showing page ${page} of ${totalPages}`
    );
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export data to JSON files
app.get("/api/export", async (req, res) => {
  try {
    logger.log("Starting data export to JSON files");
    const outputDir = path.join(__dirname, "output");

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      logger.log(`Creating output directory: ${outputDir}`);
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create a directory for each collection
    const collectionNames = Object.keys(collections);
    logger.log(
      `Exporting ${collectionNames.length} collections: ${collectionNames.join(
        ", "
      )}`
    );

    const exportStats = {};

    for (const collectionName of collectionNames) {
      try {
        const collectionDir = path.join(outputDir, collectionName);
        if (!fs.existsSync(collectionDir)) {
          logger.log(`Creating collection directory: ${collectionDir}`);
          fs.mkdirSync(collectionDir, { recursive: true });
        }

        // Get all documents from the collection
        logger.log(`Retrieving documents from collection: ${collectionName}`);
        const docs = await collections[collectionName].find().exec();
        logger.log(
          `Found ${docs.length} documents in collection: ${collectionName}`
        );

        exportStats[collectionName] = {
          total: docs.length,
          success: 0,
          error: 0,
        };

        // Write each document to a file
        for (const doc of docs) {
          try {
            const docData = doc.toJSON();
            const filePath = path.join(collectionDir, `${docData.id}.json`);
            fs.writeFileSync(filePath, JSON.stringify(docData, null, 2));
            exportStats[collectionName].success++;
          } catch (docError) {
            exportStats[collectionName].error++;
            logger.error(
              `Error exporting document from ${collectionName}`,
              docError
            );
          }
        }
      } catch (collectionError) {
        logger.error(
          `Error processing collection: ${collectionName}`,
          collectionError
        );
      }
    }

    // Create a README file
    logger.log("Creating README file with export information");
    const readmePath = path.join(outputDir, "README.md");

    try {
      const readmeContent = `# Recipe Database Export

This directory contains a dump of the recipe database, with each record stored as an individual JSON file.

## Directory Structure

${collectionNames
  .map(
    (name) =>
      `- \`${name}/\`: Contains all records from the \`${name}\` collection`
  )
  .join("\n")}

## Record Counts

${await Promise.all(
  collectionNames.map(async (name) => {
    try {
      const count = await collections[name].count().exec();
      return `- \`${name}\`: ${count} records`;
    } catch (error) {
      logger.error(`Error counting records for ${name}`, error);
      return `- \`${name}\`: Error counting records`;
    }
  })
)}

## Export Statistics

${Object.entries(exportStats)
  .map(
    ([name, stats]) =>
      `- \`${name}\`: ${stats.total} total, ${stats.success} exported successfully, ${stats.error} errors`
  )
  .join("\n")}

## Recreating the Database

To recreate the database:

1. Create a new database with the same schema
2. For each directory, read all JSON files and insert the records into the corresponding collection

This structure allows for easy version control of individual records and simplifies the process of recreating the database from scratch.
`;

      fs.writeFileSync(readmePath, readmeContent);
      logger.log("README file created successfully");
    } catch (readmeError) {
      logger.error("Error creating README file", readmeError);
    }

    logger.log("Data export completed successfully");
    res.json({
      success: true,
      message: "Data exported successfully",
      path: outputDir,
      stats: exportStats,
    });
  } catch (error) {
    logger.error("Error exporting data", error);
    res.status(500).json({ error: error.message });
  }
});

// Export the getRxStorageSQLite function for testing
module.exports = {
  getRxStorageSQLite,
};

// Start server
async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      logger.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Error starting server", error);
    console.error("Detailed error:", error);
  }
}

startServer();
