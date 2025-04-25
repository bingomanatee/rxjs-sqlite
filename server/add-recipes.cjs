const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// Connect to the database
const dbPath = path.join(__dirname, "data", "rxdb-recipedb.sqlite");
const db = new Database(dbPath);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS metadata (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    displayName TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    categoryId TEXT,
    cuisineId TEXT,
    instructions TEXT,
    thumbnail TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (categoryId) REFERENCES metadata(id),
    FOREIGN KEY (cuisineId) REFERENCES metadata(id)
  );

  CREATE TABLE IF NOT EXISTS recipe_steps (
    id TEXT PRIMARY KEY,
    recipeId TEXT NOT NULL,
    stepNumber INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    duration INTEGER DEFAULT 0,
    image TEXT,
    FOREIGN KEY (recipeId) REFERENCES recipes(id)
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    isPlural BOOLEAN DEFAULT 0,
    category TEXT,
    description TEXT,
    nutritionalInfo TEXT,
    substitutes TEXT
  );

  CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipeId TEXT NOT NULL,
    ingredientId TEXT NOT NULL,
    originalMeasure TEXT,
    quantity REAL,
    unit TEXT,
    additionalInfo TEXT,
    stepNumber INTEGER,
    FOREIGN KEY (recipeId) REFERENCES recipes(id),
    FOREIGN KEY (ingredientId) REFERENCES ingredients(id)
  );
