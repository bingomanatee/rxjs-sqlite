import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db';
import { syncAllData, syncRecipeDetail } from '../services/sync';

/**
 * Custom hook to access RxDB data in React components
 */
export const useRxDB = () => {
  const [db, setDb] = useState<any>(null);
  const [collections, setCollections] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize database and sync data
  useEffect(() => {
    const initDb = async () => {
      try {
        setLoading(true);

        // Get database instance
        const dbInstance = await getDatabase();
        setDb(dbInstance.db);
        setCollections(dbInstance.collections);

        // Sync data from server
        await syncAllData();

        setLoading(false);
      } catch (err) {
        console.error('Error initializing database:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    };

    initDb();
  }, []);

  // Get all recipes - memoized to prevent infinite re-renders
  const getRecipes = useCallback(async () => {
    if (!collections) return [];

    const recipes = await collections.recipes.find().exec();
    return recipes;
  }, [collections]);

  // Get recipe by ID - memoized to prevent infinite re-renders
  const getRecipeById = useCallback(async (id: string) => {
    if (!collections) return null;

    // Try to get from local database first
    const recipe = await collections.recipes.findOne(id).exec();

    // If not found or we want to ensure fresh data, sync from server
    if (!recipe) {
      await syncRecipeDetail(id);
      return collections.recipes.findOne(id).exec();
    }

    return recipe;
  }, [collections]);

  // Get recipe steps - memoized to prevent infinite re-renders
  const getRecipeSteps = useCallback(async (recipeId: string) => {
    if (!collections) return [];

    const steps = await collections.recipeSteps
      .find({
        selector: { recipeId },
        sort: [{ stepNumber: 'asc' }]
      })
      .exec();

    return steps;
  }, [collections]);

  // Get recipe ingredients - memoized to prevent infinite re-renders
  const getRecipeIngredients = useCallback(async (recipeId: string) => {
    if (!collections) return [];

    const recipeIngredients = await collections.recipeIngredients
      .find({
        selector: { recipeId }
      })
      .exec();

    // For each recipe ingredient, get the ingredient details
    const result = [];
    for (const ri of recipeIngredients) {
      const ingredient = await collections.ingredients.findOne(ri.get('ingredientId')).exec();
      if (ingredient) {
        result.push({
          ...ri.toJSON(),
          ingredient: ingredient.toJSON()
        });
      }
    }

    return result;
  }, [collections]);

  // Get metadata by type - memoized to prevent infinite re-renders
  const getMetadataByType = useCallback(async (type: string) => {
    if (!collections) return [];

    const metadata = await collections.metadata
      .find({
        selector: { type }
      })
      .exec();

    return metadata;
  }, [collections]);

  // Search recipes - memoized to prevent infinite re-renders
  const searchRecipes = useCallback(async (query: string) => {
    if (!collections) return [];

    // Simple client-side search
    const recipes = await collections.recipes.find().exec();

    return recipes.filter((recipe: any) =>
      recipe.get('name').toLowerCase().includes(query.toLowerCase()) ||
      recipe.get('instructions').toLowerCase().includes(query.toLowerCase())
    );
  }, [collections]);

  // Get bookmarks - memoized to prevent infinite re-renders
  const getBookmarks = useCallback(async (userId: string = 'default-user') => {
    if (!collections) return [];

    const bookmarks = await collections.bookmarks
      .find({
        selector: { userId }
      })
      .exec();

    return bookmarks;
  }, [collections]);

  // Check if a recipe is bookmarked - memoized to prevent infinite re-renders
  const isRecipeBookmarked = useCallback(async (recipeId: string, userId: string = 'default-user') => {
    if (!collections) return false;

    const bookmark = await collections.bookmarks
      .findOne({
        selector: {
          recipeId,
          userId
        }
      })
      .exec();

    return !!bookmark;
  }, [collections]);

  // Add bookmark - memoized to prevent infinite re-renders
  const addBookmark = useCallback(async (recipeId: string, userId: string = 'default-user', notes: string | null = null) => {
    if (!collections) return null;

    // Check if already bookmarked
    const existing = await collections.bookmarks
      .findOne({
        selector: {
          recipeId,
          userId
        }
      })
      .exec();

    if (existing) {
      return existing;
    }

    // Create new bookmark
    const id = `bookmark-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const bookmark = await collections.bookmarks.insert({
      id,
      userId,
      recipeId,
      createdAt: new Date().toISOString(),
      notes
    });

    return bookmark;
  }, [collections]);

  // Remove bookmark - memoized to prevent infinite re-renders
  const removeBookmark = useCallback(async (recipeId: string, userId: string = 'default-user') => {
    if (!collections) return false;

    // Find the bookmark
    const bookmark = await collections.bookmarks
      .findOne({
        selector: {
          recipeId,
          userId
        }
      })
      .exec();

    if (bookmark) {
      await bookmark.remove();
      return true;
    }

    return false;
  }, [collections]);

  // Get bookmarked recipes - memoized to prevent infinite re-renders
  const getBookmarkedRecipes = useCallback(async (userId: string = 'default-user') => {
    if (!collections) return [];

    const bookmarks = await collections.bookmarks
      .find({
        selector: { userId }
      })
      .exec();

    const recipeIds = bookmarks.map((bookmark: any) => bookmark.get('recipeId'));

    if (recipeIds.length === 0) {
      return [];
    }

    const recipes = await collections.recipes
      .find({
        selector: {
          id: { $in: recipeIds }
        }
      })
      .exec();

    return recipes;
  }, [collections]);

  return {
    db,
    collections,
    loading,
    error,
    getRecipes,
    getRecipeById,
    getRecipeSteps,
    getRecipeIngredients,
    getMetadataByType,
    searchRecipes,
    getBookmarks,
    isRecipeBookmarked,
    addBookmark,
    removeBookmark,
    getBookmarkedRecipes
  };
};

export default useRxDB;
