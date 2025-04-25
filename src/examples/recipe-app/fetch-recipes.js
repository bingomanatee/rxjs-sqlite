/**
 * Script to fetch recipes from TheMealDB API and save them as JSON
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

// Function to fetch recipes from TheMealDB API
async function fetchRecipes(limit = 100) {
  console.log(`Fetching up to ${limit} recipes from TheMealDB API...`);
  
  const recipes = [];
  const categories = await fetchCategories();
  
  // Fetch recipes for each category
  for (const category of categories) {
    if (recipes.length >= limit) break;
    
    console.log(`Fetching recipes for category: ${category}`);
    const categoryRecipes = await fetchRecipesByCategory(category);
    
    // Add recipes up to the limit
    const remainingSlots = limit - recipes.length;
    recipes.push(...categoryRecipes.slice(0, remainingSlots));
    
    console.log(`Fetched ${categoryRecipes.length} recipes for category ${category}`);
    console.log(`Total recipes so far: ${recipes.length}/${limit}`);
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return recipes;
}

// Function to fetch all categories
async function fetchCategories() {
  try {
    const response = await axios.get('https://www.themealdb.com/api/json/v1/1/categories.php');
    return response.data.categories.map(category => category.strCategory);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

// Function to fetch recipes by category
async function fetchRecipesByCategory(category) {
  try {
    const response = await axios.get(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(category)}`);
    
    if (!response.data.meals) {
      return [];
    }
    
    const recipes = [];
    
    // Fetch details for each recipe
    for (const meal of response.data.meals.slice(0, 5)) { // Limit to 5 recipes per category
      const recipeDetails = await fetchRecipeDetails(meal.idMeal);
      if (recipeDetails) {
        recipes.push(recipeDetails);
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return recipes;
  } catch (error) {
    console.error(`Error fetching recipes for category ${category}:`, error);
    return [];
  }
}

// Function to fetch recipe details
async function fetchRecipeDetails(id) {
  try {
    const response = await axios.get(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`);
    
    if (!response.data.meals || !response.data.meals[0]) {
      return null;
    }
    
    const meal = response.data.meals[0];
    
    // Extract ingredients and measures
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ingredient = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      
      if (ingredient && ingredient.trim() !== '') {
        ingredients.push({
          name: ingredient,
          measure: measure || ''
        });
      }
    }
    
    // Extract tags
    const tags = meal.strTags ? meal.strTags.split(',').map(tag => tag.trim()) : [];
    
    // Create recipe object
    return {
      id: meal.idMeal,
      name: meal.strMeal,
      category: meal.strCategory,
      area: meal.strArea,
      instructions: meal.strInstructions,
      thumbnail: meal.strMealThumb,
      tags,
      youtube: meal.strYoutube,
      ingredients,
      source: meal.strSource || ''
    };
  } catch (error) {
    console.error(`Error fetching recipe details for ID ${id}:`, error);
    return null;
  }
}

// Function to save recipes as JSON
async function saveRecipesAsJson(recipes) {
  console.log(`Saving ${recipes.length} recipes as JSON...`);
  
  const outputDir = path.join(__dirname, 'output');
  await mkdirAsync(outputDir, { recursive: true });
  
  await writeFileAsync(
    path.join(outputDir, 'recipes.json'),
    JSON.stringify(recipes, null, 2)
  );
  
  console.log(`Saved ${recipes.length} recipes to ${path.join(outputDir, 'recipes.json')}`);
}

// Main function
async function main() {
  try {
    // Fetch recipes
    const recipes = await fetchRecipes(100);
    console.log(`Fetched ${recipes.length} recipes`);
    
    // Save recipes as JSON
    await saveRecipesAsJson(recipes);
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
main();