`);

// Sample recipe data
const recipes = [
  {
    id: "recipe-3",
    name: "Spaghetti Carbonara",
    categoryId: "category-1",
    cuisineId: "cuisine-2",
    instructions:
      "A classic Italian pasta dish with eggs, cheese, pancetta, and black pepper.",
    thumbnail: "https://source.unsplash.com/random/300x200/?pasta",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-4",
    name: "Chicken Tikka Masala",
    categoryId: "category-2",
    cuisineId: "cuisine-3",
    instructions:
      "A popular Indian dish with marinated chicken in a spiced curry sauce.",
    thumbnail: "https://source.unsplash.com/random/300x200/?curry",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-5",
    name: "Greek Salad",
    categoryId: "category-3",
    cuisineId: "cuisine-4",
    instructions:
      "A refreshing salad with tomatoes, cucumbers, olives, and feta cheese.",
    thumbnail: "https://source.unsplash.com/random/300x200/?salad",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-6",
    name: "Beef Tacos",
    categoryId: "category-2",
    cuisineId: "cuisine-5",
    instructions:
      "Delicious Mexican tacos with seasoned ground beef, lettuce, and cheese.",
    thumbnail: "https://source.unsplash.com/random/300x200/?tacos",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-7",
    name: "Vegetable Stir Fry",
    categoryId: "category-3",
    cuisineId: "cuisine-6",
    instructions:
      "A quick and healthy stir fry with mixed vegetables and soy sauce.",
    thumbnail: "https://source.unsplash.com/random/300x200/?stirfry",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-8",
    name: "Chocolate Chip Cookies",
    categoryId: "category-4",
    cuisineId: "cuisine-1",
    instructions: "Classic homemade cookies with chocolate chips and vanilla.",
    thumbnail: "https://source.unsplash.com/random/300x200/?cookies",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-9",
    name: "Mushroom Risotto",
    categoryId: "category-1",
    cuisineId: "cuisine-2",
    instructions:
      "Creamy Italian rice dish with mushrooms and parmesan cheese.",
    thumbnail: "https://source.unsplash.com/random/300x200/?risotto",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-10",
    name: "Beef Burger",
    categoryId: "category-2",
    cuisineId: "cuisine-1",
    instructions: "Juicy beef patty with lettuce, tomato, and cheese in a bun.",
    thumbnail: "https://source.unsplash.com/random/300x200/?burger",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-11",
    name: "Caesar Salad",
    categoryId: "category-3",
    cuisineId: "cuisine-1",
    instructions:
      "Classic salad with romaine lettuce, croutons, and Caesar dressing.",
    thumbnail: "https://source.unsplash.com/random/300x200/?caesar",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-12",
    name: "Pad Thai",
    categoryId: "category-1",
    cuisineId: "cuisine-7",
    instructions:
      "Thai stir-fried noodles with eggs, tofu, bean sprouts, and peanuts.",
    thumbnail: "https://source.unsplash.com/random/300x200/?padthai",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-13",
    name: "Beef Stroganoff",
    categoryId: "category-2",
    cuisineId: "cuisine-8",
    instructions: "Russian dish with sautéed beef in a sour cream sauce.",
    thumbnail: "https://source.unsplash.com/random/300x200/?stroganoff",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-14",
    name: "Caprese Salad",
    categoryId: "category-3",
    cuisineId: "cuisine-2",
    instructions: "Simple Italian salad with tomatoes, mozzarella, and basil.",
    thumbnail: "https://source.unsplash.com/random/300x200/?caprese",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-15",
    name: "Apple Pie",
    categoryId: "category-4",
    cuisineId: "cuisine-1",
    instructions:
      "Classic American dessert with spiced apples in a flaky crust.",
    thumbnail: "https://source.unsplash.com/random/300x200/?applepie",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-16",
    name: "Beef Lasagna",
    categoryId: "category-1",
    cuisineId: "cuisine-2",
    instructions:
      "Italian pasta dish with layers of pasta, meat sauce, and cheese.",
    thumbnail: "https://source.unsplash.com/random/300x200/?lasagna",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-17",
    name: "Chicken Curry",
    categoryId: "category-2",
    cuisineId: "cuisine-3",
    instructions: "Spicy Indian curry with chicken, onions, and spices.",
    thumbnail: "https://source.unsplash.com/random/300x200/?chickencurry",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-18",
    name: "Waldorf Salad",
    categoryId: "category-3",
    cuisineId: "cuisine-1",
    instructions:
      "Fresh salad with apples, celery, walnuts, and a mayonnaise dressing.",
    thumbnail: "https://source.unsplash.com/random/300x200/?waldorfsalad",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-19",
    name: "Tiramisu",
    categoryId: "category-4",
    cuisineId: "cuisine-2",
    instructions:
      "Italian dessert with coffee-soaked ladyfingers and mascarpone cream.",
    thumbnail: "https://source.unsplash.com/random/300x200/?tiramisu",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-20",
    name: "Beef Pho",
    categoryId: "category-1",
    cuisineId: "cuisine-9",
    instructions: "Vietnamese noodle soup with beef, herbs, and rice noodles.",
    thumbnail: "https://source.unsplash.com/random/300x200/?pho",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-21",
    name: "Chicken Alfredo",
    categoryId: "category-1",
    cuisineId: "cuisine-2",
    instructions:
      "Creamy pasta dish with chicken, fettuccine, and parmesan cheese.",
    thumbnail: "https://source.unsplash.com/random/300x200/?alfredo",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-22",
    name: "Beef Stew",
    categoryId: "category-2",
    cuisineId: "cuisine-1",
    instructions: "Hearty stew with beef, potatoes, carrots, and onions.",
    thumbnail: "https://source.unsplash.com/random/300x200/?beefstew",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-23",
    name: "Cobb Salad",
    categoryId: "category-3",
    cuisineId: "cuisine-1",
    instructions:
      "American salad with chicken, bacon, eggs, avocado, and blue cheese.",
    thumbnail: "https://source.unsplash.com/random/300x200/?cobbsalad",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-24",
    name: "Cheesecake",
    categoryId: "category-4",
    cuisineId: "cuisine-1",
    instructions:
      "Creamy dessert with a graham cracker crust and cream cheese filling.",
    thumbnail: "https://source.unsplash.com/random/300x200/?cheesecake",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-25",
    name: "Shrimp Scampi",
    categoryId: "category-1",
    cuisineId: "cuisine-2",
    instructions:
      "Italian-American dish with shrimp, garlic, butter, and white wine.",
    thumbnail: "https://source.unsplash.com/random/300x200/?shrimpscampi",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-26",
    name: "Beef Tacos",
    categoryId: "category-2",
    cuisineId: "cuisine-5",
    instructions:
      "Mexican dish with seasoned beef, lettuce, cheese, and salsa in tortillas.",
    thumbnail: "https://source.unsplash.com/random/300x200/?tacos",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-27",
    name: "Nicoise Salad",
    categoryId: "category-3",
    cuisineId: "cuisine-10",
    instructions: "French salad with tuna, eggs, olives, and green beans.",
    thumbnail: "https://source.unsplash.com/random/300x200/?nicoisesalad",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-28",
    name: "Chocolate Mousse",
    categoryId: "category-4",
    cuisineId: "cuisine-10",
    instructions:
      "Light and airy French dessert with chocolate and whipped cream.",
    thumbnail: "https://source.unsplash.com/random/300x200/?mousse",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-29",
    name: "Beef Enchiladas",
    categoryId: "category-1",
    cuisineId: "cuisine-5",
    instructions:
      "Mexican dish with beef-filled tortillas topped with enchilada sauce and cheese.",
    thumbnail: "https://source.unsplash.com/random/300x200/?enchiladas",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-30",
    name: "Chicken Shawarma",
    categoryId: "category-2",
    cuisineId: "cuisine-11",
    instructions:
      "Middle Eastern dish with marinated chicken, garlic sauce, and pita bread.",
    thumbnail: "https://source.unsplash.com/random/300x200/?shawarma",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-31",
    name: "Greek Salad",
    categoryId: "category-3",
    cuisineId: "cuisine-4",
    instructions:
      "Mediterranean salad with tomatoes, cucumbers, olives, and feta cheese.",
    thumbnail: "https://source.unsplash.com/random/300x200/?greeksalad",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-32",
    name: "Baklava",
    categoryId: "category-4",
    cuisineId: "cuisine-11",
    instructions:
      "Sweet Middle Eastern pastry with layers of filo, nuts, and honey.",
    thumbnail: "https://source.unsplash.com/random/300x200/?baklava",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-33",
    name: "Beef Ramen",
    categoryId: "category-1",
    cuisineId: "cuisine-12",
    instructions:
      "Japanese noodle soup with beef, vegetables, and a rich broth.",
    thumbnail: "https://source.unsplash.com/random/300x200/?ramen",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-34",
    name: "Chicken Fajitas",
    categoryId: "category-2",
    cuisineId: "cuisine-5",
    instructions:
      "Mexican dish with grilled chicken, peppers, and onions served with tortillas.",
    thumbnail: "https://source.unsplash.com/random/300x200/?fajitas",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-35",
    name: "Tabbouleh",
    categoryId: "category-3",
    cuisineId: "cuisine-11",
    instructions:
      "Middle Eastern salad with parsley, mint, bulgur, and tomatoes.",
    thumbnail: "https://source.unsplash.com/random/300x200/?tabbouleh",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-36",
    name: "Crème Brûlée",
    categoryId: "category-4",
    cuisineId: "cuisine-10",
    instructions:
      "French dessert with vanilla custard and a caramelized sugar top.",
    thumbnail: "https://source.unsplash.com/random/300x200/?cremebrulee",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-37",
    name: "Beef Bibimbap",
    categoryId: "category-1",
    cuisineId: "cuisine-13",
    instructions: "Korean rice dish with beef, vegetables, and a fried egg.",
    thumbnail: "https://source.unsplash.com/random/300x200/?bibimbap",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-38",
    name: "Chicken Paella",
    categoryId: "category-2",
    cuisineId: "cuisine-14",
    instructions: "Spanish rice dish with chicken, saffron, and vegetables.",
    thumbnail: "https://source.unsplash.com/random/300x200/?paella",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-39",
    name: "Fattoush",
    categoryId: "category-3",
    cuisineId: "cuisine-11",
    instructions:
      "Middle Eastern salad with toasted pita bread, vegetables, and sumac.",
    thumbnail: "https://source.unsplash.com/random/300x200/?fattoush",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-40",
    name: "Panna Cotta",
    categoryId: "category-4",
    cuisineId: "cuisine-2",
    instructions: "Italian dessert with sweetened cream set with gelatin.",
    thumbnail: "https://source.unsplash.com/random/300x200/?pannacotta",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-41",
    name: "Beef Bourguignon",
    categoryId: "category-2",
    cuisineId: "cuisine-10",
    instructions: "French beef stew with red wine, mushrooms, and onions.",
    thumbnail: "https://source.unsplash.com/random/300x200/?beefbourguignon",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-42",
    name: "Chicken Satay",
    categoryId: "category-2",
    cuisineId: "cuisine-15",
    instructions: "Indonesian grilled chicken skewers with peanut sauce.",
    thumbnail: "https://source.unsplash.com/random/300x200/?satay",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-43",
    name: "Coleslaw",
    categoryId: "category-3",
    cuisineId: "cuisine-1",
    instructions:
      "American salad with shredded cabbage and carrots in a mayonnaise dressing.",
    thumbnail: "https://source.unsplash.com/random/300x200/?coleslaw",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-44",
    name: "Churros",
    categoryId: "category-4",
    cuisineId: "cuisine-14",
    instructions:
      "Spanish fried dough pastry with cinnamon sugar and chocolate sauce.",
    thumbnail: "https://source.unsplash.com/random/300x200/?churros",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-45",
    name: "Beef Pho",
    categoryId: "category-1",
    cuisineId: "cuisine-9",
    instructions: "Vietnamese noodle soup with beef, herbs, and rice noodles.",
    thumbnail: "https://source.unsplash.com/random/300x200/?pho",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-46",
    name: "Chicken Biryani",
    categoryId: "category-1",
    cuisineId: "cuisine-3",
    instructions: "Indian rice dish with chicken, spices, and yogurt.",
    thumbnail: "https://source.unsplash.com/random/300x200/?biryani",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-47",
    name: "Potato Salad",
    categoryId: "category-3",
    cuisineId: "cuisine-1",
    instructions: "American salad with boiled potatoes, mayonnaise, and herbs.",
    thumbnail: "https://source.unsplash.com/random/300x200/?potatosalad",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-48",
    name: "Mochi",
    categoryId: "category-4",
    cuisineId: "cuisine-12",
    instructions: "Japanese rice cake dessert with sweet fillings.",
    thumbnail: "https://source.unsplash.com/random/300x200/?mochi",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-49",
    name: "Beef Wellington",
    categoryId: "category-2",
    cuisineId: "cuisine-16",
    instructions:
      "British dish with beef fillet coated in pâté and wrapped in puff pastry.",
    thumbnail: "https://source.unsplash.com/random/300x200/?beefwellington",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "recipe-50",
    name: "Chicken Piccata",
    categoryId: "category-2",
    cuisineId: "cuisine-2",
    instructions:
      "Italian-American dish with chicken, lemon, capers, and butter sauce.",
    thumbnail: "https://source.unsplash.com/random/300x200/?piccata",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Sample metadata
const metadata = [
  // Categories
  {
    id: "category-1",
    type: "category",
    value: "pasta",
    displayName: "Pasta",
    description: "Dishes primarily featuring pasta",
  },
  {
    id: "category-2",
    type: "category",
    value: "meat",
    displayName: "Meat",
    description: "Dishes primarily featuring meat",
  },
  {
    id: "category-3",
    type: "category",
    value: "salad",
    displayName: "Salad",
    description: "Fresh salad dishes",
  },
  {
    id: "category-4",
    type: "category",
    value: "dessert",
    displayName: "Dessert",
    description: "Sweet treats and desserts",
  },

  // Cuisines
  {
    id: "cuisine-1",
    type: "cuisine",
    value: "american",
    displayName: "American",
    description: "Cuisine from the United States",
  },
  {
    id: "cuisine-2",
    type: "cuisine",
    value: "italian",
    displayName: "Italian",
    description: "Cuisine from Italy",
  },
  {
    id: "cuisine-3",
    type: "cuisine",
    value: "indian",
    displayName: "Indian",
    description: "Cuisine from India",
  },
  {
    id: "cuisine-4",
    type: "cuisine",
    value: "greek",
    displayName: "Greek",
    description: "Cuisine from Greece",
  },
  {
    id: "cuisine-5",
    type: "cuisine",
    value: "mexican",
    displayName: "Mexican",
    description: "Cuisine from Mexico",
  },
  {
    id: "cuisine-6",
    type: "cuisine",
    value: "chinese",
    displayName: "Chinese",
    description: "Cuisine from China",
  },
  {
    id: "cuisine-7",
    type: "cuisine",
    value: "thai",
    displayName: "Thai",
    description: "Cuisine from Thailand",
  },
  {
    id: "cuisine-8",
    type: "cuisine",
    value: "russian",
    displayName: "Russian",
    description: "Cuisine from Russia",
  },
  {
    id: "cuisine-9",
    type: "cuisine",
    value: "vietnamese",
    displayName: "Vietnamese",
    description: "Cuisine from Vietnam",
  },
  {
    id: "cuisine-10",
    type: "cuisine",
    value: "french",
    displayName: "French",
    description: "Cuisine from France",
  },
  {
    id: "cuisine-11",
    type: "cuisine",
    value: "middleeastern",
    displayName: "Middle Eastern",
    description: "Cuisine from the Middle East",
  },
  {
    id: "cuisine-12",
    type: "cuisine",
    value: "japanese",
    displayName: "Japanese",
    description: "Cuisine from Japan",
  },
  {
    id: "cuisine-13",
    type: "cuisine",
    value: "korean",
    displayName: "Korean",
    description: "Cuisine from Korea",
  },
  {
    id: "cuisine-14",
    type: "cuisine",
    value: "spanish",
    displayName: "Spanish",
    description: "Cuisine from Spain",
  },
  {
    id: "cuisine-15",
    type: "cuisine",
    value: "indonesian",
    displayName: "Indonesian",
    description: "Cuisine from Indonesia",
  },
  {
    id: "cuisine-16",
    type: "cuisine",
    value: "british",
    displayName: "British",
    description: "Cuisine from Britain",
  },
];

// Insert metadata
const insertMetadata = db.prepare(
  "INSERT OR REPLACE INTO metadata (id, type, value, displayName, description) VALUES (?, ?, ?, ?, ?)"
);
const insertMetadataTransaction = db.transaction((items) => {
  for (const item of items) {
    insertMetadata.run(
      item.id,
      item.type,
      item.value,
      item.displayName,
      item.description
    );
  }
});

// Insert recipes
const insertRecipe = db.prepare(
  "INSERT OR REPLACE INTO recipes (id, name, categoryId, cuisineId, instructions, thumbnail, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);
const insertRecipeTransaction = db.transaction((items) => {
  for (const item of items) {
    insertRecipe.run(
      item.id,
      item.name,
      item.categoryId,
      item.cuisineId,
      item.instructions,
      item.thumbnail,
      item.createdAt,
      item.updatedAt
    );
  }
});

// Execute transactions
try {
  insertMetadataTransaction(metadata);
  console.log(`Added ${metadata.length} metadata items`);

  insertRecipeTransaction(recipes);
  console.log(`Added ${recipes.length} recipes`);

  console.log("Database updated successfully");
} catch (error) {
  console.error("Error updating database:", error);
}

// Close the database connection
db.close();
