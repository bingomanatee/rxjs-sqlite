/**
 * RxDB Recipe Adapter
 * Uses the RxDB SQLite adapter to store and query recipe data
 */
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

// Import required modules
const { createRxDatabase } = require("rxdb");

// Import our local copy of the SQLite adapter
const { getRxStorageSQLite } = require("./lib/rxdb-adapter/sqlite-adapter");

// Define schemas for our collections
const recipeSchema = {
  title: "recipe schema",
  version: 0,
  description: "Recipe data",
  primaryKey: "id",
  type: "object",
  properties: {
    id: {
      type: "string",
      maxLength: 100,
    },
    name: {
      type: "string",
    },
    categoryId: {
      type: "string",
      ref: "categories",
    },
    cuisineId: {
      type: "string",
      ref: "cuisines",
    },
    instructions: {
      type: "string",
    },
    originalInstructions: {
      type: "string",
    },
    thumbnail: {
      type: "string",
    },
    tags: {
      type: "array",
      items: {
        type: "string",
      },
    },
    createdAt: {
      type: "string",
      format: "date-time",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
    },
  },
  required: ["id", "name", "instructions"],
};

const ingredientSchema = {
  title: "ingredient schema",
  version: 0,
  description: "Ingredient data",
  primaryKey: "id",
  type: "object",
  properties: {
    id: {
      type: "string",
      maxLength: 100,
    },
    name: {
      type: "string",
    },
    isPlural: {
      type: "boolean",
    },
    category: {
      type: "string",
    },
  },
  required: ["id", "name"],
};

const categorySchema = {
  title: "category schema",
  version: 0,
  description: "Recipe category data",
  primaryKey: "id",
  type: "object",
  properties: {
    id: {
      type: "string",
      maxLength: 100,
    },
    name: {
      type: "string",
    },
  },
  required: ["id", "name"],
};

const cuisineSchema = {
  title: "cuisine schema",
  version: 0,
  description: "Recipe cuisine data",
  primaryKey: "id",
  type: "object",
  properties: {
    id: {
      type: "string",
      maxLength: 100,
    },
    name: {
      type: "string",
    },
  },
  required: ["id", "name"],
};

const recipeIngredientSchema = {
  title: "recipe ingredient schema",
  version: 0,
  description: "Recipe-ingredient relationship data",
  primaryKey: "id",
  type: "object",
  properties: {
    id: {
      type: "string",
      maxLength: 100,
    },
    recipeId: {
      type: "string",
      ref: "recipes",
    },
    ingredientId: {
      type: "string",
      ref: "ingredients",
    },
    originalMeasure: {
      type: "string",
    },
    quantity: {
      type: ["number", "null"],
    },
    unit: {
      type: ["string", "null"],
    },
    additionalInfo: {
      type: ["string", "null"],
    },
  },
  required: ["id", "recipeId", "ingredientId"],
};

const unitSchema = {
  title: "unit schema",
  version: 0,
  description: "Measurement unit data",
  primaryKey: "id",
  type: "object",
  properties: {
    id: {
      type: "string",
      maxLength: 100,
    },
    name: {
      type: "string",
    },
    abbreviation: {
      type: "string",
    },
    type: {
      type: "string",
      enum: ["volume", "weight", "count", "small_amount", "other"],
    },
  },
  required: ["id", "name"],
};

const sourceSchema = {
  title: "source schema",
  version: 0,
  description: "Recipe source data (videos, websites, etc.)",
  primaryKey: "id",
  type: "object",
  properties: {
    id: {
      type: "string",
      maxLength: 100,
    },
    recipeId: {
      type: "string",
      ref: "recipes",
    },
    url: {
      type: "string",
    },
    type: {
      type: "string",
      enum: ["video", "website", "blog", "social_media", "unknown"],
    },
    platform: {
      type: ["string", "null"],
    },
    domain: {
      type: ["string", "null"],
    },
    description: {
      type: ["string", "null"],
    },
  },
  required: ["id", "recipeId", "url"],
};

/**
 * RxDBRecipeAdapter class
 * Provides methods for storing and querying recipe data using RxDB with SQLite adapter
 */
