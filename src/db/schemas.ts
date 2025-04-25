/**
 * RxDB Schemas for the Recipe App
 * These schemas match the server-side schemas
 */
import { RxJsonSchema, RxCollection, RxDocument } from 'rxdb';

// Recipe types
export type RecipeDocType = {
  id: string;
  name: string;
  categoryId: string;
  cuisineId: string;
  description: string | null;
  instructions: string;
  thumbnail: string;
  createdAt: string;
  updatedAt: string;
};

export type RecipeDocMethods = {
  getCategoryName(categories: RxCollection): Promise<string>;
  getCuisineName(cuisines: RxCollection): Promise<string>;
  getIngredients(recipeIngredients: RxCollection): Promise<any[]>;
  getSteps(recipeSteps: RxCollection): Promise<any[]>;
};

export type RecipeDocument = RxDocument<RecipeDocType, RecipeDocMethods>;

export const recipeDocMethods: RecipeDocMethods = {
  async getCategoryName(categories) {
    if (!this.categoryId) return '';
    const category = await categories.findOne(this.categoryId).exec();
    return category ? category.get('displayName') : '';
  },
  async getCuisineName(cuisines) {
    if (!this.cuisineId) return '';
    const cuisine = await cuisines.findOne(this.cuisineId).exec();
    return cuisine ? cuisine.get('displayName') : '';
  },
  async getIngredients(recipeIngredients) {
    const ingredients = await recipeIngredients
      .find({
        selector: { recipeId: this.id }
      })
      .exec();
    return ingredients.map(ing => ing.toJSON());
  },
  async getSteps(recipeSteps) {
    const steps = await recipeSteps
      .find({
        selector: { recipeId: this.id },
        sort: [{ stepNumber: 'asc' }]
      })
      .exec();
    return steps.map(step => step.toJSON());
  }
};

// Recipe schema
export const recipeSchema: RxJsonSchema<RecipeDocType> = {
  title: 'recipe schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    categoryId: { type: 'string' },
    cuisineId: { type: 'string' },
    description: { type: ['string', 'null'], default: null },
    instructions: { type: 'string' },
    thumbnail: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id']
};

// Ingredient types
export type IngredientDocType = {
  id: string;
  name: string;
  isPlural: boolean;
  category: string;
  description: string;
  nutritionalInfo: string;
  substitutes: string[];
};

export type IngredientDocMethods = {
  getRecipes(recipeIngredients: RxCollection, recipes: RxCollection): Promise<any[]>;
  getFormattedName(): string;
};

export type IngredientDocument = RxDocument<IngredientDocType, IngredientDocMethods>;

export const ingredientDocMethods: IngredientDocMethods = {
  async getRecipes(recipeIngredients, recipes) {
    const relations = await recipeIngredients
      .find({
        selector: { ingredientId: this.id }
      })
      .exec();

    const recipeIds = relations.map(rel => rel.get('recipeId'));
    const recipeList = await recipes
      .find({
        selector: { id: { $in: recipeIds } }
      })
      .exec();

    return recipeList.map(recipe => recipe.toJSON());
  },
  getFormattedName() {
    return this.name + (this.isPlural ? '' : 's');
  }
};

// Ingredient schema
export const ingredientSchema: RxJsonSchema<IngredientDocType> = {
  title: 'ingredient schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    isPlural: { type: 'boolean' },
    category: { type: 'string' },
    description: { type: 'string' },
    nutritionalInfo: { type: 'string' },
    substitutes: { type: 'array', items: { type: 'string' } }
  },
  required: ['id']
};

// Metadata types
export type MetadataDocType = {
  id: string;
  type: string;
  value: string;
  displayName: string;
  description: string | null;
};

export type MetadataDocMethods = {
  getRecipesByType(recipes: RxCollection): Promise<any[]>;
};

export type MetadataDocument = RxDocument<MetadataDocType, MetadataDocMethods>;

export const metadataDocMethods: MetadataDocMethods = {
  async getRecipesByType(recipes) {
    // Different query based on metadata type
    if (this.type === 'category') {
      const recipeList = await recipes
        .find({
          selector: { categoryId: this.id }
        })
        .exec();
      return recipeList.map(recipe => recipe.toJSON());
    } else if (this.type === 'cuisine') {
      const recipeList = await recipes
        .find({
          selector: { cuisineId: this.id }
        })
        .exec();
      return recipeList.map(recipe => recipe.toJSON());
    }
    // For tags and other types, we would need a different approach
    return [];
  }
};

// Metadata schema (for categories, cuisines, tags)
export const metadataSchema: RxJsonSchema<MetadataDocType> = {
  title: 'metadata schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    type: { type: 'string' },
    value: { type: 'string' },
    displayName: { type: 'string' },
    description: { type: ['string', 'null'], default: null }
  },
  required: ['id']
};

