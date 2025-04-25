/**
 * Raw Query Example
 * 
 * This file demonstrates how to extend the RxDB SQLite adapter with a rawQuery method
 * to leverage SQLite's full capabilities like complex joins and full-text searches.
 */

// First, let's extend the SQLite adapter with a rawQuery method
const extendAdapterWithRawQuery = (adapter) => {
  // Add the rawQuery method to the adapter
  adapter.rawQuery = async (sql, params = []) => {
    // Ensure the adapter is initialized
    if (!adapter.db) {
      throw new Error('Adapter not initialized');
    }
    
    // Get the underlying better-sqlite3 database instance
    // This assumes the adapter has a way to access the underlying database
    const sqliteDb = adapter.db._sqlite;
    
    try {
      // Prepare the statement
      const stmt = sqliteDb.prepare(sql);
      
      // Check if this is a SELECT query
      const isSelect = sql.trim().toLowerCase().startsWith('select');
      
      if (isSelect) {
        // For SELECT queries, return all results
        return stmt.all(...params);
      } else {
        // For other queries (INSERT, UPDATE, DELETE), run and return info
        return stmt.run(...params);
      }
    } catch (error) {
      console.error('Error executing raw query:', error);
      throw error;
    }
  };
  
  // Add a reactive version that returns an Observable
  adapter.rawQueryObservable = (sql, params = []) => {
    const { Observable } = require('rxjs');
    
    return new Observable(subscriber => {
      try {
        // Execute the query
        const result = adapter.rawQuery(sql, params);
        
        // Emit the result
        subscriber.next(result);
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    });
  };
  
  return adapter;
};

// Example usage
const demonstrateRawQuery = async () => {
  const RxDBRecipeAdapter = require('./rxdb-recipe-adapter');
  const path = require('path');
  
  // Initialize the adapter
  const adapter = new RxDBRecipeAdapter({
    filename: path.join(__dirname, 'rxdb-recipe-database.sqlite')
  });
  
  await adapter.initialize();
  
  // Extend the adapter with raw query capabilities
  extendAdapterWithRawQuery(adapter);
  
  try {
    console.log('Demonstrating raw SQL queries with the RxDB SQLite adapter...');
    
    // Example 1: Complex JOIN query that would be difficult with RxDB's query API
    console.log('\nExample 1: Complex JOIN query');
    const complexJoinResult = await adapter.rawQuery(`
      SELECT 
        r.id, r.name as recipe_name, 
        m1.value as category, 
        m2.value as cuisine,
        COUNT(ri.id) as ingredient_count,
        GROUP_CONCAT(i.name, ', ') as ingredients
      FROM recipes r
      JOIN metadata m1 ON r.categoryId = m1.id
      JOIN metadata m2 ON r.cuisineId = m2.id
      JOIN recipe_ingredients ri ON r.id = ri.recipeId
      JOIN ingredients i ON ri.ingredientId = i.id
      GROUP BY r.id
      ORDER BY ingredient_count DESC
      LIMIT 5
    `);
    
    console.log('Top 5 recipes by ingredient count:');
    complexJoinResult.forEach(row => {
      console.log(`- ${row.recipe_name} (${row.category}, ${row.cuisine}): ${row.ingredient_count} ingredients`);
    });
    
    // Example 2: Full-text search using SQLite's FTS capabilities
    // Note: This assumes you've set up FTS tables, which would be another extension
    console.log('\nExample 2: Full-text search (simulated)');
    const searchTerm = 'chicken';
    const searchResult = await adapter.rawQuery(`
      SELECT r.id, r.name, r.instructions
      FROM recipes r
      WHERE r.name LIKE ? OR r.instructions LIKE ?
      LIMIT 5
    `, [`%${searchTerm}%`, `%${searchTerm}%`]);
    
    console.log(`Search results for "${searchTerm}":`);
    searchResult.forEach(row => {
      console.log(`- ${row.name}`);
    });
    
    // Example 3: Advanced aggregation
    console.log('\nExample 3: Advanced aggregation');
    const aggregationResult = await adapter.rawQuery(`
      SELECT 
        m.value as cuisine,
        COUNT(r.id) as recipe_count,
        AVG(
          (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipeId = r.id)
        ) as avg_ingredients
      FROM recipes r
      JOIN metadata m ON r.cuisineId = m.id
      WHERE m.type = 'cuisine'
      GROUP BY m.value
      ORDER BY recipe_count DESC
    `);
    
    console.log('Cuisine statistics:');
    aggregationResult.forEach(row => {
      console.log(`- ${row.cuisine}: ${row.recipe_count} recipes, avg ${row.avg_ingredients.toFixed(1)} ingredients per recipe`);
    });
    
    // Example 4: Using the reactive version
    console.log('\nExample 4: Using the reactive version');
    const { take } = require('rxjs/operators');
    
    adapter.rawQueryObservable(`
      SELECT m.value as category, COUNT(r.id) as count
      FROM recipes r
      JOIN metadata m ON r.categoryId = m.id
      WHERE m.type = 'category'
      GROUP BY m.value
      ORDER BY count DESC
    `).pipe(
      take(1)
    ).subscribe({
      next: (result) => {
        console.log('Categories by popularity:');
        result.forEach(row => {
          console.log(`- ${row.category}: ${row.count} recipes`);
        });
      },
      error: (err) => console.error('Error:', err)
    });
    
    // Wait a moment for the observable to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the adapter
    await adapter.close();
  }
};

// Run the demonstration
demonstrateRawQuery();
