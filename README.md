# RxJS SQLite Adapter

![Coverage](./coverage-badge.svg)

A reactive adapter for SQLite using RxJS, providing a reactive programming model for SQLite databases. This project includes both a standalone RxJS-based SQLite adapter and an RxDB adapter for SQLite that works in Node.js environments.

> **⚠️ ALPHA STATUS WARNING**
>
> This project is currently in alpha stage and has not been tested in a full production environment yet. While the core functionality is implemented and working, you may encounter bugs or limitations. Use at your own risk in production systems. We welcome feedback, bug reports, and contributions to help improve stability and feature completeness.

> **⚠️ IMPORTANT: CUSTOM VALIDATOR REQUIRED**
>
> When using this adapter with nullable fields (using multi-type arrays like `{ type: ['string', 'null'] }`), you **MUST**:
> 1. Disable RxDB's dev mode validation OR use a custom validator
> 2. Always use array notation for nullable types: `{ type: ['string', 'null'] }` instead of `{ type: 'string', nullable: true }`
>
> The built-in RxDB validators in dev mode cannot properly handle these field types. See [README.validation.md](./README.validation.md) for detailed explanation and solutions.

## Quick Start

```typescript
import { createRxDatabase } from 'rxdb';
import { getRxStorageSQLite } from 'rxjs-sqlite/rxdb-adapter';

// Create a database with the SQLite adapter
const db = await createRxDatabase({
  name: 'mydb',
  storage: getRxStorageSQLite({
    // Path to SQLite database file (or ':memory:' for in-memory database)
    path: './mydb.sqlite'
  })
});

// Use the database with standard RxDB API
const myCollection = await db.addCollection({
  name: 'mycollection',
  schema: mySchema
});
```

## Server-Client Architecture

This project includes a server-client architecture for demonstrating the RxDB SQLite adapter in a web application:

- **Node.js Backend**: Runs the RxDB with SQLite adapter and exposes an API
- **Browser Frontend**: Provides a user interface to interact with the data

This architecture allows you to use the better-sqlite3 adapter (which only works in Node.js) while still providing a reactive experience to users in the browser.

### Project Structure

```
rxjs-sqlite/
├── server/                 # Node.js server with RxDB SQLite adapter
│   ├── data/               # SQLite database files
│   ├── logs/               # Server logs
│   ├── recipe-server.cjs   # Express server for the recipe app
│   └── recipe-client.html  # Simple HTML client for the recipe app
├── recipe-ui/              # React client for the recipe app
├── src/                    # Source code for the RxDB SQLite adapter
└── tests/                  # Test files
```

## Features

- **Reactive Queries**: Get real-time updates when data changes
- **RxJS Integration**: Leverage the power of RxJS operators
- **TypeScript Support**: Full TypeScript support with type definitions
- **High Performance**: Built on top of better-sqlite3 for optimal performance
- **Transaction Support**: Full support for SQLite transactions
- **Minimal Dependencies**: Only depends on RxJS and better-sqlite3
- **RxDB Compatibility**: Can be used as a storage adapter for RxDB

## Installation

```bash
npm install rxjs-sqlite
```

## Usage

### Basic Usage

```typescript
import { createSQLiteAdapter } from 'rxjs-sqlite';
import { firstValueFrom } from 'rxjs';

// Create a database connection
const db = createSQLiteAdapter('path/to/database.sqlite');

// Create a table
db.execute(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    email TEXT
  )
`);

// Insert data
db.execute(`
  INSERT INTO users (id, name, email)
  VALUES (1, 'John Doe', 'john@example.com')
`);

// Query data as an Observable
const users$ = db.query('SELECT * FROM users');
users$.subscribe(users => {
  console.log('Users:', users);
});

// Query a single user
const user$ = db.queryOne('SELECT * FROM users WHERE id = ?', { params: [1] });
user$.subscribe(user => {
  console.log('User:', user);
});

// Create a reactive query that updates when data changes
const reactiveUsers$ = db.reactiveQuery('SELECT * FROM users');
reactiveUsers$.subscribe(users => {
  console.log('Users updated:', users);
});

// Use transactions
const transaction = db.transaction();
transaction.execute('INSERT INTO users (id, name, email) VALUES (?, ?, ?)', [2, 'Jane Smith', 'jane@example.com']);
transaction.execute('INSERT INTO users (id, name, email) VALUES (?, ?, ?)', [3, 'Bob Johnson', 'bob@example.com']);
transaction.commit();

