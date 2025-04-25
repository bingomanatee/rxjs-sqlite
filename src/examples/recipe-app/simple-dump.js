/**
 * simple-dump.js
 * 
 * A simplified version of the dumpTables script that creates sample JSON files
 * to demonstrate the concept without relying on an actual database.
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);

// Configuration
const OUTPUT_DIR = path.join(__dirname, 'output', 'record-files');

// Sample data
const sampleData = {
  recipes: [
    {
      id: 'recipe-1',
      name: 'Spaghetti Carbonara',
      categoryId: 'cat-pasta',
      cuisineId: 'cuis-italian',
      instructions: 'Cook pasta. Mix eggs, cheese, and pepper. Combine with pasta and bacon.',
      originalInstructions: 'Cook spaghetti according to package instructions. In a bowl, whisk eggs, grated Pecorino Romano, and black pepper. Cook bacon until crispy. Drain pasta, reserving some water. Combine pasta with bacon, then quickly stir in egg mixture. Add pasta water if needed. Serve immediately.',
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
      originalInstructions: 'Heat oil in a large pan. Add onions and cook until soft. Add garlic, ginger, and curry powder. Cook for 1 minute. Add chicken pieces and cook until browned. Add coconut milk and simmer for 20 minutes. Serve with rice.',
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
  metadata: [
    {
      id: 'cat-pasta',
      type: 'category',
      value: 'pasta',
      displayName: 'Pasta'
    },
    {
      id: 'cat-curry',
      type: 'category',
      value: 'curry',
      displayName: 'Curry'
    },
    {
      id: 'cuis-italian',
      type: 'cuisine',
      value: 'italian',
      displayName: 'Italian'
    },
    {
      id: 'cuis-indian',
      type: 'cuisine',
      value: 'indian',
      displayName: 'Indian'
    },
    {
      id: 'tag-quick',
      type: 'tag',
      value: 'quick',
      displayName: 'Quick & Easy'
    },
    {
      id: 'tag-spicy',
      type: 'tag',
      value: 'spicy',
      displayName: 'Spicy'
    }
  ],
  recipe_ingredients: [
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
  recipe_metadata: [
    {
      id: 'rm-1',
      recipeId: 'recipe-1',
      metadataId: 'tag-quick'
    },
    {
      id: 'rm-2',
      recipeId: 'recipe-2',
      metadataId: 'tag-spicy'
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

// Create the output directory structure
async function createDirectoryStructure() {
  console.log('Creating directory structure...');
  
  // Create the main output directory
  await mkdirAsync(OUTPUT_DIR, { recursive: true });
  
  // Create a directory for each table
  for (const table of Object.keys(sampleData)) {
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

// Main function
async function main() {
  try {
    console.log('Starting sample data dump...');
    
    // Create directory structure
    await createDirectoryStructure();
    
    // Write sample data to files
    const results = {};
    
    for (const [table, records] of Object.entries(sampleData)) {
      console.log(`Dumping table: ${table}`);
      results[table] = [];
      
      for (const record of records) {
        const filePath = await writeRecordToFile(table, record);
        results[table].push({ id: record.id, filePath });
        
        // If this is a recipe, also write the original instructions to a file
        if (table === 'recipes' && record.originalInstructions) {
          const instructionsPath = await writeInstructionsToFile(record.id, record.originalInstructions);
          results[table][results[table].length - 1].instructionsPath = instructionsPath;
        }
      }
    }
    
    console.log('\nDump completed:');
    for (const [table, tableResults] of Object.entries(results)) {
      console.log(`- ${table}: ${tableResults.length} records`);
    }
    
    console.log(`\nAll records have been written to: ${OUTPUT_DIR}`);
    console.log('You can now recreate the database by crawling this directory structure.');
    
    // Create a README file with instructions
    const readmePath = path.join(OUTPUT_DIR, 'README.md');
    const readmeContent = `# Recipe Database Dump

This directory contains a dump of the recipe database, with each record stored as an individual JSON file.

## Directory Structure

${Object.keys(sampleData).map(table => `- \`${table}/\`: Contains all records from the \`${table}\` table`).join('\n')}
- \`instructions/\`: Contains the original instructions for each recipe

## Record Counts

${Object.entries(results).map(([table, tableResults]) => `- \`${table}\`: ${tableResults.length} records`).join('\n')}

## Recreating the Database

To recreate the database:

1. Create a new database
2. For each directory, read all JSON files and insert the records into the corresponding table
3. For the \`instructions/\` directory, read the text files and associate them with the corresponding recipes

This structure allows for easy version control of individual records and simplifies the process of recreating the database from scratch.
`;
    
    await writeFileAsync(readmePath, readmeContent);
    console.log(`Created README file: ${readmePath}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
main();
