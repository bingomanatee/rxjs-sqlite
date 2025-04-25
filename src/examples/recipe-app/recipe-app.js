/**
 * Recipe App using the recipes.json file
 * This app demonstrates how to work with the recipe data
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);

// Function to load recipes from JSON file
async function loadRecipes() {
  try {
    const filePath = path.join(__dirname, 'output', 'recipes.json');
    const data = await readFileAsync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading recipes:', error);
    return [];
  }
}

// Function to display recipe information
function displayRecipe(recipe) {
  console.log('\n==============================================');
  console.log(`Recipe: ${recipe.name}`);
  console.log(`Category: ${recipe.category} | Cuisine: ${recipe.area}`);
  console.log('==============================================');
  
  console.log('\nIngredients:');
  recipe.ingredients.forEach(ingredient => {
    console.log(`- ${ingredient.measure} ${ingredient.name}`);
  });
  
  console.log('\nInstructions:');
  console.log(recipe.instructions);
  
  if (recipe.youtube) {
    console.log(`\nVideo: ${recipe.youtube}`);
  }
  
  if (recipe.source) {
    console.log(`Source: ${recipe.source}`);
  }
  
  console.log('==============================================\n');
}

// Function to search recipes by name
function searchRecipesByName(recipes, searchTerm) {
  console.log(`Searching for recipes with name containing "${searchTerm}"...`);
  
  const regex = new RegExp(searchTerm, 'i');
  const matchingRecipes = recipes.filter(recipe => regex.test(recipe.name));
  
  console.log(`Found ${matchingRecipes.length} recipes matching "${searchTerm}"`);
  
  return matchingRecipes;
}

// Function to search recipes by ingredient
function searchRecipesByIngredient(recipes, ingredient) {
  console.log(`Searching for recipes with ingredient containing "${ingredient}"...`);
  
  const regex = new RegExp(ingredient, 'i');
  const matchingRecipes = recipes.filter(recipe => 
    recipe.ingredients.some(ing => regex.test(ing.name))
  );
  
  console.log(`Found ${matchingRecipes.length} recipes with ingredient "${ingredient}"`);
  
  return matchingRecipes;
}

// Function to get recipes by category
function getRecipesByCategory(recipes, category) {
  console.log(`Getting recipes in category "${category}"...`);
  
  const matchingRecipes = recipes.filter(recipe => recipe.category === category);
  
  console.log(`Found ${matchingRecipes.length} recipes in category "${category}"`);
  
  return matchingRecipes;
}

// Function to get recipes by cuisine (area)
function getRecipesByCuisine(recipes, cuisine) {
  console.log(`Getting recipes from cuisine "${cuisine}"...`);
  
  const matchingRecipes = recipes.filter(recipe => recipe.area === cuisine);
  
  console.log(`Found ${matchingRecipes.length} recipes from cuisine "${cuisine}"`);
  
  return matchingRecipes;
}

// Function to get all categories
function getAllCategories(recipes) {
  // Extract unique categories
  return [...new Set(recipes.map(recipe => recipe.category))];
}

// Function to get all cuisines (areas)
function getAllCuisines(recipes) {
  // Extract unique cuisines
  return [...new Set(recipes.map(recipe => recipe.area))];
}

// Function to get recipe stats
function getRecipeStats(recipes) {
  const categories = getAllCategories(recipes);
  const cuisines = getAllCuisines(recipes);
  
  // Count recipes by category
  const recipesByCategory = categories.map(category => {
    const count = recipes.filter(recipe => recipe.category === category).length;
    return { category, count };
  });
  
  // Count recipes by cuisine
  const recipesByCuisine = cuisines.map(cuisine => {
    const count = recipes.filter(recipe => recipe.area === cuisine).length;
    return { cuisine, count };
  });
  
  // Get total ingredient count
  const totalIngredients = recipes.reduce((total, recipe) => total + recipe.ingredients.length, 0);
  
  // Get unique ingredients
  const uniqueIngredients = new Set();
  recipes.forEach(recipe => {
    recipe.ingredients.forEach(ingredient => {
      uniqueIngredients.add(ingredient.name.toLowerCase());
    });
  });
  
  return {
    totalRecipes: recipes.length,
    categories: recipesByCategory,
    cuisines: recipesByCuisine,
    totalIngredients,
    uniqueIngredientCount: uniqueIngredients.size
  };
}

// Main function
async function main() {
  try {
    // Load recipes
    const recipes = await loadRecipes();
    
    if (recipes.length === 0) {
      console.log('No recipes found. Please run fetch-recipes.js first to fetch recipes.');
      return;
    }
    
    console.log(`Loaded ${recipes.length} recipes`);
    
    // Get recipe stats
    const stats = getRecipeStats(recipes);
    console.log('\nRecipe Stats:');
    console.log(`Total Recipes: ${stats.totalRecipes}`);
    console.log(`Total Ingredients Used: ${stats.totalIngredients}`);
    console.log(`Unique Ingredients: ${stats.uniqueIngredientCount}`);
    
    console.log('\nRecipes by Category:');
    stats.categories.forEach(cat => {
      console.log(`- ${cat.category}: ${cat.count} recipes`);
    });
    
    console.log('\nRecipes by Cuisine:');
    stats.cuisines.forEach(cuisine => {
      console.log(`- ${cuisine.cuisine}: ${cuisine.count} recipes`);
    });
    
    // Demo: Search recipes by name
    const chickenRecipes = searchRecipesByName(recipes, 'chicken');
    if (chickenRecipes.length > 0) {
      console.log('\nSample Chicken Recipe:');
      displayRecipe(chickenRecipes[0]);
    }
    
    // Demo: Search recipes by ingredient
    const tomatoRecipes = searchRecipesByIngredient(recipes, 'tomato');
    if (tomatoRecipes.length > 0) {
      console.log('\nSample Recipe with Tomato:');
      displayRecipe(tomatoRecipes[0]);
    }
    
    // Demo: Get recipes by category
    const dessertRecipes = getRecipesByCategory(recipes, 'Dessert');
    if (dessertRecipes.length > 0) {
      console.log('\nSample Dessert Recipe:');
      displayRecipe(dessertRecipes[0]);
    }
    
    // Demo: Get recipes by cuisine
    const italianRecipes = getRecipesByCuisine(recipes, 'Italian');
    if (italianRecipes.length > 0) {
      console.log('\nSample Italian Recipe:');
      displayRecipe(italianRecipes[0]);
    }
    
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the app
main();
