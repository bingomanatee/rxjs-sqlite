/**
 * recreateDatabase.js
 * 
 * This script recreates the RxDB SQLite database from individual JSON files.
 * It crawls the directory structure created by dumpTables.js and inserts
 * each record into the appropriate table.
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const readDirAsync = promisify(fs.readdir);
const { from, forkJoin, of } = require('rxjs');
const { mergeMap, map, tap, catchError, toArray } = require('rxjs/operators');
const RxDBRecipeAdapter = require('./rxdb-recipe-adapter');

// Configuration
const DUMP_DIR = path.join(__dirname, 'output', 'record-files');
const DB_FILE = path.join(__dirname, 'recreated-database.sqlite');
const TABLES = [
  'recipes',
  'ingredients',
  'metadata',
  'recipe_ingredients',
  'recipe_metadata',
  'sources'
];

// Read a record from a file
async function readRecordFromFile(filePath) {
  const data = await readFileAsync(filePath, 'utf8');
  return JSON.parse(data);
}

// Read original instructions from a file
async function readInstructionsFromFile(filePath) {
  return readFileAsync(filePath, 'utf8');
}

// Process a table
function processTable(adapter, table) {
  console.log(`Processing table: ${table}`);
  
  const tableDir = path.join(DUMP_DIR, table);
  
  // Check if the directory exists
  if (!fs.existsSync(tableDir)) {
    console.warn(`Directory not found: ${tableDir}`);
    return of([]);
  }
  
  // Get all files in the directory
  return from(readDirAsync(tableDir)).pipe(
    mergeMap(files => from(files)),
    mergeMap(file => {
      const filePath = path.join(tableDir, file);
      
      return from(readRecordFromFile(filePath)).pipe(
        mergeMap(record => {
          // Insert the record into the appropriate table
          switch (table) {
            case 'recipes':
              return from(adapter.upsertRecipe(record));
            case 'ingredients':
              return from(adapter.upsertIngredient(record));
            case 'metadata':
              return from(adapter.collections.metadata.upsert(record));
            case 'recipe_ingredients':
              return from(adapter.upsertRecipeIngredient(record));
            case 'recipe_metadata':
              return from(adapter.collections.recipeMetadata.upsert(record));
            case 'sources':
              return from(adapter.upsertSource(record));
            default:
              return of(null);
          }
        }),
        map(() => ({ table, file })),
        catchError(error => {
          console.error(`Error processing file ${filePath}:`, error);
          return of({ table, file, error: error.message });
        })
      );
    }, 5), // Limit concurrency to 5 files at a time
    toArray()
  );
}

// Process original instructions
function processInstructions(adapter) {
  console.log('Processing original instructions...');
  
  const instructionsDir = path.join(DUMP_DIR, 'instructions');
  
  // Check if the directory exists
  if (!fs.existsSync(instructionsDir)) {
    console.warn(`Directory not found: ${instructionsDir}`);
    return of([]);
  }
  
  // Get all files in the directory
  return from(readDirAsync(instructionsDir)).pipe(
    mergeMap(files => from(files)),
    mergeMap(file => {
      const filePath = path.join(instructionsDir, file);
      const recipeId = path.basename(file, '.txt');
      
      return from(readInstructionsFromFile(filePath)).pipe(
        mergeMap(instructions => {
          // Get the recipe
          return from(adapter.getRecipeById(recipeId)).pipe(
            mergeMap(recipe => {
              if (!recipe) {
                console.warn(`Recipe not found: ${recipeId}`);
                return of(null);
              }
              
              // Update the recipe with the original instructions
              recipe.originalInstructions = instructions;
              return from(adapter.upsertRecipe(recipe));
            })
          );
        }),
        map(() => ({ type: 'instructions', file })),
        catchError(error => {
          console.error(`Error processing instructions file ${filePath}:`, error);
          return of({ type: 'instructions', file, error: error.message });
        })
      );
    }, 5), // Limit concurrency to 5 files at a time
    toArray()
  );
}

// Main function
async function main() {
  let adapter = null;
  
  try {
    console.log('Starting database recreation...');
    
    // Initialize the adapter
    adapter = new RxDBRecipeAdapter({
      filename: DB_FILE
    });
    
    await adapter.initialize();
    console.log('Adapter initialized');
    
    // Process all tables
    const tableResults = await forkJoin(
      TABLES.map(table => processTable(adapter, table))
    ).toPromise();
    
    // Process original instructions
    const instructionsResults = await processInstructions(adapter).toPromise();
    
    // Flatten the results
    const flatTableResults = tableResults.flat();
    
    // Count the number of files processed for each table
    const tableCounts = {};
    for (const result of flatTableResults) {
      if (!result.error) {
        tableCounts[result.table] = (tableCounts[result.table] || 0) + 1;
      }
    }
    
    console.log('\nDatabase recreation completed:');
    for (const [table, count] of Object.entries(tableCounts)) {
      console.log(`- ${table}: ${count} records`);
    }
    console.log(`- instructions: ${instructionsResults.filter(r => !r.error).length} files`);
    
    console.log(`\nDatabase has been recreated at: ${DB_FILE}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the adapter
    if (adapter) {
      await adapter.close();
    }
  }
}

// Run the script
main();
