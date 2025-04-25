/**
 * simple-export.js
 *
 * This script demonstrates using the RxDB SQLite adapter to store and export data.
 * It uses a simplified approach that doesn't rely on RxDB's collection API.
 */
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
const { getRxStorageSQLite } = require("./lib/rxdb-adapter/sqlite-adapter");

// Configuration
const DB_FILE = path.join(__dirname, "rxdb-recipe-database.sqlite");
const OUTPUT_DIR = path.join(__dirname, "output", "rxdb-export");
const INSTRUCTIONS_DIR = path.join(__dirname, "instructions");

// Sample data for testing
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
  categories: [
    {
      id: "cat-pasta",
      name: "Pasta",
    },
    {
      id: "cat-curry",
      name: "Curry",
    },
  ],
  cuisines: [
    {
      id: "cuis-italian",
      name: "Italian",
    },
    {
      id: "cuis-indian",
      name: "Indian",
    },
  ],
  recipeIngredients: [
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
  units: [
    {
      id: "unit-g",
      name: "gram",
      abbreviation: "g",
      type: "weight",
    },
    {
      id: "unit-tbsp",
      name: "tablespoon",
      abbreviation: "tbsp",
      type: "volume",
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

// Create the output directory structure
async function createDirectoryStructure() {
  console.log("Creating directory structure...");

  // Create the main output directory
  await mkdirAsync(OUTPUT_DIR, { recursive: true });

  // Create a directory for each collection
  const collections = [
    "recipes",
    "ingredients",
    "categories",
    "cuisines",
    "recipeIngredients",
    "units",
    "sources",
  ];
  for (const collection of collections) {
    await mkdirAsync(path.join(OUTPUT_DIR, collection), { recursive: true });
  }

  // Create a directory for original instructions
  await mkdirAsync(INSTRUCTIONS_DIR, { recursive: true });

  console.log("Directory structure created");
}

// Write a record to a file
async function writeRecordToFile(collection, record) {
  const id = record.id;
  const filePath = path.join(OUTPUT_DIR, collection, `${id}.json`);

  await writeFileAsync(filePath, JSON.stringify(record, null, 2));
  return filePath;
}

// Write original instructions to a file
async function writeInstructionsToFile(recipeId, instructions) {
  const filePath = path.join(INSTRUCTIONS_DIR, `${recipeId}.txt`);

  await writeFileAsync(filePath, instructions);
  return filePath;
}

// Main function
async function main() {
  try {
    console.log("Starting RxDB SQLite export to JSON...");

    // Create the SQLite adapter
    const storage = getRxStorageSQLite({
      filename: DB_FILE,
    });

    // Create storage instances for each collection
    const databaseName = "recipedb";
    const collections = [
      "recipes",
      "ingredients",
      "categories",
      "cuisines",
      "recipeIngredients",
      "units",
      "sources",
    ];
    const storageInstances = {};

    for (const collection of collections) {
      console.log(`Creating storage instance for collection: ${collection}`);
      storageInstances[collection] = await storage.createStorageInstance({
        databaseName,
        collectionName: collection,
        schema: {
          version: 0,
          primaryKey: "id",
          type: "object",
          properties: {
            id: {
              type: "string",
            },
          },
        },
      });
    }

    // Populate the database with sample data
    console.log("Populating database with sample data...");

    for (const [collection, data] of Object.entries(sampleData)) {
      console.log(`Inserting ${data.length} records into ${collection}...`);

      // Insert the data
      await storageInstances[collection].bulkWrite(
        data.map((doc) => ({
          document: {
            ...doc,
            _rev: "1-" + Math.random().toString(36).substring(2),
            _deleted: false,
          },
        }))
      );
    }

    // Create directory for original instructions
    console.log("Creating instructions directory...");
    await mkdirAsync(INSTRUCTIONS_DIR, { recursive: true });

    // Save original instructions to files
    console.log("Saving original instructions to files...");
    for (const [recipeId, instructions] of Object.entries(
      originalInstructions
    )) {
      await writeInstructionsToFile(recipeId, instructions);
    }

    // Create directory structure for export
    await createDirectoryStructure();

    // Export data from the database to individual files
    console.log("Exporting data to individual files...");

    for (const [collection, instance] of Object.entries(storageInstances)) {
      console.log(`Exporting ${collection}...`);

      // Query all documents in the collection
      const result = await instance.query({});

      // Write each document to a file
      for (const doc of result.documents) {
        // Remove RxDB-specific properties
        const { _rev, _deleted, ...cleanDoc } = doc;
        await writeRecordToFile(collection, cleanDoc);
      }

      console.log(`Exported ${result.documents.length} ${collection}`);
    }

    // Create a README file with instructions
    const readmePath = path.join(OUTPUT_DIR, "README.md");
    const readmeContent = `# RxDB SQLite Recipe Database Export

This directory contains a dump of the RxDB SQLite recipe database, with each record stored as an individual JSON file.

## Directory Structure

${collections
  .map(
    (collection) =>
      `- \`${collection}/\`: Contains all records from the \`${collection}\` collection`
  )
  .join("\n")}
- \`../instructions/\`: Contains the original instructions for each recipe as text files

## Record Counts

${Object.entries(sampleData)
  .map(([collection, data]) => `- \`${collection}\`: ${data.length} records`)
  .join("\n")}

## Recreating the Database

To recreate the database:

1. Create a new RxDB database with the SQLite adapter
2. For each directory, read all JSON files and insert the records into the corresponding collection
3. For the \`instructions/\` directory, read the text files and associate them with the corresponding recipes

This structure allows for easy version control of individual records and simplifies the process of recreating the database from scratch.

## Example Code for Recreating the Database

\`\`\`javascript
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const readDirAsync = promisify(fs.readdir);
const { getRxStorageSQLite } = require('./lib/rxdb-adapter/sqlite-adapter');

async function recreateDatabase() {
  // Create the SQLite adapter
  const storage = getRxStorageSQLite({
    filename: 'recreated-database.sqlite'
  });

  // Create storage instances for each collection
  const databaseName = 'recipedb';
  const collections = ['recipes', 'ingredients', 'categories', 'cuisines', 'recipeIngredients', 'units', 'sources'];
  const storageInstances = {};

  for (const collection of collections) {
    console.log(\`Creating storage instance for collection: \${collection}\`);
    storageInstances[collection] = await storage.createStorageInstance({
      databaseName,
      collectionName: collection,
      schema: {
        version: 0,
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: {
            type: 'string'
          }
        }
      }
    });
  }

  // Process each collection
  for (const collection of collections) {
    const collectionDir = path.join(__dirname, collection);
    const files = await readDirAsync(collectionDir);

    console.log(\`Processing \${files.length} records for collection: \${collection}\`);

    for (const file of files) {
      const filePath = path.join(collectionDir, file);
      const data = JSON.parse(await readFileAsync(filePath, 'utf8'));

      // Insert the record into the appropriate collection
      await storageInstances[collection].bulkWrite([{
        document: {
          ...data,
          _rev: '1-' + Math.random().toString(36).substring(2),
          _deleted: false
        }
      }]);
    }
  }

  // Process original instructions
  const instructionsDir = path.join(__dirname, '..', 'instructions');
  const instructionFiles = await readDirAsync(instructionsDir);

  console.log(\`Processing \${instructionFiles.length} instruction files\`);

  for (const file of instructionFiles) {
    const recipeId = path.basename(file, '.txt');
    const filePath = path.join(instructionsDir, file);
    const instructions = await readFileAsync(filePath, 'utf8');

    // Get the recipe
    const result = await storageInstances.recipes.findDocumentsById([recipeId]);
    if (result.length > 0) {
      const recipe = result[0];

      // Update the recipe with the original instructions
      recipe.originalInstructions = instructions;

      // Save the updated recipe
      await storageInstances.recipes.bulkWrite([{
        document: {
          ...recipe,
          _rev: '1-' + Math.random().toString(36).substring(2)
        }
      }]);
    }
  }

  console.log('Database recreation completed');

  // Close all storage instances
  for (const instance of Object.values(storageInstances)) {
    await instance.close();
  }
}

recreateDatabase();
\`\`\`

This export was created using the RxDB SQLite adapter, demonstrating its ability to handle complex data structures and relationships.
`;

    await writeFileAsync(readmePath, readmeContent);
    console.log(`Created README file: ${readmePath}`);

    // Close all storage instances
    for (const instance of Object.values(storageInstances)) {
      await instance.close();
    }

    console.log("RxDB SQLite export to JSON completed successfully");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the script
main();
