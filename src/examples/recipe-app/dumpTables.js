/**
 * dumpTables.js
 * 
 * This script dumps all tables from the RxDB SQLite database into individual JSON files.
 * Each record is saved as a separate file, allowing for easy recreation of the database
 * through a file crawler.
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
const { from, forkJoin, of } = require('rxjs');
const { mergeMap, map, tap, catchError, toArray } = require('rxjs/operators');
const RxDBRecipeAdapter = require('./rxdb-recipe-adapter');

// Configuration
const DB_FILE = path.join(__dirname, 'rxdb-recipe-database.sqlite');
const OUTPUT_DIR = path.join(__dirname, 'output', 'record-files');
const TABLES = [
  'recipes',
  'ingredients',
  'metadata',
  'recipe_ingredients',
  'recipe_metadata',
  'sources'
];

// Create the output directory structure
async function createDirectoryStructure() {
  console.log('Creating directory structure...');
  
  // Create the main output directory
  await mkdirAsync(OUTPUT_DIR, { recursive: true });
  
  // Create a directory for each table
  for (const table of TABLES) {
    await mkdirAsync(path.join(OUTPUT_DIR, table), { recursive: true });
  }
  
  // Create a directory for original instructions
  await mkdirAsync(path.join(OUTPUT_DIR, 'instructions'), { recursive: true });
  
  console.log('Directory structure created');
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
  const filePath = path.join(OUTPUT_DIR, 'instructions', `${recipeId}.txt`);
  
  await writeFileAsync(filePath, instructions);
  return filePath;
}

// Dump a table to individual files
function dumpTable(adapter, table) {
  console.log(`Dumping table: ${table}`);
  
  // Get the appropriate method to retrieve records based on the table name
  let getRecordsMethod;
  
  switch (table) {
    case 'recipes':
      getRecordsMethod = () => adapter.getAllRecipes();
      break;
    case 'ingredients':
      getRecordsMethod = () => adapter.getAllIngredients();
      break;
    case 'metadata':
      getRecordsMethod = () => adapter.collections.metadata.find().exec()
        .then(docs => docs.map(doc => doc.toJSON()));
      break;
    case 'recipe_ingredients':
      getRecordsMethod = () => adapter.collections.recipeIngredients.find().exec()
        .then(docs => docs.map(doc => doc.toJSON()));
      break;
    case 'recipe_metadata':
      getRecordsMethod = () => adapter.collections.recipeMetadata.find().exec()
        .then(docs => docs.map(doc => doc.toJSON()));
      break;
    case 'sources':
      getRecordsMethod = () => adapter.collections.sources.find().exec()
        .then(docs => docs.map(doc => doc.toJSON()));
      break;
    default:
      return of([]);
  }
  
  // Get all records and write each one to a file
  return from(getRecordsMethod()).pipe(
    mergeMap(records => from(records)),
    mergeMap(record => 
      from(writeRecordToFile(table, record)).pipe(
        map(filePath => ({ table, id: record.id, filePath })),
        // If this is a recipe, also write the original instructions to a file
        mergeMap(result => {
          if (table === 'recipes' && record.originalInstructions) {
            return from(writeInstructionsToFile(record.id, record.originalInstructions)).pipe(
              map(instructionsPath => ({ ...result, instructionsPath }))
            );
          }
          return of(result);
        })
      ),
      5 // Limit concurrency to 5 files at a time
    ),
    catchError(error => {
      console.error(`Error dumping table ${table}:`, error);
      return of({ table, error: error.message });
    }),
    toArray()
  );
}

// Main function
async function main() {
  let adapter = null;
  
  try {
    console.log('Starting database dump...');
    
    // Create directory structure
    await createDirectoryStructure();
    
    // Initialize the adapter
    adapter = new RxDBRecipeAdapter({
      filename: DB_FILE
    });
    
    await adapter.initialize();
    console.log('Adapter initialized');
    
    // Dump all tables
    const results = await forkJoin(
      TABLES.map(table => dumpTable(adapter, table))
    ).toPromise();
    
    // Flatten the results
    const flatResults = results.flat();
    
    // Count the number of files written for each table
    const tableCounts = {};
    for (const result of flatResults) {
      if (!result.error) {
        tableCounts[result.table] = (tableCounts[result.table] || 0) + 1;
      }
    }
    
    console.log('\nDump completed:');
    for (const [table, count] of Object.entries(tableCounts)) {
      console.log(`- ${table}: ${count} records`);
    }
    
    console.log(`\nAll records have been written to: ${OUTPUT_DIR}`);
    console.log('You can now recreate the database by crawling this directory structure.');
    
    // Create a README file with instructions
    const readmePath = path.join(OUTPUT_DIR, 'README.md');
    const readmeContent = `# RxDB SQLite Recipe Database Dump

This directory contains a dump of the RxDB SQLite recipe database, with each record stored as an individual JSON file.

## Directory Structure

${TABLES.map(table => `- \`${table}/\`: Contains all records from the \`${table}\` table`).join('\n')}
- \`instructions/\`: Contains the original instructions for each recipe

## Record Counts

${Object.entries(tableCounts).map(([table, count]) => `- \`${table}\`: ${count} records`).join('\n')}

## Recreating the Database

To recreate the database:

1. Create a new RxDB SQLite database
2. For each directory, read all JSON files and insert the records into the corresponding table
3. For the \`instructions/\` directory, read the text files and associate them with the corresponding recipes

Example code:

\`\`\`javascript
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const readDirAsync = promisify(fs.readdir);
const RxDBRecipeAdapter = require('./rxdb-recipe-adapter');

async function recreateDatabase() {
  // Initialize the adapter
  const adapter = new RxDBRecipeAdapter({
    filename: 'recreated-database.sqlite'
  });
  
  await adapter.initialize();
  
  // Process each table
  for (const table of ${JSON.stringify(TABLES)}) {
    const tableDir = path.join(__dirname, table);
    const files = await readDirAsync(tableDir);
    
    console.log(\`Processing \${files.length} records for table: \${table}\`);
    
    for (const file of files) {
      const filePath = path.join(tableDir, file);
      const data = JSON.parse(await readFileAsync(filePath, 'utf8'));
      
      // Insert the record into the appropriate table
      switch (table) {
        case 'recipes':
          await adapter.upsertRecipe(data);
          break;
        case 'ingredients':
          await adapter.upsertIngredient(data);
          break;
        // Add cases for other tables...
      }
    }
  }
  
  // Process original instructions
  const instructionsDir = path.join(__dirname, 'instructions');
  const instructionFiles = await readDirAsync(instructionsDir);
  
  console.log(\`Processing \${instructionFiles.length} instruction files\`);
  
  for (const file of instructionFiles) {
    const recipeId = path.basename(file, '.txt');
    const filePath = path.join(instructionsDir, file);
    const instructions = await readFileAsync(filePath, 'utf8');
    
    // Update the recipe with the original instructions
    const recipe = await adapter.getRecipeById(recipeId);
    if (recipe) {
      recipe.originalInstructions = instructions;
      await adapter.upsertRecipe(recipe);
    }
  }
  
  console.log('Database recreation completed');
}

recreateDatabase();
\`\`\`
`;
    
    await writeFileAsync(readmePath, readmeContent);
    console.log(`Created README file: ${readmePath}`);
    
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
