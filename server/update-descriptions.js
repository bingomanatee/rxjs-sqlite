const path = require('path');
const Database = require('better-sqlite3');

// Connect to the database
const dbPath = path.join(__dirname, 'data', 'rxdb-recipedb.sqlite');
const db = new Database(dbPath);

console.log('Updating recipe descriptions...');

// Get all recipes
const recipes = db.prepare('SELECT id, name, instructions FROM recipes').all();
console.log(`Found ${recipes.length} recipes to update`);

// Create better descriptions for recipes
const updateStmt = db.prepare('UPDATE recipes SET description = ? WHERE id = ?');

// Start a transaction for better performance
const transaction = db.transaction(() => {
  let count = 0;
  
  for (const recipe of recipes) {
    // Create a better description based on the recipe name and instructions
    let description = '';
    
    // Extract the first sentence from instructions (likely to be a description)
    const firstSentence = recipe.instructions.split(/\.\s+/)[0].trim() + '.';
    
    // Create a generic description based on the recipe name
    const genericDescription = `A delicious ${recipe.name.toLowerCase()} recipe that's perfect for any occasion. This dish combines wonderful flavors and textures for a satisfying meal.`;
    
    // Use the first sentence if it's not too long and doesn't start with an instruction verb
    const instructionVerbs = ['preheat', 'heat', 'mix', 'combine', 'add', 'place', 'put', 'stir', 'cook', 'bake', 'boil', 'simmer', 'fry', 'grill', 'roast', 'chop', 'slice', 'dice', 'mince', 'measure', 'sift', 'beat', 'whisk', 'fold', 'knead', 'roll', 'spread', 'pour', 'drain', 'rinse', 'wash', 'dry', 'season', 'marinate', 'garnish', 'serve'];
    
    const startsWithInstructionVerb = instructionVerbs.some(verb => 
      firstSentence.toLowerCase().startsWith(verb)
    );
    
    if (firstSentence.length <= 150 && !startsWithInstructionVerb) {
      // Add a generic intro before the first sentence
      description = `${recipe.name} is a flavorful dish that's sure to impress. ${firstSentence}`;
    } else {
      // Use a generic description based on the recipe type
      if (recipe.name.toLowerCase().includes('cake') || recipe.name.toLowerCase().includes('pie') || 
          recipe.name.toLowerCase().includes('tart') || recipe.name.toLowerCase().includes('bread') || 
          recipe.name.toLowerCase().includes('cookie') || recipe.name.toLowerCase().includes('dessert')) {
        description = `A delightful ${recipe.name.toLowerCase()} that makes for a perfect dessert or sweet treat. This recipe creates a wonderful balance of flavors and textures that will satisfy any sweet tooth.`;
      } else if (recipe.name.toLowerCase().includes('soup') || recipe.name.toLowerCase().includes('stew')) {
        description = `A hearty ${recipe.name.toLowerCase()} that's perfect for cold days. This comforting dish is packed with flavor and nutrition.`;
      } else if (recipe.name.toLowerCase().includes('salad')) {
        description = `A refreshing ${recipe.name.toLowerCase()} that's both healthy and delicious. This colorful dish combines fresh ingredients for a perfect light meal or side dish.`;
      } else if (recipe.name.toLowerCase().includes('chicken') || recipe.name.toLowerCase().includes('beef') || 
                recipe.name.toLowerCase().includes('pork') || recipe.name.toLowerCase().includes('lamb') || 
                recipe.name.toLowerCase().includes('fish') || recipe.name.toLowerCase().includes('seafood')) {
        description = `A savory ${recipe.name.toLowerCase()} that makes for a satisfying main course. This dish is full of rich flavors and is sure to be a crowd-pleaser.`;
      } else {
        description = genericDescription;
      }
    }
    
    // Special case for Bakewell Tart
    if (recipe.id === '52767') {
      description = 'A classic British dessert consisting of a shortcrust pastry shell filled with layers of jam, frangipane, and topped with flaked almonds. This traditional tart from the Derbyshire town of Bakewell has a wonderful almond flavor and a light texture.';
    }
    
    // Update the recipe description
    updateStmt.run(description, recipe.id);
    count++;
  }
  
  return count;
});

// Execute the transaction
const updatedCount = transaction();
console.log(`Updated descriptions for ${updatedCount} recipes`);

// Close the database connection
db.close();
console.log('Database connection closed');