// Close the database when done
db.close();
```

### Advanced Usage

```typescript
import { createSQLiteAdapter, createTableSchema } from 'rxjs-sqlite';
import { map, switchMap } from 'rxjs/operators';

// Define types for your data
interface User {
  id: number;
  name: string;
  email: string;
}

interface Post {
  id: number;
  user_id: number;
  title: string;
  content: string;
}

// Create a database connection
const db = createSQLiteAdapter('path/to/database.sqlite');

// Create tables using the schema helper
const userSchema = {
  id: 'INTEGER',
  name: 'TEXT',
  email: 'TEXT'
};

const postSchema = {
  id: 'INTEGER',
  user_id: 'INTEGER',
  title: 'TEXT',
  content: 'TEXT'
};

db.execute(createTableSchema('users', userSchema, 'id'));
db.execute(createTableSchema('posts', postSchema, 'id'));

// Create a reactive query with joins
const usersWithPosts$ = db.reactiveQuery<User>('SELECT * FROM users').pipe(
  switchMap(users => {
    // For each user, get their posts
    const usersWithPosts$ = users.map(user => {
      return db.query<Post>('SELECT * FROM posts WHERE user_id = ?', { params: [user.id] }).pipe(
        map(posts => ({
          ...user,
          posts
        }))
      );
    });

    // Combine all user+posts results
    return combineLatest(usersWithPosts$);
  })
);

usersWithPosts$.subscribe(usersWithPosts => {
  console.log('Users with their posts:', usersWithPosts);
});
```

## Using with RxDB

```typescript
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageSQLite } from 'rxjs-sqlite/rxdb-adapter';

// Create a database using our SQLite adapter
const db = await createRxDatabase({
  name: 'exampledb',
  storage: getRxStorageSQLite()
});

// Define a schema for a collection
const userSchema = {
  title: 'User schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    name: {
      type: 'string'
    },
    email: {
      type: 'string'
    },
    age: {
      type: 'integer',
      minimum: 0,
      maximum: 150
    },
    // Example of nullable fields using multi-type arrays
    bio: {
      type: ['string', 'null'],  // Can be either a string or null
      default: null  // Default to null when not provided
    },
    address: {
      type: ['object', 'null'],  // Can be either an object or null
      default: null,  // Default to null when not provided
      properties: {
        street: { type: 'string' },
        city: { type: 'string' },
        zipCode: { type: 'string' }
      }
    },
    tags: {
      type: ['array', 'null'],  // Can be either an array or null
      default: null,  // Default to null when not provided
      items: { type: 'string' }
    }
  },
  required: ['id', 'name', 'email']
};

// Create a collection
const usersCollection = await db.addCollection({
  name: 'users',
  schema: userSchema
});

// Insert a document with some nullable fields
const user = await usersCollection.insert({
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  bio: 'Software developer with 5+ years of experience',  // Non-null string
  address: {  // Non-null object
    street: '123 Main St',
    city: 'San Francisco',
    zipCode: '94105'
  },
  tags: null  // Null array
});

// Insert another document with different nullable field values
const user2 = await usersCollection.insert({
  id: '2',
  name: 'Jane Smith',
  email: 'jane@example.com',
  age: 28,
  bio: null,  // Null string
  address: null,  // Null object
  tags: ['developer', 'react', 'typescript']  // Non-null array
});

// Insert a document with missing nullable fields (will use default values)
const user3 = await usersCollection.insert({
  id: '3',
  name: 'Bob Johnson',
  email: 'bob@example.com',
  age: 35
  // bio, address, and tags are not specified, so they'll default to null
});

// Query the collection
const users = await usersCollection.find().exec();

// Query for documents with null bio
const usersWithNullBio = await usersCollection.find({
  selector: {
    bio: null
  }
}).exec();
console.log('Users with null bio:', usersWithNullBio);

// Query for documents with non-null bio
const usersWithBio = await usersCollection.find({
  selector: {
    bio: { $ne: null }
  }
}).exec();
console.log('Users with non-null bio:', usersWithBio);

// Create a reactive query
const subscription = usersCollection.find().$.subscribe(users => {
  console.log('Reactive query - users updated:', users);
});