// Recipe-Ingredient relationship types
export type RecipeIngredientDocType = {
  id: string;
  recipeId: string;
  ingredientId: string;
  originalMeasure: string;
  quantity: number;
  unit: string | null;
  additionalInfo: string | null;
  stepNumber: number;
};

export type RecipeIngredientDocMethods = {
  getRecipe(recipes: RxCollection): Promise<any>;
  getIngredient(ingredients: RxCollection): Promise<any>;
  getFormattedMeasure(): string;
};

export type RecipeIngredientDocument = RxDocument<RecipeIngredientDocType, RecipeIngredientDocMethods>;

export const recipeIngredientDocMethods: RecipeIngredientDocMethods = {
  async getRecipe(recipes) {
    const recipe = await recipes.findOne(this.recipeId).exec();
    return recipe ? recipe.toJSON() : null;
  },
  async getIngredient(ingredients) {
    const ingredient = await ingredients.findOne(this.ingredientId).exec();
    return ingredient ? ingredient.toJSON() : null;
  },
  getFormattedMeasure() {
    let measure = '';
    if (this.quantity) {
      measure += this.quantity;
      if (this.unit) {
        measure += ' ' + this.unit;
      }
    } else {
      measure = this.originalMeasure;
    }

    if (this.additionalInfo) {
      measure += ' (' + this.additionalInfo + ')';
    }

    return measure;
  }
};

// Recipe-Ingredient relationship schema
export const recipeIngredientSchema: RxJsonSchema<RecipeIngredientDocType> = {
  title: 'recipe ingredient schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    recipeId: { type: 'string' },
    ingredientId: { type: 'string' },
    originalMeasure: { type: 'string' },
    quantity: { type: 'number' },
    unit: { type: ['string', 'null'], default: null },
    additionalInfo: { type: ['string', 'null'], default: null },
    stepNumber: { type: 'number' }
  },
  required: ['id']
};

// Recipe step types
export type RecipeStepDocType = {
  id: string;
  recipeId: string;
  stepNumber: number;
  instruction: string;
  duration: number;
  image: string | null;
};

export type RecipeStepDocMethods = {
  getRecipe(recipes: RxCollection): Promise<any>;
  getFormattedDuration(): string;
  getIngredientsForStep(recipeIngredients: RxCollection): Promise<any[]>;
};

export type RecipeStepDocument = RxDocument<RecipeStepDocType, RecipeStepDocMethods>;

export const recipeStepDocMethods: RecipeStepDocMethods = {
  async getRecipe(recipes) {
    const recipe = await recipes.findOne(this.recipeId).exec();
    return recipe ? recipe.toJSON() : null;
  },
  getFormattedDuration() {
    const minutes = Math.floor(this.duration / 60);
    const seconds = this.duration % 60;

    if (minutes > 0) {
      return `${minutes} min${minutes > 1 ? 's' : ''}${seconds > 0 ? ` ${seconds} sec${seconds > 1 ? 's' : ''}` : ''}`;
    } else {
      return `${seconds} sec${seconds > 1 ? 's' : ''}`;
    }
  },
  async getIngredientsForStep(recipeIngredients) {
    const ingredients = await recipeIngredients
      .find({
        selector: {
          recipeId: this.recipeId,
          stepNumber: this.stepNumber
        }
      })
      .exec();

    return ingredients.map(ing => ing.toJSON());
  }
};

// Recipe step schema
export const recipeStepSchema: RxJsonSchema<RecipeStepDocType> = {
  title: 'recipe step schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    recipeId: { type: 'string' },
    stepNumber: { type: 'number' },
    instruction: { type: 'string' },
    duration: { type: 'number' },
    image: { type: ['string', 'null'], default: null }
  },
  required: ['id']
};

// Bookmark types
export type BookmarkDocType = {
  id: string;
  userId: string;
  recipeId: string;
  createdAt: string;
  notes: string | null;
};

export type BookmarkDocMethods = {
  getRecipe(recipes: RxCollection): Promise<any>;
};

export type BookmarkDocument = RxDocument<BookmarkDocType, BookmarkDocMethods>;

export const bookmarkDocMethods: BookmarkDocMethods = {
  async getRecipe(recipes) {
    const recipe = await recipes.findOne(this.recipeId).exec();
    return recipe ? recipe.toJSON() : null;
  }
};

// Bookmark schema
export const bookmarkSchema: RxJsonSchema<BookmarkDocType> = {
  title: 'bookmark schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    userId: { type: 'string', maxLength: 100 },
    recipeId: { type: 'string', maxLength: 100 },
    createdAt: { type: 'string' },
    notes: { type: ['string', 'null'], default: null }
  },
  required: ['id', 'userId', 'recipeId'],
  indexes: ['recipeId', 'userId']
};
