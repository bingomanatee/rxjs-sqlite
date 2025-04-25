# Recipe Database Schema Documentation

This document outlines the relational schema design used for the recipe database. The schema is organized to efficiently store and query recipe data while keeping the database lean.

## Schema Overview

The database consists of 5 main tables, with original instructions stored externally:

1. **recipes** - Core recipe information (without original instructions)
2. **ingredients** - Unique ingredients with metadata
3. **recipe_ingredients** - Junction table linking recipes to ingredients with measurements
4. **metadata** - Consolidated table for categories, cuisines, and other metadata
5. **sources** - Recipe sources (videos, websites, etc.)

## External Storage

- **Original Instructions**: Stored as individual text files in a directory structure
  - Path format: `instructions/{recipe_id}.txt`
  - This keeps the database lean while preserving the original content

## Table Definitions

### recipes

Stores the core information about each recipe, without the original instructions.

| Column | Type | Description | Constraints |
|--------|------|-------------|------------|
| id | TEXT | Unique identifier for the recipe | PRIMARY KEY |
| name | TEXT | Recipe name | NOT NULL |
| categoryId | TEXT | Reference to category metadata | FOREIGN KEY |
| cuisineId | TEXT | Reference to cuisine metadata | FOREIGN KEY |
| instructions | TEXT | Processed cooking instructions | NOT NULL |
| thumbnail | TEXT | URL to recipe image | |
| createdAt | TEXT | Creation timestamp (ISO format) | |
| updatedAt | TEXT | Last update timestamp (ISO format) | |

### ingredients

Stores unique ingredients with metadata.

| Column | Type | Description | Constraints |
|--------|------|-------------|------------|
| id | TEXT | Unique identifier for the ingredient | PRIMARY KEY |
| name | TEXT | Ingredient name | NOT NULL |
| isPlural | INTEGER | Whether the ingredient name is plural (1) or singular (0) | NOT NULL |
| categoryId | TEXT | Reference to ingredient category metadata | FOREIGN KEY |

### recipe_ingredients

Junction table linking recipes to ingredients with measurement information.

| Column | Type | Description | Constraints |
|--------|------|-------------|------------|
| id | TEXT | Unique identifier for the relationship | PRIMARY KEY |
| recipeId | TEXT | Reference to the recipe | FOREIGN KEY |
| ingredientId | TEXT | Reference to the ingredient | FOREIGN KEY |
| originalMeasure | TEXT | Original measurement string from the source | |
| quantity | REAL | Parsed quantity value | |
| unit | TEXT | Measurement unit | |
| additionalInfo | TEXT | Additional measurement information | |

### metadata

Consolidated table for categories, cuisines, and other metadata types.

| Column | Type | Description | Constraints |
|--------|------|-------------|------------|
| id | TEXT | Unique identifier for the metadata | PRIMARY KEY |
| type | TEXT | Metadata type (category, cuisine, unit_type, etc.) | NOT NULL |
| value | TEXT | Metadata value | NOT NULL |
| displayName | TEXT | Human-readable display name | NOT NULL |
| description | TEXT | Optional description | |
| parentId | TEXT | Optional reference to parent metadata (for hierarchical metadata) | FOREIGN KEY |

### sources

Stores recipe sources (videos, websites, etc.).

| Column | Type | Description | Constraints |
|--------|------|-------------|------------|
| id | TEXT | Unique identifier for the source | PRIMARY KEY |
| recipeId | TEXT | Reference to the recipe | FOREIGN KEY |
| url | TEXT | Source URL | NOT NULL |
| typeId | TEXT | Reference to source type metadata | FOREIGN KEY |
| platform | TEXT | Source platform (e.g., YouTube, Instagram) | |
| domain | TEXT | Source domain | |
| description | TEXT | Source description | |

### recipe_metadata

Stores the relationship between recipes and metadata (including tags, difficulty levels, meal times, etc.).

| Column | Type | Description | Constraints |
|--------|------|-------------|------------|
| id | TEXT | Unique identifier for the relationship | PRIMARY KEY |
| recipeId | TEXT | Reference to the recipe | FOREIGN KEY |
| metadataId | TEXT | Reference to the metadata | FOREIGN KEY |

## Metadata Types

The metadata table would include records with the following types:

1. **category** - Recipe categories (e.g., Dessert, Seafood)
2. **cuisine** - Recipe cuisines/regions (e.g., Italian, Mexican)
3. **tag** - Recipe tags (e.g., Spicy, Vegetarian, Quick)
4. **unit_type** - Types of measurement units (volume, weight, count, etc.)
5. **ingredient_category** - Categories of ingredients (meat, vegetable, dairy, etc.)
6. **source_type** - Types of recipe sources (video, website, blog, etc.)
7. **difficulty** - Recipe difficulty levels (easy, medium, hard)
8. **meal_time** - When the recipe is typically served (breakfast, lunch, dinner)

## Example Metadata Records

