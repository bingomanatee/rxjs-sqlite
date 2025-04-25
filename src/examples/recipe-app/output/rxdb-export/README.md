# RxDB SQLite Recipe Database Export

This directory contains a dump of the RxDB SQLite recipe database, with each record stored as an individual JSON file.

## Directory Structure

- `recipes/`: Contains all records from the `recipes` collection
- `ingredients/`: Contains all records from the `ingredients` collection
- `categories/`: Contains all records from the `categories` collection
- `cuisines/`: Contains all records from the `cuisines` collection
- `recipeIngredients/`: Contains all records from the `recipeIngredients` collection
- `units/`: Contains all records from the `units` collection
- `sources/`: Contains all records from the `sources` collection
- `../instructions/`: Contains the original instructions for each recipe as text files

## Record Counts

- `recipes`: 2 records
- `ingredients`: 5 records
- `categories`: 2 records
- `cuisines`: 2 records
- `recipeIngredients`: 5 records
- `units`: 2 records
- `sources`: 2 records

## Recreating the Database

To recreate the database:

1. Create a new RxDB database with the SQLite adapter
2. For each directory, read all JSON files and insert the records into the corresponding collection
3. For the `instructions/` directory, read the text files and associate them with the corresponding recipes

This structure allows for easy version control of individual records and simplifies the process of recreating the database from scratch.

## Example Code for Recreating the Database

```javascript
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
    console.log(`Creating storage instance for collection: ${collection}`);
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

    console.log(`Processing ${files.length} records for collection: ${collection}`);

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

  console.log(`Processing ${instructionFiles.length} instruction files`);

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
```

This export was created using the RxDB SQLite adapter, demonstrating its ability to handle complex data structures and relationships.
