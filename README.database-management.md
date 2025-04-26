# Database Instance Management

The SQLite adapter includes a robust database instance management system that maintains a static map of all database instances, indexed by database name. This system ensures consistent access to database instances throughout your application.

## Database Retrieval Methods

### `getRxStorageSQLite.getDBByName(nameOrDatabase: string | RxDatabase): Database` / `getRelationalRxStorageSQLite.getDBByName(nameOrDatabase: string | RxDatabase): Database`

Returns a SQLite database instance by its name or from a database object. This method accepts either:
- A string representing the database name
- An RxDB database object from which the name will be extracted

This flexible method makes it easy to get the underlying SQLite instance in various scenarios.

### `getRxStorageSQLite.getAvailableDatabases(): string[]` / `getRelationalRxStorageSQLite.getAvailableDatabases(): string[]`

Returns an array of all database names that have been created and are available in the map.

## Key Features of the Database Management System

1. **Static Database Map**: Each adapter maintains a static map of database instances indexed by database name, ensuring global access to database instances throughout your application.

2. **Instance Reuse**: When creating a database with a name that already exists, the adapter automatically reuses the existing database instance instead of creating a new one. This prevents database connection duplication and ensures consistency.

3. **Separate Maps for Different Adapters**: The standard and relational adapters maintain separate maps, allowing you to use both adapter types with the same database names without conflicts.

4. **Global Accessibility**: The static nature of the database map means you can access any database instance from anywhere in your code using `getDBByName()`, without needing to pass database references around.

## Example: Accessing Database Instances

```javascript
// Create a database
const db = await createRxDatabase({
  name: 'myapp',
  storage: getRxStorageSQLite({
    filename: 'path/to/database.sqlite'
  })
});

// Later, in another part of your application
const sqliteDb = getRxStorageSQLite.getDBByName('myapp');

// Execute raw SQL queries
const results = sqliteDb.prepare(`
  SELECT * FROM myapp_users WHERE json_extract(data, '$.active') = 1
`).all();
```

## Example: Working with Multiple Databases

```javascript
// Create multiple databases
const usersDb = await createRxDatabase({
  name: 'users',
  storage: getRxStorageSQLite()
});

const productsDb = await createRxDatabase({
  name: 'products',
  storage: getRxStorageSQLite()
});

// List all available databases
const availableDatabases = getRxStorageSQLite.getAvailableDatabases();
console.log('Available databases:', availableDatabases); // ['users', 'products']

// Access specific database instances
const usersDbInstance = getRxStorageSQLite.getDBByName('users');
const productsDbInstance = getRxStorageSQLite.getDBByName('products');

// Execute cross-database queries
const activeUsersWithPurchases = usersDbInstance.prepare(`
  SELECT u.id, u.name, COUNT(p.id) as purchase_count
  FROM users_users u
  JOIN products_purchases p ON json_extract(p.data, '$.userId') = u.id
  WHERE json_extract(u.data, '$.active') = 1
  GROUP BY u.id
`).all();
```

## Example: Database Instance Reuse

```javascript
// Create a database
const db1 = await createRxDatabase({
  name: 'shared',
  storage: getRxStorageSQLite()
});

// Create another database with the same name
const db2 = await createRxDatabase({
  name: 'shared',
  storage: getRxStorageSQLite()
});

// Both db1 and db2 use the same underlying SQLite instance
const sqliteDb1 = getRxStorageSQLite.getDBByName('shared');
const sqliteDb2 = getRxStorageSQLite.getDBByName(db2); // Pass the database object directly

console.log(sqliteDb1 === sqliteDb2); // true - same instance
```

**IMPORTANT**: SQLite has limitations with concurrent write operations. While you can create a separate connection to read from the same database file, concurrent write operations from multiple connections can lead to database locks or corruption. For write operations, you should either:

1. Use the database instance returned by `getDBByName()` to access the underlying SQLite database
2. Close your RxDB database before opening a new connection to the same file
3. Use RxDB's API for write operations whenever possible

Reading from multiple connections is generally safe, but writing should be done through a single connection to avoid issues.