```
// Categories
{ id: "cat_dessert", type: "category", value: "dessert", displayName: "Dessert" }
{ id: "cat_seafood", type: "category", value: "seafood", displayName: "Seafood" }

// Cuisines
{ id: "cuis_italian", type: "cuisine", value: "italian", displayName: "Italian" }
{ id: "cuis_mexican", type: "cuisine", value: "mexican", displayName: "Mexican" }

// Tags
{ id: "tag_spicy", type: "tag", value: "spicy", displayName: "Spicy" }
{ id: "tag_vegetarian", type: "tag", value: "vegetarian", displayName: "Vegetarian" }
{ id: "tag_quick", type: "tag", value: "quick", displayName: "Quick & Easy" }

// Unit Types
{ id: "unit_volume", type: "unit_type", value: "volume", displayName: "Volume" }
{ id: "unit_weight", type: "unit_type", value: "weight", displayName: "Weight" }

// Ingredient Categories
{ id: "ing_meat", type: "ingredient_category", value: "meat", displayName: "Meat" }
{ id: "ing_vegetable", type: "ingredient_category", value: "vegetable", displayName: "Vegetable" }

// Source Types
{ id: "src_video", type: "source_type", value: "video", displayName: "Video" }
{ id: "src_website", type: "source_type", value: "website", displayName: "Website" }

// Difficulty Levels
{ id: "diff_easy", type: "difficulty", value: "easy", displayName: "Easy" }
{ id: "diff_medium", type: "difficulty", value: "medium", displayName: "Medium" }
{ id: "diff_hard", type: "difficulty", value: "hard", displayName: "Hard" }

// Meal Times
{ id: "meal_breakfast", type: "meal_time", value: "breakfast", displayName: "Breakfast" }
{ id: "meal_lunch", type: "meal_time", value: "lunch", displayName: "Lunch" }
{ id: "meal_dinner", type: "meal_time", value: "dinner", displayName: "Dinner" }
```

## File System Structure

```
/instructions/
  ├── 52771.txt       # Original instructions for recipe with ID 52771
  ├── 52772.txt       # Original instructions for recipe with ID 52772
  ├── 52773.txt       # Original instructions for recipe with ID 52773
  └── ...
```

## Implementation Considerations

### Reading Original Instructions

When the original instructions are needed:

```javascript
function getOriginalInstructions(recipeId) {
  const filePath = path.join(instructionsDir, `${recipeId}.txt`);
  return fs.readFileSync(filePath, 'utf8');
}
```

### Writing Original Instructions

When saving a new recipe:

```javascript
function saveOriginalInstructions(recipeId, originalInstructions) {
  const filePath = path.join(instructionsDir, `${recipeId}.txt`);
  fs.writeFileSync(filePath, originalInstructions, 'utf8');
}
```

### Backup Considerations

When backing up the database, ensure the instructions directory is also backed up:

```bash
# Database backup
sqlite3 recipes.db .dump > recipes_backup.sql

# Instructions backup
tar -czf instructions_backup.tar.gz instructions/
```

## Benefits of This Approach

1. **Database Size**: Significantly reduced database size by storing large text content externally
2. **Query Performance**: Faster queries due to smaller table sizes
3. **Flexibility**: Original instructions can be processed or analyzed separately
4. **Scalability**: Better handling of very large instruction text
5. **Separation of Concerns**: Clean separation between structured data and unstructured text

## Querying Examples

### Get all categories
```sql
SELECT * FROM metadata WHERE type = 'category';
```

### Get recipes by category
```sql
SELECT r.* FROM recipes r
JOIN metadata m ON r.categoryId = m.id
WHERE m.type = 'category' AND m.value = 'dessert';
```

### Get recipes by cuisine
```sql
SELECT r.* FROM recipes r
JOIN metadata m ON r.cuisineId = m.id
WHERE m.type = 'cuisine' AND m.value = 'italian';
```

### Get recipes by tag
```sql
SELECT r.* FROM recipes r
JOIN recipe_metadata rm ON r.id = rm.recipeId
JOIN metadata m ON rm.metadataId = m.id
WHERE m.type = 'tag' AND m.value = 'vegetarian';
```

### Get recipes with a specific ingredient
```sql
SELECT r.* FROM recipes r
JOIN recipe_ingredients ri ON r.id = ri.recipeId
JOIN ingredients i ON ri.ingredientId = i.id
WHERE i.name LIKE '%chicken%';
```

### Get complete recipe with ingredients
```sql
SELECT r.*, i.name as ingredient_name, ri.quantity, ri.unit, ri.additionalInfo
FROM recipes r
JOIN recipe_ingredients ri ON r.id = ri.recipeId
JOIN ingredients i ON ri.ingredientId = i.id
WHERE r.id = '52771';
```

### Get recipes by multiple metadata criteria
```sql
SELECT DISTINCT r.* FROM recipes r
JOIN recipe_metadata rm1 ON r.id = rm1.recipeId
JOIN metadata m1 ON rm1.metadataId = m1.id
JOIN recipe_metadata rm2 ON r.id = rm2.recipeId
JOIN metadata m2 ON rm2.metadataId = m2.id
WHERE (m1.type = 'tag' AND m1.value = 'quick')
AND (m2.type = 'difficulty' AND m2.value = 'easy');
```

This schema provides a flexible and efficient structure for storing and querying recipe data, supporting a wide range of query patterns and use cases while keeping the database lean by storing large text content externally.
