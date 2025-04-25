/**
 * Example script demonstrating how to use the RxDBRecipeAdapter
 * This fully dogfoods the RxDB SQLite adapter for both data import and querying
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const RxDBRecipeAdapter = require('./rxdb-recipe-adapter');

// Function to load normalized data
async function loadNormalizedData() {
  try {
    const filePath = path.join(__dirname, 'output', 'normalized', 'normalized-data.json');
    const data = await readFileAsync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading normalized data:', error);
    throw error;
  }
}

// Function to load processed recipes
async function loadProcessedRecipes() {
  try {
    const filePath = path.join(__dirname, 'output', 'normalized', 'processed-recipes.json');
    const data = await readFileAsync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading processed recipes:', error);
    throw error;
  }
}

// Function to export data to JSON
async function exportData(data, filename) {
  try {
    const exportDir = path.join(__dirname, 'output', 'rxdb-export');
    await mkdirAsync(exportDir, { recursive: true });
    
    await writeFileAsync(
      path.join(exportDir, filename),
      JSON.stringify(data, null, 2)
    );
    
    console.log(`Exported data to ${path.join(exportDir, filename)}`);
  } catch (error) {
    console.error(`Error exporting data to ${filename}:`, error);
    throw error;
  }
}

// Main function
async function main() {
  let adapter = null;
  
  try {
    console.log('Starting RxDB Recipe Adapter example...');
    
    // Create and initialize the adapter
    adapter = new RxDBRecipeAdapter({
      filename: path.join(__dirname, 'rxdb-recipe-database.sqlite')
    });
    
    await adapter.initialize();
    console.log('Adapter initialized');
    
    // Load normalized data
    const normalizedData = await loadNormalizedData();
    
    // Load processed recipes
    const processedRecipes = await loadProcessedRecipes();
    
    // Replace recipes in normalized data with processed recipes
    normalizedData.recipes = processedRecipes;
    
    // Import data
    await adapter.importNormalizedData(normalizedData);
    
    // Perform example queries
    console.log('\nPerforming example queries...');
    
    // Query 1: Get all recipes
    const allRecipes = await adapter.getAllRecipes();
    console.log(`\nTotal recipes: ${allRecipes.length}`);
    
    // Export recipes to JSON
    await exportData(allRecipes, 'rxdb-recipes.json');
    
    // Query 2: Get all categories
    const allCategories = await adapter.getAllCategories();
    console.log(`\nTotal categories: ${allCategories.length}`);
    console.log('Categories:', allCategories.map(c => c.name).join(', '));
    
    // Query 3: Get all cuisines
    const allCuisines = await adapter.getAllCuisines();
    console.log(`\nTotal cuisines: ${allCuisines.length}`);
    console.log('Cuisines:', allCuisines.map(c => c.name).join(', '));
    
    // Query 4: Get recipes by category
    if (allCategories.length > 0) {
      const category = allCategories[0];
      const recipesByCategory = await adapter.getRecipesByCategory(category.id);
      console.log(`\nRecipes in category "${category.name}": ${recipesByCategory.length}`);
      
      if (recipesByCategory.length > 0) {
        console.log(`Example: ${recipesByCategory[0].name}`);
      }
      
      // Export category recipes to JSON
      await exportData(recipesByCategory, `rxdb-category-${category.name.toLowerCase()}-recipes.json`);
    }
    
    // Query 5: Get recipes by cuisine
    if (allCuisines.length > 0) {
      const cuisine = allCuisines[0];
      const recipesByCuisine = await adapter.getRecipesByCuisine(cuisine.id);
      console.log(`\nRecipes in cuisine "${cuisine.name}": ${recipesByCuisine.length}`);
      
      if (recipesByCuisine.length > 0) {
        console.log(`Example: ${recipesByCuisine[0].name}`);
      }
      
      // Export cuisine recipes to JSON
      await exportData(recipesByCuisine, `rxdb-cuisine-${cuisine.name.toLowerCase()}-recipes.json`);
    }
    
    // Query 6: Search recipes by name
    const chickenRecipes = await adapter.searchRecipesByName('Chicken');
    console.log(`\nRecipes with "Chicken" in the name: ${chickenRecipes.length}`);
    
    if (chickenRecipes.length > 0) {
      console.log(`Example: ${chickenRecipes[0].name}`);
    }
    
    // Export chicken recipes to JSON
    await exportData(chickenRecipes, 'rxdb-chicken-recipes.json');
    
    // Query 7: Get a complete recipe
    if (allRecipes.length > 0) {
      const recipeId = allRecipes[0].id;
      const completeRecipe = await adapter.getCompleteRecipe(recipeId);
      
      console.log(`\nComplete recipe: ${completeRecipe.name}`);
      console.log(`Category: ${completeRecipe.category.name}`);
      console.log(`Cuisine: ${completeRecipe.cuisine.name}`);
      console.log(`Ingredients: ${completeRecipe.ingredients.length}`);
      
      // Display the first few ingredients
      console.log('\nSome ingredients:');
      completeRecipe.ingredients.slice(0, 5).forEach(ri => {
        console.log(`- ${ri.originalMeasure} ${ri.ingredient.name}`);
      });
      
      // Display sources if available
      if (completeRecipe.sources && completeRecipe.sources.length > 0) {
        console.log('\nSources:');
        completeRecipe.sources.forEach(source => {
          console.log(`- ${source.type}: ${source.url}`);
        });
      }
      
      // Export complete recipe to JSON
      await exportData(completeRecipe, `rxdb-complete-recipe-${completeRecipe.id}.json`);
    }
    
    // Export all data
    const exportedData = await adapter.exportNormalizedData();
    console.log(`\nExported data: ${Object.keys(exportedData).length} tables`);
    console.log(`Recipes: ${exportedData.recipes.length}`);
    console.log(`Ingredients: ${exportedData.ingredients.length}`);
    console.log(`Categories: ${exportedData.categories.length}`);
    console.log(`Cuisines: ${exportedData.cuisines.length}`);
    console.log(`Recipe Ingredients: ${exportedData.recipeIngredients.length}`);
    console.log(`Units: ${exportedData.units.length}`);
    console.log(`Sources: ${exportedData.sources.length}`);
    
    // Export all data to JSON
    await exportData(exportedData, 'rxdb-all-data.json');
    
    console.log('\nDone!');
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
