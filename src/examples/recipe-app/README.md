# RxDB SQLite Recipe App

This project demonstrates using the RxDB SQLite adapter for a real-world application: a recipe database. It serves as a practical test case for the adapter, applying the "dogfood principle" by using it in both the input pipeline and as the backend database.

It fetches recipes from TheMealDB API, stores them in a SQLite database using RxDB, and provides functionality to search and display recipes.

## Features

- Fetch recipes from TheMealDB API
- Store recipes in a SQLite database using RxDB
- Search recipes by name, ingredient, category, or cuisine
- Display recipe details including ingredients and instructions
- Export recipes as JSON

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

### Usage

1. Fetch recipes from TheMealDB API and store them in the database:

```bash
npm run fetch
```

This will:
- Fetch up to 100 recipes from TheMealDB API
- Store them in a SQLite database using RxDB
- Export the recipes as JSON to the `output` directory

2. Run the recipe app:

```bash
npm run start
```

This will:
- Connect to the SQLite database
- Display recipe statistics
- Demonstrate various queries (search by name, ingredient, category, cuisine)
- Display sample recipes

## Database Schema

The database uses a relational schema with the following tables:

- **recipes**: Core recipe information
- **ingredients**: Unique ingredients with metadata
- **recipe_ingredients**: Junction table linking recipes to ingredients
- **metadata**: Consolidated table for categories, cuisines, and other metadata
- **sources**: Recipe sources (videos, websites, etc.)

Original recipe instructions are stored as separate text files to keep the database lean.

For detailed schema information, see [README.schema.md](./README.schema.md).

## Query Examples

The app demonstrates various query capabilities of the RxDB SQLite adapter:

### Search by Name

```typescript
const recipes = await db.recipes.find({
  selector: {
    name: {
      $regex: new RegExp(searchTerm, 'i')
    }
  }
}).exec();
```

### Search by Category

```typescript
const recipes = await db.recipes.find({
  selector: {
    category: {
      $eq: category
    }
  }
}).exec();
```

### Search by Cuisine

```typescript
const recipes = await db.recipes.find({
  selector: {
    area: {
      $eq: cuisine
    }
  }
}).exec();
```

## Testing the RxDB SQLite Adapter

This project serves as a practical test case for the RxDB SQLite adapter, demonstrating:

1. **Data Import**: Testing the adapter's ability to handle bulk data import
2. **Complex Queries**: Testing the adapter's query capabilities
3. **Relational Data**: Testing the adapter's handling of related data
4. **Performance**: Testing the adapter's performance with a reasonable data volume
5. **API Integration**: Testing the adapter in a real-world API scenario

By dogfooding the RxDB SQLite adapter in this project, we can validate its functionality and performance in a realistic use case before using it in production environments.

## Credits

- Recipe data from [TheMealDB API](https://www.themealdb.com/api.php)
- Built with [RxDB](https://rxdb.info/) and the RxDB SQLite adapter