// Clean up
subscription.unsubscribe();
db.destroy();
```

## API Reference

### Standalone SQLite Adapter

#### `createSQLiteAdapter(dbPath: string, options?: any): SQLiteAdapter`

Creates a new SQLite adapter instance.

- `dbPath`: Path to the SQLite database file
- `options`: Options for better-sqlite3

#### `SQLiteAdapter` Interface

- `execute(sql: string, options?: SQLiteQueryOptions): void` - Execute a SQL statement
- `query<T>(sql: string, options?: SQLiteQueryOptions): Observable<T[]>` - Execute a SQL query
- `queryOne<T>(sql: string, options?: SQLiteQueryOptions): Observable<T | undefined>` - Execute a SQL query and return the first result
- `transaction(): SQLiteTransaction` - Start a transaction
- `reactiveQuery<T>(sql: string, options?: SQLiteQueryOptions): Observable<T[]>` - Create a reactive query
- `close(): void` - Close the database connection

#### `SQLiteTransaction` Interface

- `execute(sql: string, params?: SQLiteValue[] | Record<string, SQLiteValue>): void` - Execute a SQL statement in the transaction
- `query<T>(sql: string, params?: SQLiteValue[] | Record<string, SQLiteValue>): T[]` - Execute a SQL query in the transaction
- `commit(): void` - Commit the transaction
- `rollback(): void` - Rollback the transaction

### RxDB SQLite Adapter

#### Storage Options

This project provides two different SQLite adapters for RxDB:

1. **Blob-style Storage** (Default): Stores documents as JSON blobs in a single `data` column, similar to how RxDB works with other storage engines.
   - Simple implementation
   - Maintains compatibility with other RxDB adapters
   - Less efficient for querying specific fields

2. **Relational Storage** (New): Maps RxDB document fields to individual columns in the SQLite table.
   - Better performance for field-specific queries
   - More efficient storage
   - Takes full advantage of SQLite's relational capabilities
   - Supports nullable fields with multi-type arrays (e.g., `{ type: ['string', 'null'] }`)

   > **⚠️ Important Note**: When using nullable fields with multi-type arrays (e.g., `{ type: ['string', 'null'] }`), you must disable RxDB's dev mode. The built-in RxDB validators in dev mode are not flexible enough to handle these types of fields correctly.

#### `getRxStorageSQLite(options?: Database.Options): RxStorage`

Creates a new RxDB SQLite storage adapter using the blob-style storage approach.

- `options`: Options for better-sqlite3

#### `getRelationalRxStorageSQLite(options?: Database.Options): RxStorage`

Creates a new RxDB SQLite storage adapter using the relational storage approach.

- `options`: Options for better-sqlite3

#### `getRxStorageSQLite.getLastDB(): Database` / `getRelationalRxStorageSQLite.getLastDB(): Database`

Returns the last created SQLite database instance. This allows direct access to the underlying better-sqlite3 database for executing raw SQL queries.

⚠️ **WARNING**: This method only returns the most recently created database instance. If you create multiple RxDB databases, you should save a reference to the returned database instance immediately after creating your RxDB database, rather than relying on this method.

**IMPORTANT**: SQLite has limitations with concurrent write operations. While you can create a separate connection to read from the same database file, concurrent write operations from multiple connections can lead to database locks or corruption. For write operations, you should either:

1. Use the database instance returned by `getLastDB()` immediately after creating your RxDB database
2. Close your RxDB database before opening a new connection to the same file
3. Use RxDB's API for write operations whenever possible

Reading from multiple connections is generally safe, but writing should be done through a single connection to avoid issues.

```javascript
// Recommended approach for accessing the SQLite instance
const { createRxDatabase } = require('rxdb');
const { getRxStorageSQLite } = require('rxjs-sqlite/rxdb-adapter');

// Create RxDB database with blob-style storage
const db = await createRxDatabase({
  name: 'mydb',
  storage: getRxStorageSQLite({
    filename: 'path/to/database.sqlite'
  })
});

// Save a reference to the SQLite instance immediately
const sqliteDb = getRxStorageSQLite.getLastDB();

// Now you can use the SQLite instance for raw queries
const results = sqliteDb.prepare(`
  SELECT r.id, r.name, COUNT(ri.id) as ingredient_count
  FROM recipes r
  JOIN recipe_ingredients ri ON r.id = ri.recipeId
  GROUP BY r.id
  ORDER BY ingredient_count DESC
  LIMIT 5
`).all();

console.log('Top 5 recipes by ingredient count:', results);
```

### Using the Relational SQLite Adapter

```javascript
const { createRxDatabase } = require('rxdb');
const { getRelationalRxStorageSQLite } = require('rxjs-sqlite/rxdb-adapter');

// Create RxDB database with relational storage
// Note: When using nullable fields, you must disable dev mode
const db = await createRxDatabase({
  name: 'relational-db',
  storage: getRelationalRxStorageSQLite({
    filename: 'path/to/relational-database.sqlite'
  }),
  // Disable dev mode when using nullable fields
  devMode: false
});

