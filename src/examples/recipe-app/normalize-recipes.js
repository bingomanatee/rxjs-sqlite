/**
 * Script to normalize recipe data into a relational structure using RxDB with SQLite adapter
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const crypto = require('crypto');

// Function to generate a short ID from a string
function generateShortId(str) {
  // Create a hash of the string
  const hash = crypto.createHash('md5').update(str.toLowerCase()).digest('hex');
  // Return the first 8 characters of the hash
  return hash.substring(0, 8);
}

// Function to determine if an ingredient name is typically used in plural form
function isTypicallyPlural(name) {
  const pluralEndings = ['s', 'es', 'ies'];
  const pluralWords = [
    'peas', 'beans', 'lentils', 'noodles', 'sprouts', 'greens', 'herbs',
    'spices', 'nuts', 'seeds', 'oats', 'flakes', 'crumbs', 'chips'
  ];
  
  // Check if the name ends with a plural ending
  const endsWithPlural = pluralEndings.some(ending => 
    name.toLowerCase().endsWith(ending)
  );
  
  // Check if the name is in the list of plural words
  const isInPluralList = pluralWords.some(word => 
    name.toLowerCase().includes(word)
  );
  
  return endsWithPlural || isInPluralList;
}

// Function to categorize ingredients
function categorizeIngredient(name) {
  const lowerName = name.toLowerCase();
  
  // Define categories and their keywords
  const categories = {
    'meat': ['beef', 'chicken', 'pork', 'lamb', 'steak', 'bacon', 'sausage', 'ham', 'turkey', 'veal', 'duck'],
    'seafood': ['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'crab', 'lobster', 'mussel', 'clam', 'oyster', 'squid'],
    'dairy': ['milk', 'cheese', 'cream', 'butter', 'yogurt', 'yoghurt', 'curd', 'fromage', 'ghee'],
    'vegetable': ['onion', 'garlic', 'tomato', 'potato', 'carrot', 'pepper', 'lettuce', 'spinach', 'broccoli', 'cabbage', 'cucumber', 'eggplant', 'aubergine', 'zucchini', 'courgette', 'pea', 'bean', 'corn', 'maize'],
    'fruit': ['apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'strawberry', 'berry', 'pineapple', 'mango', 'peach', 'pear', 'plum', 'cherry', 'watermelon', 'melon', 'kiwi', 'avocado'],
    'grain': ['rice', 'pasta', 'noodle', 'bread', 'flour', 'oat', 'cereal', 'wheat', 'barley', 'corn', 'quinoa', 'couscous'],
    'herb': ['basil', 'parsley', 'cilantro', 'coriander', 'mint', 'thyme', 'rosemary', 'sage', 'oregano', 'dill', 'chive'],
    'spice': ['pepper', 'salt', 'cumin', 'cinnamon', 'nutmeg', 'paprika', 'turmeric', 'curry', 'chilli', 'chili', 'cayenne', 'ginger', 'clove', 'cardamom', 'saffron'],
    'nut': ['almond', 'peanut', 'walnut', 'cashew', 'pistachio', 'pecan', 'hazelnut', 'nut'],
    'oil': ['oil', 'olive', 'vegetable', 'canola', 'sunflower', 'sesame', 'coconut'],
    'sweetener': ['sugar', 'honey', 'syrup', 'molasses', 'agave', 'stevia', 'sweetener'],
    'sauce': ['sauce', 'ketchup', 'mayonnaise', 'mustard', 'vinegar', 'soy', 'teriyaki', 'salsa', 'dressing'],
    'beverage': ['water', 'juice', 'wine', 'beer', 'coffee', 'tea', 'milk', 'soda', 'drink'],
    'other': []
  };
  
  // Check each category
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerName.includes(keyword))) {
      return category;
    }
  }
  
  // Default category
  return 'other';
}

// Function to normalize recipe data
async function normalizeRecipeData() {
  try {
    // Load recipes
    const filePath = path.join(__dirname, 'output', 'recipes.json');
    const data = await readFileAsync(filePath, 'utf8');
    const recipes = JSON.parse(data);
    
    console.log(`Loaded ${recipes.length} recipes`);
    
    // Extract unique ingredients
    const ingredientMap = new Map();
    recipes.forEach(recipe => {
      recipe.ingredients.forEach(ingredient => {
        const name = ingredient.name.trim();
        const lowerName = name.toLowerCase();
        
        if (!ingredientMap.has(lowerName)) {
          const id = generateShortId(lowerName);
          ingredientMap.set(lowerName, {
            id,
            name,
            isPlural: isTypicallyPlural(name),
            category: categorizeIngredient(name)
          });
        }
      });
    });
    
    const ingredients = Array.from(ingredientMap.values());
    console.log(`Extracted ${ingredients.length} unique ingredients`);
    
    // Extract unique categories
    const categoryMap = new Map();
    recipes.forEach(recipe => {
      const category = recipe.category;
      if (!categoryMap.has(category)) {
        const id = generateShortId(category);
        categoryMap.set(category, {
          id,
          name: category
        });
      }
    });
    
    const categories = Array.from(categoryMap.values());
    console.log(`Extracted ${categories.length} unique categories`);
    
    // Extract unique cuisines (areas)
    const cuisineMap = new Map();
    recipes.forEach(recipe => {
      const cuisine = recipe.area;
      if (!cuisineMap.has(cuisine)) {
        const id = generateShortId(cuisine);
        cuisineMap.set(cuisine, {
          id,
          name: cuisine
        });
      }
    });
    
    const cuisines = Array.from(cuisineMap.values());
    console.log(`Extracted ${cuisines.length} unique cuisines`);
    
    // Create recipe ingredients junction table
    const recipeIngredients = [];
    recipes.forEach(recipe => {
      recipe.ingredients.forEach(ingredient => {
        const name = ingredient.name.trim();
        const lowerName = name.toLowerCase();
        const ingredientId = ingredientMap.get(lowerName).id;
        
        recipeIngredients.push({
          id: `${recipe.id}_${ingredientId}`,
          recipeId: recipe.id,
          ingredientId,
          measure: ingredient.measure
        });
      });
    });
    
    console.log(`Created ${recipeIngredients.length} recipe-ingredient relationships`);
    
    // Normalize recipes
    const normalizedRecipes = recipes.map(recipe => {
      return {
        id: recipe.id,
        name: recipe.name,
        categoryId: categoryMap.get(recipe.category).id,
        cuisineId: cuisineMap.get(recipe.area).id,
        instructions: recipe.instructions,
        thumbnail: recipe.thumbnail,
        tags: recipe.tags,
        youtube: recipe.youtube,
        source: recipe.source
      };
    });
    
    console.log(`Normalized ${normalizedRecipes.length} recipes`);
    
    // Create normalized data structure
    const normalizedData = {
      recipes: normalizedRecipes,
      ingredients,
      categories,
      cuisines,
      recipeIngredients
    };
    
    // Save normalized data
    const outputDir = path.join(__dirname, 'output', 'normalized');
    await mkdirAsync(outputDir, { recursive: true });
    
    await writeFileAsync(
      path.join(outputDir, 'normalized-data.json'),
      JSON.stringify(normalizedData, null, 2)
    );
    
    console.log(`Saved normalized data to ${path.join(outputDir, 'normalized-data.json')}`);
    
    // Save individual tables
    await writeFileAsync(
      path.join(outputDir, 'recipes.json'),
      JSON.stringify(normalizedRecipes, null, 2)
    );
    
    await writeFileAsync(
      path.join(outputDir, 'ingredients.json'),
      JSON.stringify(ingredients, null, 2)
    );
    
    await writeFileAsync(
      path.join(outputDir, 'categories.json'),
      JSON.stringify(categories, null, 2)
    );
    
    await writeFileAsync(
      path.join(outputDir, 'cuisines.json'),
      JSON.stringify(cuisines, null, 2)
    );
    
    await writeFileAsync(
      path.join(outputDir, 'recipe-ingredients.json'),
      JSON.stringify(recipeIngredients, null, 2)
    );
    
    console.log('Saved individual tables');
    
    return normalizedData;
  } catch (error) {
    console.error('Error normalizing recipe data:', error);
    throw error;
  }
}

// Function to replace ingredient names with IDs in instructions
async function processInstructions(normalizedData) {
  try {
    const { recipes, ingredients, recipeIngredients } = normalizedData;
    
    console.log('Processing recipe instructions...');
    
    // Create a map of ingredient IDs to ingredients
    const ingredientMap = new Map();
    ingredients.forEach(ingredient => {
      ingredientMap.set(ingredient.id, ingredient);
    });
    
    // Create a map of recipe IDs to their ingredients
    const recipeIngredientsMap = new Map();
    recipeIngredients.forEach(ri => {
      if (!recipeIngredientsMap.has(ri.recipeId)) {
        recipeIngredientsMap.set(ri.recipeId, []);
      }
      recipeIngredientsMap.get(ri.recipeId).push({
        ...ri,
        ingredient: ingredientMap.get(ri.ingredientId)
      });
    });
    
    // Process each recipe
    const processedRecipes = recipes.map(recipe => {
      // Get the recipe's ingredients
      const recipeIngs = recipeIngredientsMap.get(recipe.id) || [];
      
      // Sort ingredients by name length (longest first) to avoid partial matches
      const sortedIngredients = [...recipeIngs].sort((a, b) => 
        b.ingredient.name.length - a.ingredient.name.length
      );
      
      // Store the original instructions
      const originalInstructions = recipe.instructions;
      let processedInstructions = originalInstructions;
      
      // Replace ingredient names with references
      sortedIngredients.forEach(ri => {
        const ingredient = ri.ingredient;
        const name = ingredient.name;
        
        // Create a regex that matches the ingredient name as a whole word
        const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi');
        
        // Replace with a reference
        processedInstructions = processedInstructions.replace(regex, 
          `[INGREDIENT:${ingredient.id}:${ingredient.isPlural ? 'plural' : 'singular'}]`
        );
      });
      
      return {
        ...recipe,
        originalInstructions,
        instructions: processedInstructions
      };
    });
    
    console.log(`Processed instructions for ${processedRecipes.length} recipes`);
    
    // Save processed recipes
    await writeFileAsync(
      path.join(__dirname, 'output', 'normalized', 'processed-recipes.json'),
      JSON.stringify(processedRecipes, null, 2)
    );
    
    console.log('Saved processed recipes');
    
    return {
      ...normalizedData,
      recipes: processedRecipes
    };
  } catch (error) {
    console.error('Error processing instructions:', error);
    throw error;
  }
}

// Helper function to escape special characters in regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Main function
async function main() {
  try {
    // Normalize recipe data
    const normalizedData = await normalizeRecipeData();
    
    // Process instructions
    await processInstructions(normalizedData);
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
main();
