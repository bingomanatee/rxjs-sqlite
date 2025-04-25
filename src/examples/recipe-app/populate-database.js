/**
 * populate-database.js
 * 
 * This script populates the RxDB SQLite database with sample data
 * for testing the export functionality.
 */
const RxDBRecipeAdapter = require('./rxdb-recipe-adapter');
const path = require('path');
const fs = require('fs');

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

// Save original instructions to files
async function saveOriginalInstructions(recipe) {
  const instructionsDir = path.join(__dirname, 'instructions');
  
  // Create the instructions directory if it doesn't exist
  if (!fs.existsSync(instructionsDir)) {
    fs.mkdirSync(instructionsDir, { recursive: true });
  }
  
  // Save the original instructions to a file
  const filePath = path.join(instructionsDir, `${recipe.id}.txt`);
  fs.writeFileSync(filePath, recipe.originalInstructions);
  
  console.log(`Saved original instructions for recipe ${recipe.id} to ${filePath}`);
}

// Main function
async function main() {
  let adapter = null;
  
  try {
    console.log('Populating database with sample data...');
    
    // Initialize the adapter
    adapter = new RxDBRecipeAdapter({
      filename: path.join(__dirname, 'rxdb-recipe-database.sqlite')
    });
    
    await adapter.initialize();
    console.log('Adapter initialized');
    
    // Insert metadata
    console.log('Inserting metadata...');
    for (const metadata of sampleData.metadata) {
      await adapter.collections.metadata.insert(metadata);
    }
    console.log(`Inserted ${sampleData.metadata.length} metadata records`);
    
    // Insert ingredients
    console.log('Inserting ingredients...');
    for (const ingredient of sampleData.ingredients) {
      await adapter.upsertIngredient(ingredient);
    }
    console.log(`Inserted ${sampleData.ingredients.length} ingredients`);
    
    // Insert recipes
    console.log('Inserting recipes...');
    for (const recipe of sampleData.recipes) {
      await adapter.upsertRecipe(recipe);
      await saveOriginalInstructions(recipe);
    }
    console.log(`Inserted ${sampleData.recipes.length} recipes`);
    
    // Insert recipe ingredients
    console.log('Inserting recipe ingredients...');
    for (const recipeIngredient of sampleData.recipe_ingredients) {
      await adapter.upsertRecipeIngredient(recipeIngredient);
    }
    console.log(`Inserted ${sampleData.recipe_ingredients.length} recipe ingredients`);
    
    // Insert recipe metadata
    console.log('Inserting recipe metadata...');
    for (const recipeMetadata of sampleData.recipe_metadata) {
      await adapter.collections.recipeMetadata.insert(recipeMetadata);
    }
    console.log(`Inserted ${sampleData.recipe_metadata.length} recipe metadata records`);
    
    // Insert sources
    console.log('Inserting sources...');
    for (const source of sampleData.sources) {
      await adapter.collections.sources.insert(source);
    }
    console.log(`Inserted ${sampleData.sources.length} sources`);
    
    console.log('Database population completed successfully');
    
  } catch (error) {
    console.error('Error populating database:', error);
  } finally {
    // Close the adapter
    if (adapter) {
      await adapter.close();
    }
  }
}

// Run the script
main();
