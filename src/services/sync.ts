import { fetchRecipes, fetchRecipeById, fetchMetadata } from './api';
import { getDatabase } from '../db';

/**
 * Sync recipes from the server to the local RxDB database
 */
export const syncRecipes = async (page = 1, limit = 30) => {
  try {
    console.log(`Syncing recipes (page ${page}, limit ${limit})...`);

    // Get database instance
    const { collections } = await getDatabase();

    // Fetch recipes from server
    const { recipes, pagination } = await fetchRecipes(page, limit);
    console.log(`Fetched ${recipes.length} recipes from server`);

    // Insert recipes into local database
    for (const recipe of recipes) {
      try {
        await collections.recipes.upsert({
          id: recipe.id,
          name: recipe.name,
          categoryId: recipe.categoryId,
          cuisineId: recipe.cuisineId,
          description: recipe.description,
          instructions: recipe.description, // Use description as instructions for list view until we get full details
          thumbnail: recipe.thumbnail,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error(`Error syncing recipe ${recipe.id}:`, error);
      }
    }

    console.log(`Synced ${recipes.length} recipes to local database`);

    // Return pagination info for potential pagination UI
    return pagination;
  } catch (error) {
    console.error('Error syncing recipes:', error);
    throw error;
  }
};

/**
 * Sync a single recipe with full details
 */
export const syncRecipeDetail = async (recipeId: string) => {
  try {
    console.log(`Syncing recipe detail for ${recipeId}...`);

    // Get database instance
    const { collections } = await getDatabase();

    // Fetch recipe detail from server
    const recipeDetail = await fetchRecipeById(recipeId);

    // Update recipe in local database
    await collections.recipes.upsert({
      id: recipeDetail.id,
      name: recipeDetail.name,
      categoryId: recipeDetail.categoryId,
      cuisineId: recipeDetail.cuisineId,
      description: recipeDetail.description,
      instructions: recipeDetail.instructions,
      thumbnail: recipeDetail.thumbnail,
      createdAt: recipeDetail.createdAt,
      updatedAt: recipeDetail.updatedAt,
      category: recipeDetail.category,
      cuisine: recipeDetail.cuisine
    });

    // Sync category and cuisine if available
    if (recipeDetail.category) {
      await collections.metadata.upsert(recipeDetail.category);
    }

    if (recipeDetail.cuisine) {
      await collections.metadata.upsert(recipeDetail.cuisine);
    }

    // Sync steps
    for (const step of recipeDetail.steps) {
      await collections.recipeSteps.upsert(step);
    }

    // Sync ingredients
    for (const ingredient of recipeDetail.ingredients) {
      // First sync the ingredient itself
      await collections.ingredients.upsert(ingredient.ingredient);

      // Then sync the recipe-ingredient relationship
      const { ingredient: _, ...recipeIngredient } = ingredient;
      await collections.recipeIngredients.upsert(recipeIngredient);
    }

    console.log(`Synced recipe detail for ${recipeId}`);

    return recipeDetail;
  } catch (error) {
    console.error(`Error syncing recipe detail for ${recipeId}:`, error);
    throw error;
  }
};

/**
 * Sync metadata (categories, cuisines, tags)
 */
export const syncMetadata = async () => {
  try {
    console.log('Syncing metadata...');

    // Get database instance
    const { collections } = await getDatabase();

    // Fetch metadata from server
    const metadata = await fetchMetadata();

    // Insert metadata into local database
    for (const item of metadata) {
      try {
        await collections.metadata.upsert(item);
      } catch (error) {
        console.error(`Error syncing metadata ${item.id}:`, error);
      }
    }

    console.log(`Synced ${metadata.length} metadata items to local database`);

    return metadata;
  } catch (error) {
    console.error('Error syncing metadata:', error);
    throw error;
  }
};

/**
 * Sync all data from server
 */
export const syncAllData = async () => {
  try {
    console.log('Starting full data sync...');

    // Sync metadata first (categories, cuisines, tags)
    await syncMetadata();

    // Sync recipes (first page)
    const pagination = await syncRecipes(1, 30);

    // Sync remaining pages if needed
    if (pagination.totalPages > 1) {
      for (let page = 2; page <= pagination.totalPages; page++) {
        await syncRecipes(page, 30);
      }
    }

    console.log('Full data sync completed');
  } catch (error) {
    console.error('Error during full data sync:', error);
    throw error;
  }
};
