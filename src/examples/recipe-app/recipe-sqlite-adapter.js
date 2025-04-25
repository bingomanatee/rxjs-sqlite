/**
 * Recipe SQLite Adapter
 * A drop-in adapter for storing and querying recipe data in SQLite
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const mkdirAsync = promisify(fs.mkdir);

/**
 * RecipeSQLiteAdapter class
 * Provides methods for storing and querying recipe data in SQLite
 */
class RecipeSQLiteAdapter {
  /**
   * Constructor
   * @param {Object} options Options for the adapter
   * @param {string} options.filename Path to the SQLite database file
   * @param {Object} options.sqliteOptions Options for better-sqlite3
   */
  constructor(options = {}) {
    this.filename = options.filename || path.join(process.cwd(), 'recipe-database.sqlite');
    this.sqliteOptions = options.sqliteOptions || {};
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize the adapter
   * Creates the database and tables if they don't exist
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    // Create the database directory if it doesn't exist
    const dbDir = path.dirname(this.filename);
    await mkdirAsync(dbDir, { recursive: true });

    // Create or open the database
    this.db = new Database(this.filename, this.sqliteOptions);

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Create tables
    this._createTables();

    this.initialized = true;
    return this;
  }

  /**
   * Create the database tables
   * @private
   */
  _createTables() {
    // Categories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);

    // Cuisines table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cuisines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);

    // Ingredients table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        isPlural INTEGER NOT NULL,
        category TEXT
      )
    `);

    // Units table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS units (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        abbreviation TEXT,
        type TEXT
      )
    `);

    // Recipes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS recipes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        categoryId TEXT NOT NULL,
        cuisineId TEXT NOT NULL,
        instructions TEXT NOT NULL,
        originalInstructions TEXT,
        thumbnail TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (categoryId) REFERENCES categories(id),
        FOREIGN KEY (cuisineId) REFERENCES cuisines(id)
      )
    `);

    // Recipe tags table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS recipe_tags (
        id TEXT PRIMARY KEY,
        recipeId TEXT NOT NULL,
        tag TEXT NOT NULL,
        FOREIGN KEY (recipeId) REFERENCES recipes(id)
      )
    `);

    // Recipe ingredients table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id TEXT PRIMARY KEY,
        recipeId TEXT NOT NULL,
        ingredientId TEXT NOT NULL,
        originalMeasure TEXT,
        quantity REAL,
        unit TEXT,
        additionalInfo TEXT,
        FOREIGN KEY (recipeId) REFERENCES recipes(id),
        FOREIGN KEY (ingredientId) REFERENCES ingredients(id)
      )
    `);

    // Sources table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        recipeId TEXT NOT NULL,
        url TEXT NOT NULL,
        type TEXT,
        platform TEXT,
        domain TEXT,
        description TEXT,
        FOREIGN KEY (recipeId) REFERENCES recipes(id)
      )
    `);
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  /**
   * Insert or update a recipe
   * @param {Object} recipe The recipe to insert or update
   * @returns {Object} The inserted or updated recipe
   */
  upsertRecipe(recipe) {
    this._ensureInitialized();

    const insertRecipe = this.db.prepare(`
      INSERT OR REPLACE INTO recipes (
        id, name, categoryId, cuisineId, instructions, originalInstructions, thumbnail, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert the recipe
    insertRecipe.run(
      recipe.id,
      recipe.name,
      recipe.categoryId,
      recipe.cuisineId,
      recipe.instructions,
      recipe.originalInstructions || recipe.instructions,
      recipe.thumbnail,
      recipe.createdAt || new Date().toISOString(),
      recipe.updatedAt || new Date().toISOString()
    );

    // Insert tags if present
    if (recipe.tags && recipe.tags.length > 0) {
      const insertTag = this.db.prepare('INSERT OR REPLACE INTO recipe_tags (id, recipeId, tag) VALUES (?, ?, ?)');
      
      for (const tag of recipe.tags) {
        const tagId = `${recipe.id}_${tag.replace(/[^a-zA-Z0-9]/g, '')}`;
        insertTag.run(tagId, recipe.id, tag);
      }
    }

    return this.getRecipeById(recipe.id);
  }

  /**
   * Insert or update multiple recipes
   * @param {Array<Object>} recipes The recipes to insert or update
   * @returns {Array<Object>} The inserted or updated recipes
   */
  upsertRecipes(recipes) {
    this._ensureInitialized();

    // Begin transaction
    const transaction = this.db.transaction(() => {
      for (const recipe of recipes) {
        this.upsertRecipe(recipe);
      }
    });

    // Execute transaction
    transaction();

    return recipes.map(recipe => this.getRecipeById(recipe.id));
  }

  /**
   * Insert or update an ingredient
   * @param {Object} ingredient The ingredient to insert or update
   * @returns {Object} The inserted or updated ingredient
   */
  upsertIngredient(ingredient) {
    this._ensureInitialized();

    const insertIngredient = this.db.prepare('INSERT OR REPLACE INTO ingredients (id, name, isPlural, category) VALUES (?, ?, ?, ?)');
    
    insertIngredient.run(
      ingredient.id,
      ingredient.name,
      ingredient.isPlural ? 1 : 0,
      ingredient.category
    );

    return this.getIngredientById(ingredient.id);
  }

  /**
   * Insert or update multiple ingredients
   * @param {Array<Object>} ingredients The ingredients to insert or update
   * @returns {Array<Object>} The inserted or updated ingredients
   */
  upsertIngredients(ingredients) {
    this._ensureInitialized();

    // Begin transaction
    const transaction = this.db.transaction(() => {
      for (const ingredient of ingredients) {
        this.upsertIngredient(ingredient);
      }
    });

    // Execute transaction
    transaction();

    return ingredients.map(ingredient => this.getIngredientById(ingredient.id));
  }

  /**
   * Insert or update a recipe ingredient relationship
   * @param {Object} recipeIngredient The recipe ingredient relationship to insert or update
   * @returns {Object} The inserted or updated recipe ingredient relationship
   */
  upsertRecipeIngredient(recipeIngredient) {
    this._ensureInitialized();

    const insertRecipeIngredient = this.db.prepare(`
      INSERT OR REPLACE INTO recipe_ingredients (
        id, recipeId, ingredientId, originalMeasure, quantity, unit, additionalInfo
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertRecipeIngredient.run(
      recipeIngredient.id,
      recipeIngredient.recipeId,
      recipeIngredient.ingredientId,
      recipeIngredient.originalMeasure,
      recipeIngredient.quantity,
      recipeIngredient.unit,
      recipeIngredient.additionalInfo
    );

    return this.getRecipeIngredientById(recipeIngredient.id);
  }

  /**
   * Insert or update multiple recipe ingredient relationships
   * @param {Array<Object>} recipeIngredients The recipe ingredient relationships to insert or update
   * @returns {Array<Object>} The inserted or updated recipe ingredient relationships
   */
  upsertRecipeIngredients(recipeIngredients) {
    this._ensureInitialized();

    // Begin transaction
    const transaction = this.db.transaction(() => {
      for (const recipeIngredient of recipeIngredients) {
        this.upsertRecipeIngredient(recipeIngredient);
      }
    });

    // Execute transaction
    transaction();

    return recipeIngredients.map(ri => this.getRecipeIngredientById(ri.id));
  }

  /**
   * Insert or update a category
   * @param {Object} category The category to insert or update
   * @returns {Object} The inserted or updated category
   */
  upsertCategory(category) {
    this._ensureInitialized();

    const insertCategory = this.db.prepare('INSERT OR REPLACE INTO categories (id, name) VALUES (?, ?)');
    
    insertCategory.run(
      category.id,
      category.name
    );

    return this.getCategoryById(category.id);
  }

  /**
   * Insert or update multiple categories
   * @param {Array<Object>} categories The categories to insert or update
   * @returns {Array<Object>} The inserted or updated categories
   */
  upsertCategories(categories) {
    this._ensureInitialized();

    // Begin transaction
    const transaction = this.db.transaction(() => {
      for (const category of categories) {
        this.upsertCategory(category);
      }
    });

    // Execute transaction
    transaction();

    return categories.map(category => this.getCategoryById(category.id));
  }

  /**
   * Insert or update a cuisine
   * @param {Object} cuisine The cuisine to insert or update
   * @returns {Object} The inserted or updated cuisine
   */
  upsertCuisine(cuisine) {
    this._ensureInitialized();

    const insertCuisine = this.db.prepare('INSERT OR REPLACE INTO cuisines (id, name) VALUES (?, ?)');
    
    insertCuisine.run(
      cuisine.id,
      cuisine.name
    );

    return this.getCuisineById(cuisine.id);
  }

  /**
   * Insert or update multiple cuisines
   * @param {Array<Object>} cuisines The cuisines to insert or update
   * @returns {Array<Object>} The inserted or updated cuisines
   */
  upsertCuisines(cuisines) {
    this._ensureInitialized();

    // Begin transaction
    const transaction = this.db.transaction(() => {
      for (const cuisine of cuisines) {
        this.upsertCuisine(cuisine);
      }
    });

    // Execute transaction
    transaction();

    return cuisines.map(cuisine => this.getCuisineById(cuisine.id));
  }

  /**
   * Insert or update a unit
   * @param {Object} unit The unit to insert or update
   * @returns {Object} The inserted or updated unit
   */
  upsertUnit(unit) {
    this._ensureInitialized();

    const insertUnit = this.db.prepare('INSERT OR REPLACE INTO units (id, name, abbreviation, type) VALUES (?, ?, ?, ?)');
    
    insertUnit.run(
      unit.id,
      unit.name,
      unit.abbreviation,
      unit.type
    );

    return this.getUnitById(unit.id);
  }

  /**
   * Insert or update multiple units
   * @param {Array<Object>} units The units to insert or update
   * @returns {Array<Object>} The inserted or updated units
   */
  upsertUnits(units) {
    this._ensureInitialized();

    // Begin transaction
    const transaction = this.db.transaction(() => {
      for (const unit of units) {
        this.upsertUnit(unit);
      }
    });

    // Execute transaction
    transaction();

    return units.map(unit => this.getUnitById(unit.id));
  }

  /**
   * Insert or update a source
   * @param {Object} source The source to insert or update
   * @returns {Object} The inserted or updated source
   */
  upsertSource(source) {
    this._ensureInitialized();

    const insertSource = this.db.prepare(`
      INSERT OR REPLACE INTO sources (
        id, recipeId, url, type, platform, domain, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertSource.run(
      source.id,
      source.recipeId,
      source.url,
      source.type,
      source.platform,
      source.domain,
      source.description
    );

    return this.getSourceById(source.id);
  }

  /**
   * Insert or update multiple sources
   * @param {Array<Object>} sources The sources to insert or update
   * @returns {Array<Object>} The inserted or updated sources
   */
  upsertSources(sources) {
    this._ensureInitialized();

    // Begin transaction
    const transaction = this.db.transaction(() => {
      for (const source of sources) {
        this.upsertSource(source);
      }
    });

    // Execute transaction
    transaction();

    return sources.map(source => this.getSourceById(source.id));
  }

  /**
   * Get a recipe by ID
   * @param {string} id The recipe ID
   * @returns {Object|null} The recipe or null if not found
   */
  getRecipeById(id) {
    this._ensureInitialized();

    const recipe = this.db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
    
    if (!recipe) {
      return null;
    }

    // Get tags
    const tags = this.db.prepare('SELECT tag FROM recipe_tags WHERE recipeId = ?').all(id).map(row => row.tag);
    recipe.tags = tags;

    return recipe;
  }

  /**
   * Get an ingredient by ID
   * @param {string} id The ingredient ID
   * @returns {Object|null} The ingredient or null if not found
   */
  getIngredientById(id) {
    this._ensureInitialized();

    const ingredient = this.db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
    
    if (ingredient) {
      // Convert isPlural from INTEGER to boolean
      ingredient.isPlural = !!ingredient.isPlural;
    }
    
    return ingredient || null;
  }

  /**
   * Get a recipe ingredient relationship by ID
   * @param {string} id The recipe ingredient relationship ID
   * @returns {Object|null} The recipe ingredient relationship or null if not found
   */
  getRecipeIngredientById(id) {
    this._ensureInitialized();

    return this.db.prepare('SELECT * FROM recipe_ingredients WHERE id = ?').get(id) || null;
  }

  /**
   * Get a category by ID
   * @param {string} id The category ID
   * @returns {Object|null} The category or null if not found
   */
  getCategoryById(id) {
    this._ensureInitialized();

    return this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id) || null;
  }

  /**
   * Get a cuisine by ID
   * @param {string} id The cuisine ID
   * @returns {Object|null} The cuisine or null if not found
   */
  getCuisineById(id) {
    this._ensureInitialized();

    return this.db.prepare('SELECT * FROM cuisines WHERE id = ?').get(id) || null;
  }

  /**
   * Get a unit by ID
   * @param {string} id The unit ID
   * @returns {Object|null} The unit or null if not found
   */
  getUnitById(id) {
    this._ensureInitialized();

    return this.db.prepare('SELECT * FROM units WHERE id = ?').get(id) || null;
  }

  /**
   * Get a source by ID
   * @param {string} id The source ID
   * @returns {Object|null} The source or null if not found
   */
  getSourceById(id) {
    this._ensureInitialized();

    return this.db.prepare('SELECT * FROM sources WHERE id = ?').get(id) || null;
  }

  /**
   * Get all recipes
   * @returns {Array<Object>} All recipes
   */
  getAllRecipes() {
    this._ensureInitialized();

    const recipes = this.db.prepare('SELECT * FROM recipes').all();
    
    // Get tags for each recipe
    for (const recipe of recipes) {
      const tags = this.db.prepare('SELECT tag FROM recipe_tags WHERE recipeId = ?').all(recipe.id).map(row => row.tag);
      recipe.tags = tags;
    }

    return recipes;
  }

  /**
   * Get all ingredients
   * @returns {Array<Object>} All ingredients
   */
  getAllIngredients() {
    this._ensureInitialized();

    const ingredients = this.db.prepare('SELECT * FROM ingredients').all();
    
    // Convert isPlural from INTEGER to boolean
    for (const ingredient of ingredients) {
      ingredient.isPlural = !!ingredient.isPlural;
    }
    
    return ingredients;
  }

  /**
   * Get all recipe ingredient relationships
   * @returns {Array<Object>} All recipe ingredient relationships
   */
  getAllRecipeIngredients() {
    this._ensureInitialized();

    return this.db.prepare('SELECT * FROM recipe_ingredients').all();
  }

  /**
   * Get all categories
   * @returns {Array<Object>} All categories
   */
  getAllCategories() {
    this._ensureInitialized();

    return this.db.prepare('SELECT * FROM categories').all();
  }

  /**
   * Get all cuisines
   * @returns {Array<Object>} All cuisines
   */
  getAllCuisines() {
    this._ensureInitialized();

    return this.db.prepare('SELECT * FROM cuisines').all();
  }

  /**
   * Get all units
   * @returns {Array<Object>} All units
   */
  getAllUnits() {
    this._ensureInitialized();

    return this.db.prepare('SELECT * FROM units').all();
  }

  /**
   * Get all sources
   * @returns {Array<Object>} All sources
   */
  getAllSources() {
    this._ensureInitialized();

    return this.db.prepare('SELECT * FROM sources').all();
  }

  /**
   * Get recipes by category
   * @param {string} categoryId The category ID
   * @returns {Array<Object>} Recipes in the category
   */
  getRecipesByCategory(categoryId) {
    this._ensureInitialized();

    const recipes = this.db.prepare('SELECT * FROM recipes WHERE categoryId = ?').all(categoryId);
    
    // Get tags for each recipe
    for (const recipe of recipes) {
      const tags = this.db.prepare('SELECT tag FROM recipe_tags WHERE recipeId = ?').all(recipe.id).map(row => row.tag);
      recipe.tags = tags;
    }

    return recipes;
  }

  /**
   * Get recipes by cuisine
   * @param {string} cuisineId The cuisine ID
   * @returns {Array<Object>} Recipes in the cuisine
   */
  getRecipesByCuisine(cuisineId) {
    this._ensureInitialized();

    const recipes = this.db.prepare('SELECT * FROM recipes WHERE cuisineId = ?').all(cuisineId);
    
    // Get tags for each recipe
    for (const recipe of recipes) {
      const tags = this.db.prepare('SELECT tag FROM recipe_tags WHERE recipeId = ?').all(recipe.id).map(row => row.tag);
      recipe.tags = tags;
    }

    return recipes;
  }

  /**
   * Get recipes by ingredient
   * @param {string} ingredientId The ingredient ID
   * @returns {Array<Object>} Recipes that use the ingredient
   */
  getRecipesByIngredient(ingredientId) {
    this._ensureInitialized();

    const recipeIds = this.db.prepare(`
      SELECT recipeId FROM recipe_ingredients
      WHERE ingredientId = ?
    `).all(ingredientId).map(row => row.recipeId);

    if (recipeIds.length === 0) {
      return [];
    }

    const placeholders = recipeIds.map(() => '?').join(',');
    const recipes = this.db.prepare(`
      SELECT * FROM recipes
      WHERE id IN (${placeholders})
    `).all(...recipeIds);
    
    // Get tags for each recipe
    for (const recipe of recipes) {
      const tags = this.db.prepare('SELECT tag FROM recipe_tags WHERE recipeId = ?').all(recipe.id).map(row => row.tag);
      recipe.tags = tags;
    }

    return recipes;
  }

  /**
   * Get recipes by tag
   * @param {string} tag The tag
   * @returns {Array<Object>} Recipes with the tag
   */
  getRecipesByTag(tag) {
    this._ensureInitialized();

    const recipeIds = this.db.prepare(`
      SELECT recipeId FROM recipe_tags
      WHERE tag = ?
    `).all(tag).map(row => row.recipeId);

    if (recipeIds.length === 0) {
      return [];
    }

    const placeholders = recipeIds.map(() => '?').join(',');
    const recipes = this.db.prepare(`
      SELECT * FROM recipes
      WHERE id IN (${placeholders})
    `).all(...recipeIds);
    
    // Get tags for each recipe
    for (const recipe of recipes) {
      const tags = this.db.prepare('SELECT tag FROM recipe_tags WHERE recipeId = ?').all(recipe.id).map(row => row.tag);
      recipe.tags = tags;
    }

    return recipes;
  }

  /**
   * Get recipe ingredients by recipe
   * @param {string} recipeId The recipe ID
   * @returns {Array<Object>} Recipe ingredients for the recipe
   */
  getRecipeIngredientsByRecipe(recipeId) {
    this._ensureInitialized();

    return this.db.prepare(`
      SELECT ri.*, i.name as ingredientName, i.isPlural as ingredientIsPlural
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredientId = i.id
      WHERE ri.recipeId = ?
    `).all(recipeId);
  }

  /**
   * Get sources by recipe
   * @param {string} recipeId The recipe ID
   * @returns {Array<Object>} Sources for the recipe
   */
  getSourcesByRecipe(recipeId) {
    this._ensureInitialized();

    return this.db.prepare('SELECT * FROM sources WHERE recipeId = ?').all(recipeId);
  }

  /**
   * Search recipes by name
   * @param {string} query The search query
   * @returns {Array<Object>} Matching recipes
   */
  searchRecipesByName(query) {
    this._ensureInitialized();

    const recipes = this.db.prepare('SELECT * FROM recipes WHERE name LIKE ?').all(`%${query}%`);
    
    // Get tags for each recipe
    for (const recipe of recipes) {
      const tags = this.db.prepare('SELECT tag FROM recipe_tags WHERE recipeId = ?').all(recipe.id).map(row => row.tag);
      recipe.tags = tags;
    }

    return recipes;
  }

  /**
   * Search ingredients by name
   * @param {string} query The search query
   * @returns {Array<Object>} Matching ingredients
   */
  searchIngredientsByName(query) {
    this._ensureInitialized();

    const ingredients = this.db.prepare('SELECT * FROM ingredients WHERE name LIKE ?').all(`%${query}%`);
    
    // Convert isPlural from INTEGER to boolean
    for (const ingredient of ingredients) {
      ingredient.isPlural = !!ingredient.isPlural;
    }
    
    return ingredients;
  }

  /**
   * Get a complete recipe with all related data
   * @param {string} recipeId The recipe ID
   * @returns {Object|null} The complete recipe or null if not found
   */
  getCompleteRecipe(recipeId) {
    this._ensureInitialized();

    const recipe = this.getRecipeById(recipeId);
    
    if (!recipe) {
      return null;
    }

    // Get category
    recipe.category = this.getCategoryById(recipe.categoryId);

    // Get cuisine
    recipe.cuisine = this.getCuisineById(recipe.cuisineId);

    // Get ingredients
    const recipeIngredients = this.getRecipeIngredientsByRecipe(recipeId);
    recipe.ingredients = recipeIngredients.map(ri => ({
      ...ri,
      ingredient: this.getIngredientById(ri.ingredientId)
    }));

    // Get sources
    recipe.sources = this.getSourcesByRecipe(recipeId);

    return recipe;
  }

  /**
   * Import data from a normalized data object
   * @param {Object} data The normalized data object
   */
  importNormalizedData(data) {
    this._ensureInitialized();

    // Begin transaction
    const transaction = this.db.transaction(() => {
      // Insert categories
      if (data.categories && data.categories.length > 0) {
        console.log(`Inserting ${data.categories.length} categories...`);
        this.upsertCategories(data.categories);
      }

      // Insert cuisines
      if (data.cuisines && data.cuisines.length > 0) {
        console.log(`Inserting ${data.cuisines.length} cuisines...`);
        this.upsertCuisines(data.cuisines);
      }

      // Insert ingredients
      if (data.ingredients && data.ingredients.length > 0) {
        console.log(`Inserting ${data.ingredients.length} ingredients...`);
        this.upsertIngredients(data.ingredients);
      }

      // Insert units
      if (data.units && data.units.length > 0) {
        console.log(`Inserting ${data.units.length} units...`);
        this.upsertUnits(data.units);
      }

      // Insert recipes
      if (data.recipes && data.recipes.length > 0) {
        console.log(`Inserting ${data.recipes.length} recipes...`);
        this.upsertRecipes(data.recipes);
      }

      // Insert recipe ingredients
      if (data.recipeIngredients && data.recipeIngredients.length > 0) {
        console.log(`Inserting ${data.recipeIngredients.length} recipe-ingredient relationships...`);
        this.upsertRecipeIngredients(data.recipeIngredients);
      }

      // Insert sources
      if (data.sources && data.sources.length > 0) {
        console.log(`Inserting ${data.sources.length} sources...`);
        this.upsertSources(data.sources);
      }
    });

    // Execute transaction
    transaction();

    console.log('Data import completed');
  }

  /**
   * Export all data as a normalized data object
   * @returns {Object} The normalized data object
   */
  exportNormalizedData() {
    this._ensureInitialized();

    return {
      recipes: this.getAllRecipes(),
      ingredients: this.getAllIngredients(),
      categories: this.getAllCategories(),
      cuisines: this.getAllCuisines(),
      recipeIngredients: this.getAllRecipeIngredients(),
      units: this.getAllUnits(),
      sources: this.getAllSources()
    };
  }

  /**
   * Ensure the adapter is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('RecipeSQLiteAdapter is not initialized. Call initialize() first.');
    }
  }
}

module.exports = RecipeSQLiteAdapter;
