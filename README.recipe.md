# Recipe App Example

This fully functional recipe management application demonstrates how to use the
RxJS SQLite adapter in a practical scenario. It follows the "dogfood principle"
by using the adapter in a real application.

## Architecture

The Recipe App uses a server-client architecture:

- **Backend**: Node.js server with Express, using the RxJS SQLite adapter
- **Frontend**: Simple HTML/JavaScript client (with an optional React UI)

## Features

- Store and retrieve recipes with ingredients, instructions, and metadata
- Search recipes by name, tags, or ingredients
- View detailed recipe information
- Bookmark favorite recipes
- Handle complex data relationships (recipes, ingredients, tags)
- Demonstrate proper handling of nullable fields

## Running the Recipe App

### Starting the Server

```bash
# Install dependencies
npm install

# Start the server
npm run start
```

The server will start on http://localhost:3000 by default.

### Using the App

Once the server is running, you can:

1. Open your browser to http://localhost:3000
2. Browse the recipe list
3. Click on a recipe to view details
4. Use the search box to find recipes
5. Bookmark recipes by clicking the star icon

## Code Structure

The Recipe App consists of these main components:

### Backend (Node.js)

- `server/recipe-server.cjs`: Express server with API endpoints
- `server/data/`: SQLite database files

### Frontend

- `server/recipe-client.html`: Simple HTML client
- `recipe-ui/`: React-based UI (optional)

## API Endpoints

The server exposes these REST API endpoints:

- `GET /api/recipes`: List all recipes (paginated, with basic info)
- `GET /api/recipes/:id`: Get detailed recipe information
- `GET /api/recipes/search?q=query`: Search recipes
- `POST /api/recipes`: Create a new recipe
- `PUT /api/recipes/:id`: Update a recipe
- `DELETE /api/recipes/:id`: Delete a recipe
- `GET /api/ingredients`: List all ingredients
- `GET /api/tags`: List all tags

## Database Schema

The app uses these collections:

### Recipes Collection

```typescript
const recipeSchema = {
  title: 'recipe schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    preparationTime: { type: 'number' },
    cookingTime: { type: 'number' },
    servings: { type: 'number' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
    instructions: { type: 'string' },
    // Nullable fields using multi-type arrays
    imageUrl: { type: ['string', 'null'], default: null },
    sourceUrl: { type: ['string', 'null'], default: null },
    notes: { type: ['string', 'null'], default: null },
    // Arrays
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          amount: { type: 'number' },
          unit: { type: 'string' },
          notes: { type: ['string', 'null'], default: null }
        }
      }
    },
    tags: {
      type: 'array',
      items: { type: 'string' }
    },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id', 'name', 'instructions']
};
```

### Bookmarks Collection

```typescript
const bookmarkSchema = {
  title: 'bookmark schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string' },
    recipeId: { type: 'string' },
    userId: { type: 'string' },
    createdAt: { type: 'string' }
  },
  required: ['id', 'recipeId', 'userId']
};
```

## Key Implementation Details

### Database Setup

```typescript
// Create a database with the SQLite adapter
const db = await createRxDatabase({
  name: 'recipes',
  storage: getRxStorageSQLite({
    filename: './server/data/recipes.sqlite'
  }),
  // Dev mode with proper validation strategy for nullable fields
  devMode: true,
  validationStrategy: {
    validateBeforeInsert: true,
    validateBeforeSave: false,
    validateOnQuery: false
  }
});

// Add collections
const collections = await db.addCollections({
  recipes: { schema: recipeSchema },
  bookmarks: { schema: bookmarkSchema }
});
```

### Search Implementation

The search functionality demonstrates how to use the SQLite adapter's query
capabilities:

```typescript
// Search recipes by name, tags, or ingredients
app.get('/api/recipes/search', async (req, res) => {
  const query = req.query.q || '';
  
  if (!query) {
    return res.json([]);
  }
  
  try {
    // Use RxDB query with $or operator
    const results = await collections.recipes.find({
      selector: {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { 'tags': { $elemMatch: { $regex: query, $options: 'i' } } },
          { 'ingredients.name': { $regex: query, $options: 'i' } }
        ]
      }
    }).exec();
    
    res.json(results.map(doc => ({
      id: doc.id,
      name: doc.name,
      description: doc.description,
      tags: doc.tags
    })));
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});
```

### Direct SQLite Access

The app also demonstrates how to access the underlying SQLite database directly:

```typescript
// Get the SQLite database instance
const sqliteDb = getRxStorageSQLite.getDBByName('recipes');

// Execute a complex query directly with SQL
app.get('/api/recipes/popular', (req, res) => {
  try {
    // Use raw SQL for complex queries that are difficult to express with RxDB
    const results = sqliteDb.prepare(`
      SELECT r.id, r.name, COUNT(b.id) as bookmark_count
      FROM recipes_recipes r
      LEFT JOIN recipes_bookmarks b ON json_extract(b.data, '$.recipeId') = r.id
      GROUP BY r.id
      ORDER BY bookmark_count DESC
      LIMIT 10
    `).all();
    
    res.json(results);
  } catch (error) {
    console.error('Error getting popular recipes:', error);
    res.status(500).json({ error: 'Failed to get popular recipes' });
  }
});
```

## Learning from the Recipe App

This example demonstrates several important concepts:

1. **Proper Schema Design**: How to design schemas with nullable fields using
   multi-type arrays

2. **Validation Strategy**: How to configure validation to handle nullable fields
   correctly

3. **Query Patterns**: How to use RxDB queries and when to use direct SQLite
   access for complex queries

4. **Reactive Programming**: How to leverage RxJS observables for real-time
   updates

5. **Server-Client Architecture**: How to use the SQLite adapter in a Node.js
   backend while serving a browser frontend

By studying and extending this example, you'll gain practical experience with
the RxJS SQLite adapter in a realistic application context.
