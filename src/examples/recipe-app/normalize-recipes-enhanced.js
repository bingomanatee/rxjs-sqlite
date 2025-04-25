/**
 * Enhanced script to normalize recipe data into a relational structure with:
 * - Detailed ingredient measurements (quantity and unit)
 * - Source table for videos, websites, etc.
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

// Function to parse a measurement string into quantity and unit
function parseMeasurement(measureStr) {
  if (!measureStr || measureStr.trim() === '') {
    return { quantity: null, unit: null };
  }
  
  // Common units
  const units = [
    'cup', 'cups', 'tbsp', 'tsp', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons',
    'g', 'kg', 'gram', 'grams', 'kilogram', 'kilograms',
    'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
    'ml', 'l', 'milliliter', 'milliliters', 'liter', 'liters',
    'pinch', 'pinches', 'dash', 'dashes',
    'slice', 'slices', 'piece', 'pieces', 'clove', 'cloves',
    'can', 'cans', 'jar', 'jars', 'package', 'packages',
    'bunch', 'bunches', 'sprig', 'sprigs', 'stalk', 'stalks'
  ];
  
  // Regex to match quantity and unit
  // This handles fractions like 1/2, decimals like 0.5, and mixed numbers like 1 1/2
  const regex = new RegExp(
    `^\\s*(\\d+(?:\\s+\\d+)?(?:/\\d+)?|\\d+\\.\\d+)?\\s*(${units.join('|')})?\\s*(.*)$`,
    'i'
  );
  
  const match = measureStr.match(regex);
  
  if (match) {
    let [, quantity, unit, remainder] = match;
    
    // Parse the quantity
    if (quantity) {
      // Handle fractions
      if (quantity.includes('/')) {
        const fractionParts = quantity.split('/');
        quantity = parseFloat(fractionParts[0]) / parseFloat(fractionParts[1]);
      } 
      // Handle mixed numbers (e.g., "1 1/2")
      else if (quantity.includes(' ')) {
        const mixedParts = quantity.split(' ');
        const whole = parseFloat(mixedParts[0]);
        const fractionParts = mixedParts[1].split('/');
        const fraction = parseFloat(fractionParts[0]) / parseFloat(fractionParts[1]);
        quantity = whole + fraction;
      }
      else {
        quantity = parseFloat(quantity);
      }
    }
    
    // If no unit was found but there's a remainder, the remainder might be the unit
    if (!unit && remainder) {
      // Check if the first word of the remainder is a unit
      const firstWord = remainder.split(' ')[0].toLowerCase();
      if (units.includes(firstWord)) {
        unit = firstWord;
        remainder = remainder.substring(firstWord.length).trim();
      }
    }
    
    return {
      quantity: isNaN(quantity) ? null : quantity,
      unit: unit || null,
      remainder: remainder || null
    };
  }
  
  return { quantity: null, unit: null, remainder: measureStr };
}

// Function to categorize units
function categorizeUnit(unit) {
  const lowerUnit = unit.toLowerCase();
  
  // Volume units
  if (['cup', 'cups', 'tbsp', 'tsp', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons', 
       'ml', 'l', 'milliliter', 'milliliters', 'liter', 'liters', 'fluid', 'fl', 'oz', 'gallon', 'quart', 'pint'].some(u => lowerUnit.includes(u))) {
    return 'volume';
  }
  
  // Weight units
  if (['g', 'kg', 'gram', 'grams', 'kilogram', 'kilograms', 'oz', 'ounce', 'ounces', 
       'lb', 'lbs', 'pound', 'pounds'].some(u => lowerUnit.includes(u))) {
    return 'weight';
  }
  
  // Count units
  if (['slice', 'slices', 'piece', 'pieces', 'clove', 'cloves', 'can', 'cans', 'jar', 'jars', 
       'package', 'packages', 'bunch', 'bunches', 'sprig', 'sprigs', 'stalk', 'stalks'].some(u => lowerUnit.includes(u))) {
    return 'count';
  }
  
  // Small amount units
  if (['pinch', 'pinches', 'dash', 'dashes'].some(u => lowerUnit.includes(u))) {
    return 'small_amount';
  }
  
  return 'other';
}

// Function to determine source type from URL
function determineSourceType(url) {
  if (!url) return 'unknown';
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'video';
  }
  
  if (lowerUrl.includes('instagram.com')) {
    return 'social_media';
  }
  
  if (lowerUrl.includes('facebook.com')) {
    return 'social_media';
  }
  
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    return 'social_media';
  }
  
  if (lowerUrl.includes('pinterest.com')) {
    return 'social_media';
  }
  
  if (lowerUrl.includes('tiktok.com')) {
    return 'video';
  }
  
  if (lowerUrl.includes('blog') || lowerUrl.includes('recipe') || lowerUrl.includes('food')) {
    return 'blog';
  }
  
  return 'website';
}

// Function to extract domain from URL
function extractDomain(url) {
  if (!url) return null;
  
  try {
    const domain = new URL(url).hostname;
    return domain;
  } catch (error) {
    return null;
  }
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
    
    // Extract unique units
    const unitSet = new Set();
    
    // Create recipe ingredients junction table with parsed measurements
    const recipeIngredients = [];
    recipes.forEach(recipe => {
      recipe.ingredients.forEach(ingredient => {
        const name = ingredient.name.trim();
        const lowerName = name.toLowerCase();
        const ingredientId = ingredientMap.get(lowerName).id;
        
        // Parse the measurement
        const { quantity, unit, remainder } = parseMeasurement(ingredient.measure);
        
        // Add unit to the set of unique units
        if (unit) {
          unitSet.add(unit.toLowerCase());
        }
        
        recipeIngredients.push({
          id: `${recipe.id}_${ingredientId}`,
          recipeId: recipe.id,
          ingredientId,
          originalMeasure: ingredient.measure,
          quantity,
          unit,
          additionalInfo: remainder
        });
      });
    });
    
    console.log(`Created ${recipeIngredients.length} recipe-ingredient relationships`);
    
    // Create units table
    const units = Array.from(unitSet).map(unit => ({
      id: generateShortId(unit),
      name: unit,
      abbreviation: unit.length <= 4 ? unit : unit.substring(0, 3),
      type: categorizeUnit(unit)
    }));
    
    console.log(`Extracted ${units.length} unique units`);
    
    // Create sources table
    const sources = [];
    recipes.forEach(recipe => {
      // Add YouTube source if available
      if (recipe.youtube) {
        sources.push({
          id: generateShortId(recipe.youtube),
          recipeId: recipe.id,
          url: recipe.youtube,
          type: 'video',
          platform: 'YouTube',
          domain: extractDomain(recipe.youtube),
          description: `Video tutorial for ${recipe.name}`
        });
      }
      
      // Add website source if available
      if (recipe.source) {
        sources.push({
          id: generateShortId(recipe.source),
          recipeId: recipe.id,
          url: recipe.source,
          type: determineSourceType(recipe.source),
          platform: extractDomain(recipe.source),
          domain: extractDomain(recipe.source),
          description: `Original recipe for ${recipe.name}`
        });
      }
    });
    
    console.log(`Created ${sources.length} sources`);
    
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
        // Remove youtube and source as they're now in the sources table
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
    
    console.log(`Normalized ${normalizedRecipes.length} recipes`);
    
    // Create normalized data structure
    const normalizedData = {
      recipes: normalizedRecipes,
      ingredients,
      categories,
      cuisines,
      recipeIngredients,
      units,
      sources
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
    
    await writeFileAsync(
      path.join(outputDir, 'units.json'),
      JSON.stringify(units, null, 2)
    );
    
    await writeFileAsync(
      path.join(outputDir, 'sources.json'),
      JSON.stringify(sources, null, 2)
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