// Define a schema with various field types
const recipeSchema = {
  title: 'recipe schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    description: { type: 'string' },
    preparationTime: { type: 'number' },
    cookingTime: { type: 'number' },
    servings: { type: 'number' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
    isVegetarian: { type: 'boolean' },
    isVegan: { type: 'boolean' },
    isGlutenFree: { type: 'boolean' },
    // Example of nullable fields using multi-type arrays
    categoryId: { type: ['string', 'null'] },
    cuisineId: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id', 'name']
};

// Add a collection
const collections = await db.addCollections({
  recipes: {
    schema: recipeSchema
  }
});

// Insert a document
await collections.recipes.insert({
  id: 'recipe-1',
  name: 'Spaghetti Carbonara',
  description: 'A classic Italian pasta dish',
  preparationTime: 10,
  cookingTime: 15,
  servings: 4,
  difficulty: 'medium',
  isVegetarian: false,
  isVegan: false,
  isGlutenFree: false,
  categoryId: 'cat-pasta',
  cuisineId: 'cuis-italian',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// Access the underlying SQLite database
const sqliteDb = getRelationalRxStorageSQLite.getLastDB();

// View the table structure
const tableInfo = sqliteDb.prepare("PRAGMA table_info(relational-db_recipes)").all();
console.log('Table structure:', tableInfo);
// Each field in the schema is now a separate column in the SQLite table!
```

#### `getSQLiteBasicsBetterSQLite(options?: Database.Options): SQLiteBasics`

Creates a SQLiteBasics implementation for better-sqlite3.

- `options`: Options for better-sqlite3

## Capabilities and Limitations

### Query Support

The RxDB SQLite adapter supports most of the RxDB query syntax, leveraging the [@wonderlandlabs/atmo-db](https://www.npmjs.com/package/@wonderlandlabs/atmo-db) package for translating Mango/RxDB queries to SQL:

#### Supported Query Features

- **Logical Operators**:
  - `$and`: Combine multiple conditions with AND logic
  - `$or`: Combine multiple conditions with OR logic
  - `$not`: Negate a condition
  - `$nor`: Combine multiple conditions with NOR logic (NOT OR)

- **Comparison Operators**:
  - `$eq`: Equal to
  - `$ne`: Not equal to
  - `$gt`: Greater than
  - `$gte`: Greater than or equal to
  - `$lt`: Less than
  - `$lte`: Less than or equal to

- **Array Operators**:
  - `$in`: Match any value in an array
  - `$nin`: Match none of the values in an array

- **Element Operators**:
  - `$exists`: Check if a field exists

- **Sorting**: Sort results by one or more fields in ascending or descending order
- **Pagination**: Skip and limit results

#### Partially Supported Features

- **Regex Queries** (`$regex`): Basic regex patterns are supported, but complex patterns may not work correctly
- **Nested Fields**: Queries on nested fields are supported but may have performance implications

#### Unsupported Features

- **Full-text Search**: Not supported natively (would require SQLite FTS extension)
- **Geospatial Queries**: Not supported natively
- **Array Element Matching** (`$elemMatch`): Not fully supported

### Implementation Details

- **Internal Transactions**: The adapter uses better-sqlite3's transaction capabilities internally to ensure atomic operations when performing multi-document changes
- **Document Storage**: Documents are stored as JSON in SQLite TEXT columns with appropriate indexing
- **Change Detection**: The adapter efficiently tracks changes to propagate them to RxDB's reactive system
- **Conflict Resolution**: Follows RxDB's conflict resolution strategies

### Performance Considerations

- **Indexing**: The adapter automatically creates SQLite indexes based on your RxDB schema's primary key and indexes
- **Query Performance**: Complex queries with multiple nested logical operators are fully supported but may be less performant than simple queries
- **Large Datasets**: The adapter handles large datasets efficiently, but applications with >100k documents may benefit from pagination and careful query design
- **Reactive Queries**: Subscribing to frequently-changing data with complex queries may impact performance

### Platform Support

- **Node.js**: Fully supported (via better-sqlite3)
- **Electron**: Fully supported
- **Browser**: Not supported directly (better-sqlite3 is Node.js only)
  - Use the server-client architecture for browser applications

### Data Types

- **JSON Data**: Fully supported (stored as TEXT in SQLite)
- **Binary Data**: Supported (stored as BLOB)
- **Date/Time**: Stored as ISO strings, not native SQLite DATE
- **Numbers**: Both integers and floating-point numbers are supported
- **Nullable Fields**: Fully supported using multi-type arrays in JSON Schema (e.g., `{ type: ["string", "null"], default: null }`). Setting `default: null` ensures fields are explicitly null rather than undefined when not provided.

### Key Features

- **Reactive Queries**: Get real-time updates when data changes using RxJS observables
- **Complex Queries**: Full support for AND/OR/NOT logic in queries
- **SQLite Access**: Access to the underlying SQLite database instance for advanced operations
- **Node.js Optimized**: Built specifically for Node.js environments using better-sqlite3
- **Persistence**: Reliable SQLite-based persistence with ACID properties
- **TypeScript Support**: Full TypeScript definitions and type safety
- **Attachments**: Store and retrieve binary attachments
- **Encryption**: Support for encrypted databases (via SQLCipher if configured)

### Known Limitations

- **Browser Support**: This adapter only works in Node.js environments (not directly in browsers) due to better-sqlite3 limitations
- **Case Sensitivity**: String comparisons in queries are case-insensitive by default (SQLite behavior)
- **Concurrent Writes**: SQLite has significant limitations with concurrent write operations. Multiple connections attempting to write to the same database file simultaneously can lead to locks, timeouts, or even database corruption. It's strongly recommended to use a single connection for all write operations to a given database file.
- **Complex Regex**: Only basic regex patterns are fully supported in queries
- **Schema Changes**: Changing collection schemas requires careful migration planning
- **Nullable Fields and Dev Mode**: When using the relational storage adapter with nullable fields (using multi-type arrays like `{ type: ['string', 'null'] }`), you must disable RxDB's dev mode. The built-in validators in dev mode cannot properly handle these field types.

## Validated Operations and Roadmap

### Validated Operations

The following RxDB operations have been tested and confirmed working with this adapter:

✅ **Database Operations**
- Creating databases
- Adding collections
- Destroying databases

✅ **Document Operations**
- Inserting documents
- Finding documents by ID
- Querying documents with selectors
- Updating documents
- Removing documents
- Handling nullable fields using multi-type arrays in JSON Schema

✅ **Query Operations**
- Basic queries with field equality
- Complex queries with AND/OR/NOT logic
- Sorting results
- Limiting results
- Skip/offset pagination

✅ **Reactive Features**
- Document change detection
- Collection change streams
- Reactive queries

### Roadmap

Future development plans include:

1. **Enhanced Query Support**
   - Improved regex handling
   - Better support for array operations
   - Full-text search capabilities

2. **Performance Optimizations**
   - Better indexing strategies
   - Query optimization for complex selectors
   - Memory usage improvements

3. **Additional Features**
   - Encryption support via SQLCipher
   - Improved migration tools
   - Better attachment handling

4. **Documentation and Examples**
   - More comprehensive examples
   - Performance tuning guide
   - Migration guide

## Examples

The project includes examples that demonstrate how to use the RxDB SQLite adapter in different scenarios:

- `src/examples/rxdb-sqlite-example.ts`: Shows how to use the RxDB SQLite adapter in a Node.js environment

To run an example:

```bash
# Compile TypeScript
npm run build

# Run the example
node dist/examples/rxdb-sqlite-example.js
```

## Running the Server-Client Demo

To run the server-client demo:

```bash
# Install dependencies
npm install

# Start the server (builds the frontend and starts the Node.js server)
npm run start
```

Then open your browser to http://localhost:3000 to see the demo.

## Testing

The project includes comprehensive tests for all components. To run the tests:

```bash
npm run test
```

To run tests with coverage:

```bash
npm run test:coverage
```

Current test coverage is 93%, with most of the core functionality well-tested.

## Production Readiness Note

> **Note for Beginners**: SQLite is an excellent embedded database for many use cases, but it has limitations for production multi-tenant applications with high concurrency requirements. Before using SQLite in a production environment with multiple users or services accessing the same database, consider using a full-featured database system like PostgreSQL, MySQL, or MongoDB that is designed for concurrent access patterns. SQLite works best when:
>
> - The database is primarily accessed by a single process at a time
> - Write operations are infrequent or can be serialized
> - The database size is moderate (typically under a few GB)
> - Simplicity and zero configuration are priorities
>
> For applications with multiple concurrent writers, high throughput requirements, or very large datasets, a client-server database would be more appropriate.

## Future Database Support

While this adapter currently supports SQLite, the underlying architecture uses standard SQL that could be adapted to work with other SQL databases like PostgreSQL or MySQL with relatively modest changes. The query builder and core functionality are database-agnostic, making it feasible to extend support to other SQL databases in the future.

If you're interested in contributing support for additional databases, please open an issue or pull request.

## License

MIT
