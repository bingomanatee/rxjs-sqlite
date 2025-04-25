import axios from 'axios';

// API base URL
const API_URL = 'http://localhost:3001/api';

// API client
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Types
export interface PaginatedResponse<T> {
  recipes: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface RecipeListItem {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  categoryId: string;
  cuisineId: string;
}

export interface RecipeDetail {
  id: string;
  name: string;
  categoryId: string;
  cuisineId: string;
  instructions: string;
  thumbnail: string;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    type: string;
    value: string;
    displayName: string;
    description: string | null;
  } | null;
  cuisine: {
    id: string;
    type: string;
    value: string;
    displayName: string;
    description: string | null;
  } | null;
  steps: Array<{
    id: string;
    recipeId: string;
    stepNumber: number;
    instruction: string;
    duration: number;
    image: string | null;
  }>;
  ingredients: Array<{
    id: string;
    recipeId: string;
    ingredientId: string;
    originalMeasure: string;
    quantity: number;
    unit: string | null;
    additionalInfo: string | null;
    stepNumber: number;
    ingredient: {
      id: string;
      name: string;
      isPlural: boolean;
      category: string;
      description: string;
      nutritionalInfo: string;
      substitutes: string[];
    };
  }>;
}

export interface Metadata {
  id: string;
  type: string;
  value: string;
  displayName: string;
  description: string | null;
}

// API functions
export const fetchRecipes = async (page = 1, limit = 30) => {
  const response = await apiClient.get<PaginatedResponse<RecipeListItem>>(`/recipes?page=${page}&limit=${limit}`);
  return response.data;
};

export const fetchRecipeById = async (id: string) => {
  const response = await apiClient.get<RecipeDetail>(`/recipes/${id}`);
  return response.data;
};

export const searchRecipes = async (query: string, page = 1, limit = 30) => {
  const response = await apiClient.get<PaginatedResponse<RecipeListItem>>(`/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
  return response.data;
};

export const fetchMetadata = async (type?: string) => {
  const url = type ? `/metadata?type=${type}` : '/metadata';
  const response = await apiClient.get<Metadata[]>(url);
  return response.data;
};
