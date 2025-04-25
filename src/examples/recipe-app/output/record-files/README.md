# Recipe Database Dump

This directory contains a dump of the recipe database, with each record stored as an individual JSON file.

## Directory Structure

- `recipes/`: Contains all records from the `recipes` table
- `ingredients/`: Contains all records from the `ingredients` table
- `metadata/`: Contains all records from the `metadata` table
- `recipe_ingredients/`: Contains all records from the `recipe_ingredients` table
- `recipe_metadata/`: Contains all records from the `recipe_metadata` table
- `sources/`: Contains all records from the `sources` table
- `instructions/`: Contains the original instructions for each recipe

## Record Counts

- `recipes`: 65 records
- `ingredients`: 269 records
- `metadata`: 6 records
- `recipe_ingredients`: 646 records
- `recipe_metadata`: 2 records
- `sources`: 107 records

## Recreating the Database

To recreate the database:

1. Create a new database with the same schema
2. For each directory, read all JSON files and insert the records into the corresponding table
3. For the `instructions/` directory, read the text files and associate them with the corresponding recipes

This structure allows for easy version control of individual records and simplifies the process of recreating the database from scratch.