class RxDBRecipeAdapter {
  /**
   * Constructor
   * @param {Object} options Options for the adapter
   * @param {string} options.filename Path to the SQLite database file
   * @param {Object} options.sqliteOptions Options for better-sqlite3
   */
  constructor(options = {}) {
    this.filename =
      options.filename ||
      path.join(process.cwd(), "rxdb-recipe-database.sqlite");
    this.sqliteOptions = options.sqliteOptions || {};
    this.db = null;
    this.collections = null;
    this.initialized = false;
  }

  /**
   * Initialize the adapter
   * Creates the database and collections if they don't exist
   */
  async initialize() {
    if (this.initialized) {
      return this;
    }

    console.log("Creating RxDB database with SQLite adapter...");

    // Create the database with the SQLite adapter
    this.db = await createRxDatabase({
      name: "recipedb",
      storage: getRxStorageSQLite({
        // Path to the SQLite database file
        filename: this.filename,
      }),
    });

    console.log("Database created");

    // Create the collections
    this.collections = await this.db.addCollections({
      recipes: {
        schema: recipeSchema,
      },
      ingredients: {
        schema: ingredientSchema,
      },
      categories: {
        schema: categorySchema,
      },
      cuisines: {
        schema: cuisineSchema,
      },
      recipeIngredients: {
        schema: recipeIngredientSchema,
      },
      units: {
        schema: unitSchema,
      },
      sources: {
        schema: sourceSchema,
      },
    });

    console.log("Collections created");

    this.initialized = true;
    return this;
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.db) {
      await this.db.remove();
      this.db = null;
      this.collections = null;
      this.initialized = false;
      console.log("Database closed");
    }
  }

  /**
   * Insert or update a recipe
   * @param {Object} recipe The recipe to insert or update
   * @returns {Promise<Object>} The inserted or updated recipe
   */
  async upsertRecipe(recipe) {
    this._ensureInitialized();

    try {
      // Check if recipe exists
      const existingRecipe = await this.collections.recipes
        .findOne({
          selector: {
            id: recipe.id,
          },
        })
        .exec();

      if (existingRecipe) {
        // Update existing recipe
        await existingRecipe.patch({
          name: recipe.name,
          categoryId: recipe.categoryId,
          cuisineId: recipe.cuisineId,
          instructions: recipe.instructions,
          originalInstructions:
            recipe.originalInstructions || recipe.instructions,
          thumbnail: recipe.thumbnail,
          tags: recipe.tags || [],
          updatedAt: recipe.updatedAt || new Date().toISOString(),
        });
        return existingRecipe.toJSON();
      } else {
        // Insert new recipe
        const newRecipe = await this.collections.recipes.insert({
          ...recipe,
          tags: recipe.tags || [],
          createdAt: recipe.createdAt || new Date().toISOString(),
          updatedAt: recipe.updatedAt || new Date().toISOString(),
        });
        return newRecipe.toJSON();
      }
    } catch (error) {
      console.error("Error upserting recipe:", error);
      throw error;
    }
  }

  /**
   * Insert or update multiple recipes
   * @param {Array<Object>} recipes The recipes to insert or update
   * @returns {Promise<Array<Object>>} The inserted or updated recipes
   */
  async upsertRecipes(recipes) {
    this._ensureInitialized();

    const results = [];
    for (const recipe of recipes) {
      const result = await this.upsertRecipe(recipe);
      results.push(result);
    }
    return results;
  }

  /**
   * Insert or update an ingredient
   * @param {Object} ingredient The ingredient to insert or update
   * @returns {Promise<Object>} The inserted or updated ingredient
   */
  async upsertIngredient(ingredient) {
    this._ensureInitialized();

    try {
      // Check if ingredient exists
      const existingIngredient = await this.collections.ingredients
        .findOne({
          selector: {
            id: ingredient.id,
          },
        })
        .exec();

      if (existingIngredient) {
        // Update existing ingredient
        await existingIngredient.patch({
          name: ingredient.name,
          isPlural: ingredient.isPlural,
          category: ingredient.category,
        });
        return existingIngredient.toJSON();
      } else {
        // Insert new ingredient
        const newIngredient = await this.collections.ingredients.insert(
          ingredient
        );
        return newIngredient.toJSON();
      }
    } catch (error) {
      console.error("Error upserting ingredient:", error);
      throw error;
    }
  }

  /**
   * Insert or update multiple ingredients
   * @param {Array<Object>} ingredients The ingredients to insert or update
   * @returns {Promise<Array<Object>>} The inserted or updated ingredients
   */
  async upsertIngredients(ingredients) {
    this._ensureInitialized();

    const results = [];
    for (const ingredient of ingredients) {
      const result = await this.upsertIngredient(ingredient);
      results.push(result);
    }
    return results;
  }

  /**
   * Insert or update a recipe ingredient relationship
   * @param {Object} recipeIngredient The recipe ingredient relationship to insert or update
   * @returns {Promise<Object>} The inserted or updated recipe ingredient relationship
   */
  async upsertRecipeIngredient(recipeIngredient) {
    this._ensureInitialized();

    try {
      // Check if recipe ingredient exists
      const existingRecipeIngredient = await this.collections.recipeIngredients
        .findOne({
          selector: {
            id: recipeIngredient.id,
          },
        })
        .exec();

      if (existingRecipeIngredient) {
        // Update existing recipe ingredient
        await existingRecipeIngredient.patch({
          recipeId: recipeIngredient.recipeId,
          ingredientId: recipeIngredient.ingredientId,
          originalMeasure: recipeIngredient.originalMeasure,
          quantity: recipeIngredient.quantity,
          unit: recipeIngredient.unit,
          additionalInfo: recipeIngredient.additionalInfo,
        });
        return existingRecipeIngredient.toJSON();
      } else {
        // Insert new recipe ingredient
        const newRecipeIngredient =
          await this.collections.recipeIngredients.insert(recipeIngredient);
        return newRecipeIngredient.toJSON();
      }
    } catch (error) {
      console.error("Error upserting recipe ingredient:", error);
      throw error;
    }
  }

  /**
   * Insert or update multiple recipe ingredient relationships
   * @param {Array<Object>} recipeIngredients The recipe ingredient relationships to insert or update
   * @returns {Promise<Array<Object>>} The inserted or updated recipe ingredient relationships
   */
  async upsertRecipeIngredients(recipeIngredients) {
    this._ensureInitialized();

    const results = [];
    for (const recipeIngredient of recipeIngredients) {
      const result = await this.upsertRecipeIngredient(recipeIngredient);
      results.push(result);
    }
    return results;
  }

  /**
   * Insert or update a category
   * @param {Object} category The category to insert or update
   * @returns {Promise<Object>} The inserted or updated category
   */
  async upsertCategory(category) {
    this._ensureInitialized();

    try {
      // Check if category exists
      const existingCategory = await this.collections.categories
        .findOne({
          selector: {
            id: category.id,
          },
        })
        .exec();

      if (existingCategory) {
        // Update existing category
        await existingCategory.patch({
          name: category.name,
        });
        return existingCategory.toJSON();
      } else {
        // Insert new category
        const newCategory = await this.collections.categories.insert(category);
        return newCategory.toJSON();
      }
    } catch (error) {
      console.error("Error upserting category:", error);
      throw error;
    }
  }

  /**
   * Insert or update multiple categories
   * @param {Array<Object>} categories The categories to insert or update
   * @returns {Promise<Array<Object>>} The inserted or updated categories
   */
  async upsertCategories(categories) {
    this._ensureInitialized();

    const results = [];
    for (const category of categories) {
      const result = await this.upsertCategory(category);
      results.push(result);
    }
    return results;
  }

  /**
   * Insert or update a cuisine
   * @param {Object} cuisine The cuisine to insert or update
   * @returns {Promise<Object>} The inserted or updated cuisine
   */
  async upsertCuisine(cuisine) {
    this._ensureInitialized();

    try {
      // Check if cuisine exists
      const existingCuisine = await this.collections.cuisines
        .findOne({
          selector: {
            id: cuisine.id,
          },
        })
        .exec();

      if (existingCuisine) {
        // Update existing cuisine
        await existingCuisine.patch({
          name: cuisine.name,
        });
        return existingCuisine.toJSON();
      } else {
        // Insert new cuisine
        const newCuisine = await this.collections.cuisines.insert(cuisine);
        return newCuisine.toJSON();
      }
    } catch (error) {
      console.error("Error upserting cuisine:", error);
      throw error;
    }
  }

  /**
   * Insert or update multiple cuisines
   * @param {Array<Object>} cuisines The cuisines to insert or update
   * @returns {Promise<Array<Object>>} The inserted or updated cuisines
   */
  async upsertCuisines(cuisines) {
    this._ensureInitialized();

    const results = [];
    for (const cuisine of cuisines) {
      const result = await this.upsertCuisine(cuisine);
      results.push(result);
    }
    return results;
  }

  /**
   * Insert or update a unit
   * @param {Object} unit The unit to insert or update
   * @returns {Promise<Object>} The inserted or updated unit
   */
  async upsertUnit(unit) {
    this._ensureInitialized();

    try {
      // Check if unit exists
      const existingUnit = await this.collections.units
        .findOne({
          selector: {
            id: unit.id,
          },
        })
        .exec();

      if (existingUnit) {
        // Update existing unit
        await existingUnit.patch({
          name: unit.name,
          abbreviation: unit.abbreviation,
          type: unit.type,
        });
        return existingUnit.toJSON();
      } else {
        // Insert new unit
        const newUnit = await this.collections.units.insert(unit);
        return newUnit.toJSON();
      }
    } catch (error) {
      console.error("Error upserting unit:", error);
      throw error;
    }
  }

  /**
   * Insert or update multiple units
   * @param {Array<Object>} units The units to insert or update
   * @returns {Promise<Array<Object>>} The inserted or updated units
   */
  async upsertUnits(units) {
    this._ensureInitialized();

    const results = [];
    for (const unit of units) {
      const result = await this.upsertUnit(unit);
      results.push(result);
    }
    return results;
  }

  /**
   * Insert or update a source
   * @param {Object} source The source to insert or update
   * @returns {Promise<Object>} The inserted or updated source
   */
  async upsertSource(source) {
    this._ensureInitialized();

    try {
      // Check if source exists
      const existingSource = await this.collections.sources
        .findOne({
          selector: {
            id: source.id,
          },
        })
        .exec();

      if (existingSource) {
        // Update existing source
        await existingSource.patch({
          recipeId: source.recipeId,
          url: source.url,
          type: source.type,
          platform: source.platform,
          domain: source.domain,
          description: source.description,
        });
        return existingSource.toJSON();
      } else {
        // Insert new source
        const newSource = await this.collections.sources.insert(source);
        return newSource.toJSON();
      }
    } catch (error) {
      console.error("Error upserting source:", error);
      throw error;
    }
  }

  /**
   * Insert or update multiple sources
   * @param {Array<Object>} sources The sources to insert or update
   * @returns {Promise<Array<Object>>} The inserted or updated sources
   */
  async upsertSources(sources) {
    this._ensureInitialized();

    const results = [];
    for (const source of sources) {
      const result = await this.upsertSource(source);
      results.push(result);
    }
    return results;
  }

  /**
   * Get a recipe by ID
   * @param {string} id The recipe ID
   * @returns {Promise<Object|null>} The recipe or null if not found
   */
  async getRecipeById(id) {
    this._ensureInitialized();

    try {
      const recipe = await this.collections.recipes
        .findOne({
          selector: {
            id,
          },
        })
        .exec();

      return recipe ? recipe.toJSON() : null;
    } catch (error) {
      console.error("Error getting recipe by ID:", error);
      throw error;
    }
  }

  /**
   * Get an ingredient by ID
   * @param {string} id The ingredient ID
   * @returns {Promise<Object|null>} The ingredient or null if not found
   */
  async getIngredientById(id) {
    this._ensureInitialized();

    try {
      const ingredient = await this.collections.ingredients
        .findOne({
          selector: {
            id,
          },
        })
        .exec();

      return ingredient ? ingredient.toJSON() : null;
    } catch (error) {
      console.error("Error getting ingredient by ID:", error);
      throw error;
    }
  }

  /**
   * Get all recipes
   * @returns {Promise<Array<Object>>} All recipes
   */
  async getAllRecipes() {
    this._ensureInitialized();

    try {
      const recipes = await this.collections.recipes.find().exec();
      return recipes.map((recipe) => recipe.toJSON());
    } catch (error) {
      console.error("Error getting all recipes:", error);
      throw error;
    }
  }

  /**
   * Get all ingredients
   * @returns {Promise<Array<Object>>} All ingredients
   */
  async getAllIngredients() {
    this._ensureInitialized();

    try {
      const ingredients = await this.collections.ingredients.find().exec();
      return ingredients.map((ingredient) => ingredient.toJSON());
    } catch (error) {
      console.error("Error getting all ingredients:", error);
      throw error;
    }
  }

  /**
   * Get all categories
   * @returns {Promise<Array<Object>>} All categories
   */
  async getAllCategories() {
    this._ensureInitialized();

    try {
      const categories = await this.collections.categories.find().exec();
      return categories.map((category) => category.toJSON());
    } catch (error) {
      console.error("Error getting all categories:", error);
      throw error;
    }
  }

  /**
   * Get all cuisines
   * @returns {Promise<Array<Object>>} All cuisines
   */
  async getAllCuisines() {
    this._ensureInitialized();

    try {
      const cuisines = await this.collections.cuisines.find().exec();
      return cuisines.map((cuisine) => cuisine.toJSON());
    } catch (error) {
      console.error("Error getting all cuisines:", error);
      throw error;
    }
  }

  /**
   * Get recipes by category
   * @param {string} categoryId The category ID
   * @returns {Promise<Array<Object>>} Recipes in the category
   */
  async getRecipesByCategory(categoryId) {
    this._ensureInitialized();

    try {
      const recipes = await this.collections.recipes
        .find({
          selector: {
            categoryId,
          },
        })
        .exec();

      return recipes.map((recipe) => recipe.toJSON());
    } catch (error) {
      console.error("Error getting recipes by category:", error);
      throw error;
    }
  }

  /**
   * Get recipes by cuisine
   * @param {string} cuisineId The cuisine ID
   * @returns {Promise<Array<Object>>} Recipes in the cuisine
   */
  async getRecipesByCuisine(cuisineId) {
    this._ensureInitialized();

    try {
      const recipes = await this.collections.recipes
        .find({
          selector: {
            cuisineId,
          },
        })
        .exec();

      return recipes.map((recipe) => recipe.toJSON());
    } catch (error) {
      console.error("Error getting recipes by cuisine:", error);
      throw error;
    }
  }

  /**
   * Get recipes by ingredient
   * @param {string} ingredientId The ingredient ID
   * @returns {Promise<Array<Object>>} Recipes that use the ingredient
   */
  async getRecipesByIngredient(ingredientId) {
    this._ensureInitialized();

    try {
      // Get recipe IDs that use this ingredient
      const recipeIngredients = await this.collections.recipeIngredients
        .find({
          selector: {
            ingredientId,
          },
        })
        .exec();

      const recipeIds = recipeIngredients.map((ri) => ri.get("recipeId"));

      if (recipeIds.length === 0) {
        return [];
      }

      // Get recipes by IDs
      const recipes = await this.collections.recipes
        .find({
          selector: {
            id: {
              $in: recipeIds,
            },
          },
        })
        .exec();

      return recipes.map((recipe) => recipe.toJSON());
    } catch (error) {
      console.error("Error getting recipes by ingredient:", error);
      throw error;
    }
  }

  /**
   * Search recipes by name
   * @param {string} query The search query
   * @returns {Promise<Array<Object>>} Matching recipes
   */
  async searchRecipesByName(query) {
    this._ensureInitialized();

    try {
      const recipes = await this.collections.recipes
        .find({
          selector: {
            name: {
              $regex: new RegExp(query, "i"),
            },
          },
        })
        .exec();

      return recipes.map((recipe) => recipe.toJSON());
    } catch (error) {
      console.error("Error searching recipes by name:", error);
      throw error;
    }
  }

  /**
   * Get a complete recipe with all related data
   * @param {string} recipeId The recipe ID
   * @returns {Promise<Object|null>} The complete recipe or null if not found
   */
  async getCompleteRecipe(recipeId) {
    this._ensureInitialized();

    try {
      // Get the recipe
      const recipe = await this.getRecipeById(recipeId);

      if (!recipe) {
        return null;
      }

      // Get category
      const category = await this.collections.categories
        .findOne({
          selector: {
            id: recipe.categoryId,
          },
        })
        .exec();

      // Get cuisine
      const cuisine = await this.collections.cuisines
        .findOne({
          selector: {
            id: recipe.cuisineId,
          },
        })
        .exec();

      // Get recipe ingredients
      const recipeIngredients = await this.collections.recipeIngredients
        .find({
          selector: {
            recipeId,
          },
        })
        .exec();

      // Get ingredients
      const ingredients = [];
      for (const ri of recipeIngredients) {
        const ingredient = await this.collections.ingredients
          .findOne({
            selector: {
              id: ri.get("ingredientId"),
            },
          })
          .exec();

        if (ingredient) {
          ingredients.push({
            ...ri.toJSON(),
            ingredient: ingredient.toJSON(),
          });
        }
      }

      // Get sources
      const sources = await this.collections.sources
        .find({
          selector: {
            recipeId,
          },
        })
        .exec();

      return {
        ...recipe,
        category: category ? category.toJSON() : null,
        cuisine: cuisine ? cuisine.toJSON() : null,
        ingredients,
        sources: sources.map((source) => source.toJSON()),
      };
    } catch (error) {
      console.error("Error getting complete recipe:", error);
      throw error;
    }
  }

  /**
   * Import data from a normalized data object
   * @param {Object} data The normalized data object
   */
  async importNormalizedData(data) {
    this._ensureInitialized();

    try {
      // Insert categories
      if (data.categories && data.categories.length > 0) {
        console.log(`Inserting ${data.categories.length} categories...`);
        await this.upsertCategories(data.categories);
      }

      // Insert cuisines
      if (data.cuisines && data.cuisines.length > 0) {
        console.log(`Inserting ${data.cuisines.length} cuisines...`);
        await this.upsertCuisines(data.cuisines);
      }

      // Insert ingredients
      if (data.ingredients && data.ingredients.length > 0) {
        console.log(`Inserting ${data.ingredients.length} ingredients...`);
        await this.upsertIngredients(data.ingredients);
      }

      // Insert units
      if (data.units && data.units.length > 0) {
        console.log(`Inserting ${data.units.length} units...`);
        await this.upsertUnits(data.units);
      }

      // Insert recipes
      if (data.recipes && data.recipes.length > 0) {
        console.log(`Inserting ${data.recipes.length} recipes...`);
        await this.upsertRecipes(data.recipes);
      }

      // Insert recipe ingredients
      if (data.recipeIngredients && data.recipeIngredients.length > 0) {
        console.log(
          `Inserting ${data.recipeIngredients.length} recipe-ingredient relationships...`
        );
        await this.upsertRecipeIngredients(data.recipeIngredients);
      }

      // Insert sources
      if (data.sources && data.sources.length > 0) {
        console.log(`Inserting ${data.sources.length} sources...`);
        await this.upsertSources(data.sources);
      }

      console.log("Data import completed");
    } catch (error) {
      console.error("Error importing normalized data:", error);
      throw error;
    }
  }

  /**
   * Export all data as a normalized data object
   * @returns {Promise<Object>} The normalized data object
   */
  async exportNormalizedData() {
    this._ensureInitialized();

    try {
      const recipes = await this.getAllRecipes();
      const ingredients = await this.getAllIngredients();
      const categories = await this.getAllCategories();
      const cuisines = await this.getAllCuisines();

      const recipeIngredients = await this.collections.recipeIngredients
        .find()
        .exec();
      const units = await this.collections.units.find().exec();
      const sources = await this.collections.sources.find().exec();

      return {
        recipes,
        ingredients,
        categories,
        cuisines,
        recipeIngredients: recipeIngredients.map((ri) => ri.toJSON()),
        units: units.map((unit) => unit.toJSON()),
        sources: sources.map((source) => source.toJSON()),
      };
    } catch (error) {
      console.error("Error exporting normalized data:", error);
      throw error;
    }
  }

  /**
   * Ensure the adapter is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error(
        "RxDBRecipeAdapter is not initialized. Call initialize() first."
      );
    }
  }
}

module.exports = RxDBRecipeAdapter;
