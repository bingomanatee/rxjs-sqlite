/**
 * Script to extract unique ingredients from recipes and create an ingredients table
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
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

// Function to extract unique ingredients from recipes
async function extractIngredients() {
  try {
    // Load recipes
    const filePath = path.join(__dirname, 'output', 'recipes.json');
    const data = await readFileAsync(filePath, 'utf8');
    const recipes = JSON.parse(data);
    
    console.log(`Loaded ${recipes.length} recipes`);
    
    // Extract all ingredients
    const allIngredients = [];
    recipes.forEach(recipe => {
      recipe.ingredients.forEach(ingredient => {
        allIngredients.push(ingredient.name.trim());
      });
    });
    
    console.log(`Found ${allIngredients.length} total ingredients`);
    
    // Get unique ingredients
    const uniqueIngredients = [...new Set(allIngredients.map(name => name.toLowerCase()))]
      .map(name => {
        // Find the most common capitalization
        const variants = allIngredients.filter(ing => ing.toLowerCase() === name);
        const mostCommon = variants.sort((a, b) => 
          variants.filter(v => v === a).length - variants.filter(v => v === b).length
        ).pop();
        
        return mostCommon;
      });
    
    console.log(`Found ${uniqueIngredients.length} unique ingredients`);
    
    // Create ingredients table
    const ingredientsTable = uniqueIngredients.map(name => {
      const id = generateShortId(name);
      const isPlural = isTypicallyPlural(name);
      
      return {
        id,
        name,
        isPlural,
        // Add other properties as needed
        category: categorizeIngredient(name)
      };
    });
    
    // Save ingredients table
    await writeFileAsync(
      path.join(__dirname, 'output', 'ingredients.json'),
      JSON.stringify(ingredientsTable, null, 2)
    );
    
    console.log(`Saved ${ingredientsTable.length} ingredients to ingredients.json`);
    
    return ingredientsTable;
  } catch (error) {
    console.error('Error extracting ingredients:', error);
    return [];
  }
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

// Function to update recipes with ingredient IDs
async function updateRecipesWithIngredientIds() {
  try {
    // Load recipes
    const recipesPath = path.join(__dirname, 'output', 'recipes.json');
    const recipesData = await readFileAsync(recipesPath, 'utf8');
    const recipes = JSON.parse(recipesData);
    
    // Load ingredients
    const ingredientsPath = path.join(__dirname, 'output', 'ingredients.json');
    const ingredientsData = await readFileAsync(ingredientsPath, 'utf8');
    const ingredients = JSON.parse(ingredientsData);
    
    console.log(`Updating ${recipes.length} recipes with ingredient IDs...`);
    
    // Create a map of ingredient names to IDs
    const ingredientMap = {};
    ingredients.forEach(ingredient => {
      ingredientMap[ingredient.name.toLowerCase()] = ingredient.id;
    });
    
    // Update recipes
    const updatedRecipes = recipes.map(recipe => {
      const updatedIngredients = recipe.ingredients.map(ingredient => {
        const name = ingredient.name.trim();
        const id = ingredientMap[name.toLowerCase()];
        
        if (!id) {
          console.warn(`Ingredient not found: ${name}`);
          return ingredient;
        }
        
        return {
          ...ingredient,
          ingredientId: id,
          // Keep the original name for reference
          originalName: name
        };
      });
      
      // Update instructions to use ingredient IDs
      let updatedInstructions = recipe.instructions;
      
      // Sort ingredients by name length (longest first) to avoid partial matches
      const sortedIngredients = [...recipe.ingredients].sort((a, b) => 
        b.name.length - a.name.length
      );
      
      // Replace ingredient names with references
      sortedIngredients.forEach(ingredient => {
        const name = ingredient.name.trim();
        const id = ingredientMap[name.toLowerCase()];
        
        if (id) {
          // Create a regex that matches the ingredient name as a whole word
          const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi');
          
          // Replace with a reference
          updatedInstructions = updatedInstructions.replace(regex, `[INGREDIENT:${id}]`);
        }
      });
      
      return {
        ...recipe,
        ingredients: updatedIngredients,
        originalInstructions: recipe.instructions,
        instructions: updatedInstructions
      };
    });
    
    // Save updated recipes
    await writeFileAsync(
      path.join(__dirname, 'output', 'recipes-with-ingredient-ids.json'),
      JSON.stringify(updatedRecipes, null, 2)
    );
    
    console.log(`Saved ${updatedRecipes.length} updated recipes to recipes-with-ingredient-ids.json`);
    
    return updatedRecipes;
  } catch (error) {
    console.error('Error updating recipes:', error);
    return [];
  }
}

// Helper function to escape special characters in regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Main function
async function main() {
  try {
    // Extract ingredients
    const ingredients = await extractIngredients();
    
    if (ingredients.length === 0) {
      console.log('No ingredients found. Please run fetch-recipes.js first to fetch recipes.');
      return;
    }
    
    // Update recipes with ingredient IDs
    await updateRecipesWithIngredientIds();
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
main();
