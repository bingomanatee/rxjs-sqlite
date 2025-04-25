const path = require("path");
const Database = require("better-sqlite3");

// Connect to the database
const dbPath = path.join(__dirname, "data", "rxdb-recipedb.sqlite");
const db = new Database(dbPath);

// Drop all tables
console.log("Dropping all tables...");
db.exec(`
  DROP TABLE IF EXISTS recipe_ingredients;
  DROP TABLE IF EXISTS recipe_steps;
  DROP TABLE IF EXISTS ingredients;
  DROP TABLE IF EXISTS recipes;
  DROP TABLE IF EXISTS metadata;
`);

console.log("Database purged successfully");

// Close the database connection
db.close();
