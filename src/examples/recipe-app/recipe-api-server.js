/**
 * Recipe API Server
 * A simple API server that uses the RxDB SQLite adapter to serve recipe data
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const RxDBRecipeAdapter = require('./rxdb-recipe-adapter');

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON request body
app.use(express.json());

// Create and initialize the adapter
const adapter = new RxDBRecipeAdapter({
  filename: path.join(__dirname, 'rxdb-recipe-database.sqlite')
});

// API routes
app.get('/api/recipes', async (req, res) => {
  try {
    const recipes = await adapter.getAllRecipes();
    res.json(recipes);
  } catch (error) {
    console.error('Error getting recipes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/recipes/:id', async (req, res) => {
  try {
    const recipe = await adapter.getRecipeById(req.params.id);
    
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    res.json(recipe);
  } catch (error) {
    console.error('Error getting recipe:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/recipes/:id/complete', async (req, res) => {
  try {
    const recipe = await adapter.getCompleteRecipe(req.params.id);
    
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    res.json(recipe);
  } catch (error) {
    console.error('Error getting complete recipe:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await adapter.getAllCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/categories/:id/recipes', async (req, res) => {
  try {
    const recipes = await adapter.getRecipesByCategory(req.params.id);
    res.json(recipes);
  } catch (error) {
    console.error('Error getting recipes by category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/cuisines', async (req, res) => {
  try {
    const cuisines = await adapter.getAllCuisines();
    res.json(cuisines);
  } catch (error) {
    console.error('Error getting cuisines:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/cuisines/:id/recipes', async (req, res) => {
  try {
    const recipes = await adapter.getRecipesByCuisine(req.params.id);
    res.json(recipes);
  } catch (error) {
    console.error('Error getting recipes by cuisine:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/ingredients', async (req, res) => {
  try {
    const ingredients = await adapter.getAllIngredients();
    res.json(ingredients);
  } catch (error) {
    console.error('Error getting ingredients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/ingredients/:id/recipes', async (req, res) => {
  try {
    const recipes = await adapter.getRecipesByIngredient(req.params.id);
    res.json(recipes);
  } catch (error) {
    console.error('Error getting recipes by ingredient:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/search/recipes', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const recipes = await adapter.searchRecipesByName(query);
    res.json(recipes);
  } catch (error) {
    console.error('Error searching recipes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
async function startServer() {
  try {
    // Initialize the adapter
    await adapter.initialize();
    console.log('RxDB Recipe Adapter initialized');
    
    // Start the server
    app.listen(port, () => {
      console.log(`Recipe API server listening at http://localhost:${port}`);
    });
    
    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('Shutting down server...');
      await adapter.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
