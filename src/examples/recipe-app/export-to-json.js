/**
 * export-to-json.js
 * 
 * This script exports data from the RxDB SQLite database to individual JSON files.
 * It demonstrates the RxDB SQLite adapter in action.
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
const { from, forkJoin } = require('rxjs');
const { mergeMap, toArray } = require('rxjs/operators');
const RxDBRecipeAdapter = require('./rxdb-recipe-adapter');

// Configuration
const DB_FILE = path.join(__dirname, 'rxdb-recipe-database.sqlite');
const OUTPUT_DIR = path.join(__dirname, 'output', 'rxdb-export');
const INSTRUCTIONS_DIR = path.join(__dirname, 'instructions');

// Sample data for testing
const sampleData = {
  recipes: [
    {
      id: 'recipe-1',
      name: 'Spaghetti Carbonara',
      categoryId: 'cat-pasta',
      cuisineId: 'cuis-italian',
      instructions: 'Cook pasta. Mix eggs, cheese, and pepper. Combine with pasta and bacon.',
      thumbnail: 'https://example.com/carbonara.jpg',
      createdAt: '2023-01-01T12:00:00Z',
      updatedAt: '2023-01-01T12:00:00Z'
    },
    {
      id: 'recipe-2',
      name: 'Chicken Curry',
      categoryId: 'cat-curry',
      cuisineId: 'cuis-indian',
      instructions: 'Cook chicken with curry sauce and serve with rice.',
      thumbnail: 'https://example.com/curry.jpg',
      createdAt: '2023-01-02T12:00:00Z',
      updatedAt: '2023-01-02T12:00:00Z'
    }
  ],
  ingredients: [
    {
      id: 'ing-1',
      name: 'spaghetti',
      isPlural: true,
      category: 'pasta'
    },
    {
      id: 'ing-2',
      name: 'egg',
      isPlural: false,
      category: 'dairy'
    },
    {
      id: 'ing-3',
      name: 'bacon',
      isPlural: false,
      category: 'meat'
    },
    {
      id: 'ing-4',
      name: 'chicken',
      isPlural: false,
      category: 'meat'
    },
    {
      id: 'ing-5',
      name: 'curry powder',
      isPlural: false,
      category: 'spice'
    }
  ],
  categories: [
    {
      id: 'cat-pasta',
      name: 'Pasta'
    },
    {
      id: 'cat-curry',
      name: 'Curry'
    }
  ],
  cuisines: [
    {
      id: 'cuis-italian',
      name: 'Italian'
    },
    {
      id: 'cuis-indian',
      name: 'Indian'
    }
  ],
  recipeIngredients: [
    {
      id: 'ri-1',
      recipeId: 'recipe-1',
      ingredientId: 'ing-1',
      originalMeasure: '200g',
      quantity: 200,
      unit: 'g',
      additionalInfo: null
    },
    {
      id: 'ri-2',
      recipeId: 'recipe-1',
      ingredientId: 'ing-2',
      originalMeasure: '2',
      quantity: 2,
      unit: null,
      additionalInfo: null
    },
    {
      id: 'ri-3',
      recipeId: 'recipe-1',
      ingredientId: 'ing-3',
      originalMeasure: '100g',
      quantity: 100,
      unit: 'g',
      additionalInfo: 'diced'
    },
    {
      id: 'ri-4',
      recipeId: 'recipe-2',
      ingredientId: 'ing-4',
      originalMeasure: '500g',
      quantity: 500,
      unit: 'g',
      additionalInfo: 'diced'
    },
    {
      id: 'ri-5',
      recipeId: 'recipe-2',
      ingredientId: 'ing-5',
      originalMeasure: '2 tbsp',
      quantity: 2,
      unit: 'tbsp',
      additionalInfo: null
    }
  ],
  units: [
    {
      id: 'unit-g',
      name: 'gram',
      abbreviation: 'g',
      type: 'weight'
    },
    {
      id: 'unit-tbsp',
      name: 'tablespoon',
      abbreviation: 'tbsp',
      type: 'volume'
    }
  ],
  sources: [
    {
      id: 'src-1',
      recipeId: 'recipe-1',
      url: 'https://example.com/carbonara',
      type: 'website',
      platform: null,
      domain: 'example.com',
      description: 'Classic Carbonara Recipe'
    },
    {
      id: 'src-2',
      recipeId: 'recipe-2',
      url: 'https://example.com/curry',
      type: 'website',
      platform: null,
      domain: 'example.com',
      description: 'Easy Chicken Curry'
    }
  ]
};

// Original instructions for recipes
const originalInstructions = {
  'recipe-1': 'Cook spaghetti according to package instructions. In a bowl, whisk eggs, grated Pecorino Romano, and black pepper. Cook bacon until crispy. Drain pasta, reserving some water. Combine pasta with bacon, then quickly stir in egg mixture. Add pasta water if needed. Serve immediately.',
  'recipe-2': 'Heat oil in a large pan. Add onions and cook until soft. Add garlic, ginger, and curry powder. Cook for 1 minute. Add chicken pieces and cook until browned. Add coconut milk and simmer for 20 minutes. Serve with rice.'
};

// Create the output directory structure
async function createDirectoryStructure() {
  console.log('Creating directory structure...');
  
  // Create the main output directory
  await mkdirAsync(OUTPUT_DIR, { recursive: true });
  
  // Create a directory for each collection
  const collections = ['recipes', 'ingredients', 'categories', 'cuisines', 'recipeIngredients', 'units', 'sources'];
  for (const collection of collections) {
    await mkdirAsync(path.join(OUTPUT_DIR, collection), { recursive: true });
  }
  
  // Create a directory for original instructions
  await mkdirAsync(INSTRUCTIONS_DIR, { recursive: true });
  
  console.log('Directory structure created');
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

// Populate the database with sample data
async function populateDatabase(adapter) {
  console.log('Populating database with sample data...');
  
  // Insert categories
  console.log('Inserting categories...');
  for (const category of sampleData.categories) {
    await adapter.collections.categories.insert(category);
  }
  console.log(`Inserted ${sampleData.categories.length} categories`);
  
  // Insert cuisines
  console.log('Inserting cuisines...');
  for (const cuisine of sampleData.cuisines) {
    await adapter.collections.cuisines.insert(cuisine);
  }
  console.log(`Inserted ${sampleData.cuisines.length} cuisines`);
  
  // Insert ingredients
  console.log('Inserting ingredients...');
  for (const ingredient of sampleData.ingredients) {
    await adapter.collections.ingredients.insert(ingredient);
  }
  console.log(`Inserted ${sampleData.ingredients.length} ingredients`);
  
  // Insert units
  console.log('Inserting units...');
  for (const unit of sampleData.units) {
    await adapter.collections.units.insert(unit);
  }
  console.log(`Inserted ${sampleData.units.length} units`);
  
  // Insert recipes
  console.log('Inserting recipes...');
  for (const recipe of sampleData.recipes) {
    await adapter.collections.recipes.insert(recipe);
    
    // Save original instructions to a file
    if (originalInstructions[recipe.id]) {
      await writeInstructionsToFile(recipe.id, originalInstructions[recipe.id]);
    }
  }
  console.log(`Inserted ${sampleData.recipes.length} recipes`);
  
  // Insert recipe ingredients
  console.log('Inserting recipe ingredients...');
  for (const recipeIngredient of sampleData.recipeIngredients) {
    await adapter.collections.recipeIngredients.insert(recipeIngredient);
  }
  console.log(`Inserted ${sampleData.recipeIngredients.length} recipe ingredients`);
  
  // Insert sources
  console.log('Inserting sources...');
  for (const source of sampleData.sources) {
    await adapter.collections.sources.insert(source);
  }
  console.log(`Inserted ${sampleData.sources.length} sources`);
  
  console.log('Database population completed');
}

// Export data from the database to individual files
async function exportData(adapter) {
  console.log('Exporting data to individual files...');
  
  // Create directory structure
  await createDirectoryStructure();
  
  // Export recipes
  console.log('Exporting recipes...');
  const recipes = await adapter.collections.recipes.find().exec();
  for (const recipe of recipes) {
    const recipeData = recipe.toJSON();
    await writeRecordToFile('recipes', recipeData);
  }
  console.log(`Exported ${recipes.length} recipes`);
  
  // Export ingredients
  console.log('Exporting ingredients...');
  const ingredients = await adapter.collections.ingredients.find().exec();
  for (const ingredient of ingredients) {
    const ingredientData = ingredient.toJSON();
    await writeRecordToFile('ingredients', ingredientData);
  }
  console.log(`Exported ${ingredients.length} ingredients`);
  
  // Export categories
  console.log('Exporting categories...');
  const categories = await adapter.collections.categories.find().exec();
  for (const category of categories) {
    const categoryData = category.toJSON();
    await writeRecordToFile('categories', categoryData);
  }
  console.log(`Exported ${categories.length} categories`);
  
  // Export cuisines
  console.log('Exporting cuisines...');
  const cuisines = await adapter.collections.cuisines.find().exec();
  for (const cuisine of cuisines) {
    const cuisineData = cuisine.toJSON();
    await writeRecordToFile('cuisines', cuisineData);
  }
  console.log(`Exported ${cuisines.length} cuisines`);
  
  // Export recipe ingredients
  console.log('Exporting recipe ingredients...');
  const recipeIngredients = await adapter.collections.recipeIngredients.find().exec();
  for (const recipeIngredient of recipeIngredients) {
    const recipeIngredientData = recipeIngredient.toJSON();
    await writeRecordToFile('recipeIngredients', recipeIngredientData);
  }
  console.log(`Exported ${recipeIngredients.length} recipe ingredients`);
  
  // Export units
  console.log('Exporting units...');
  const units = await adapter.collections.units.find().exec();
  for (const unit of units) {
    const unitData = unit.toJSON();
    await writeRecordToFile('units', unitData);
  }
  console.log(`Exported ${units.length} units`);
  
  // Export sources
  console.log('Exporting sources...');
  const sources = await adapter.collections.sources.find().exec();
  for (const source of sources) {
    const sourceData = source.toJSON();
    await writeRecordToFile('sources', sourceData);
  }
  console.log(`Exported ${sources.length} sources`);
  
  console.log('Data export completed');
  
  // Create a README file with instructions
  const readmePath = path.join(OUTPUT_DIR, 'README.md');
  const readmeContent = `# RxDB SQLite Recipe Database Export

This directory contains a dump of the RxDB SQLite recipe database, with each record stored as an individual JSON file.

## Directory Structure

- \`recipes/\`: Contains all records from the \`recipes\` collection
- \`ingredients/\`: Contains all records from the \`ingredients\` collection
- \`categories/\`: Contains all records from the \`categories\` collection
- \`cuisines/\`: Contains all records from the \`cuisines\` collection
- \`recipeIngredients/\`: Contains all records from the \`recipeIngredients\` collection
- \`units/\`: Contains all records from the \`units\` collection
- \`sources/\`: Contains all records from the \`sources\` collection
- \`../instructions/\`: Contains the original instructions for each recipe as text files

## Record Counts

- \`recipes\`: ${recipes.length} records
- \`ingredients\`: ${ingredients.length} records
- \`categories\`: ${categories.length} records
- \`cuisines\`: ${cuisines.length} records
- \`recipeIngredients\`: ${recipeIngredients.length} records
- \`units\`: ${units.length} records
- \`sources\`: ${sources.length} records

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
const RxDBRecipeAdapter = require('./rxdb-recipe-adapter');

async function recreateDatabase() {
  // Initialize the adapter
  const adapter = new RxDBRecipeAdapter({
    filename: 'recreated-database.sqlite'
  });
  
  await adapter.initialize();
  
  // Process each collection
  const collections = ['recipes', 'ingredients', 'categories', 'cuisines', 'recipeIngredients', 'units', 'sources'];
  
  for (const collection of collections) {
    const collectionDir = path.join(__dirname, collection);
    const files = await readDirAsync(collectionDir);
    
    console.log(\`Processing \${files.length} records for collection: \${collection}\`);
    
    for (const file of files) {
      const filePath = path.join(collectionDir, file);
      const data = JSON.parse(await readFileAsync(filePath, 'utf8'));
      
      // Insert the record into the appropriate collection
      await adapter.collections[collection].insert(data);
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
    
    // Update the recipe with the original instructions
    const recipe = await adapter.collections.recipes.findOne(recipeId).exec();
    if (recipe) {
      await recipe.update({
        $set: { originalInstructions: instructions }
      });
    }
  }
  
  console.log('Database recreation completed');
}

recreateDatabase();
\`\`\`

This export was created using the RxDB SQLite adapter, demonstrating its ability to handle complex data structures and relationships.
`;
  
  await writeFileAsync(readmePath, readmeContent);
  console.log(`Created README file: ${readmePath}`);
}

// Main function
async function main() {
  let adapter = null;
  
  try {
    console.log('Starting RxDB SQLite export to JSON...');
    
    // Initialize the adapter
    adapter = new RxDBRecipeAdapter({
      filename: DB_FILE
    });
    
    await adapter.initialize();
    console.log('Adapter initialized');
    
    // Populate the database with sample data
    await populateDatabase(adapter);
    
    // Export data to individual files
    await exportData(adapter);
    
    console.log('RxDB SQLite export to JSON completed successfully');
    
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
