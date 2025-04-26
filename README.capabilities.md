# Capabilities and Limitations

## Query Support

The RxDB SQLite adapter supports most of the RxDB query syntax, leveraging the [@wonderlandlabs/atmo-db](https://www.npmjs.com/package/@wonderlandlabs/atmo-db) package for translating Mango/RxDB queries to SQL:

### Supported Query Features

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

### Partially Supported Features

- **Regex Queries** (`$regex`): Basic regex patterns are supported, but complex patterns may not work correctly
- **Nested Fields**: Queries on nested fields are supported but may have performance implications

### Unsupported Features

- **Full-text Search**: Not supported natively (would require SQLite FTS extension)
- **Geospatial Queries**: Not supported natively
- **Array Element Matching** (`$elemMatch`): Not fully supported

## Implementation Details

- **Internal Transactions**: The adapter uses better-sqlite3's transaction capabilities internally to ensure atomic operations when performing multi-document changes
- **Document Storage**: Documents are stored as JSON in SQLite TEXT columns with appropriate indexing
- **Change Detection**: The adapter efficiently tracks changes to propagate them to RxDB's reactive system
- **Conflict Resolution**: Follows RxDB's conflict resolution strategies

## Performance Considerations

- **Indexing**: The adapter automatically creates SQLite indexes based on your RxDB schema's primary key and indexes
- **Query Performance**: Complex queries with multiple nested logical operators are fully supported but may be less performant than simple queries
- **Large Datasets**: The adapter handles large datasets efficiently, but applications with >100k documents may benefit from pagination and careful query design
- **Reactive Queries**: Subscribing to frequently-changing data with complex queries may impact performance

### Memory Efficiency with Large Datasets

RxDB maintains an in-memory cache of documents that have been queried. When working with large datasets, this can lead to memory bloat, especially when using pagination (all pages end up cached in memory). For memory-efficient access to large datasets:

1. **Use Direct SQLite Access**: Bypass RxDB's cache by using the SQLite instance directly via `getDBByName()`:
   ```javascript
   const sqliteDb = getRxStorageSQLite.getDBByName('mydb');
   const page = sqliteDb.prepare(`SELECT * FROM mydb_collection LIMIT 50 OFFSET 100`).all();
   ```

2. **Implement Efficient Pagination**: Create a utility that handles pagination without accumulating documents in memory.

3. **Process Data in Batches**: For large data processing operations, use a batched approach that only keeps a small subset of data in memory at any time.

See the [README.todo.md](./README.todo.md) file for more detailed implementation ideas for memory-efficient data access.

## Platform Support

- **Node.js**: Fully supported (via better-sqlite3)
- **Electron**: Fully supported
- **Browser**: Not supported directly (better-sqlite3 is Node.js only)
  - Use the server-client architecture for browser applications

## Data Types

- **JSON Data**: Fully supported (stored as TEXT in SQLite)
- **Binary Data**: Supported (stored as BLOB)
- **Date/Time**: Stored as ISO strings, not native SQLite DATE
- **Numbers**: Both integers and floating-point numbers are supported
- **Nullable Fields**: Fully supported using multi-type arrays in JSON Schema (e.g., `{ type: ["string", "null"], default: null }`). Setting `default: null` ensures fields are explicitly null rather than undefined when not provided.

## Key Features

- **Reactive Queries**: Get real-time updates when data changes using RxJS observables
- **Complex Queries**: Full support for AND/OR/NOT logic in queries
- **SQLite Access**: Access to the underlying SQLite database instance for advanced operations
- **Node.js Optimized**: Built specifically for Node.js environments using better-sqlite3
- **Persistence**: Reliable SQLite-based persistence with ACID properties
- **TypeScript Support**: Full TypeScript definitions and type safety
- **Attachments**: Store and retrieve binary attachments
- **Encryption**: Support for encrypted databases (via SQLCipher if configured)

## Known Limitations

- **Browser Support**: This adapter only works in Node.js environments (not directly in browsers) due to better-sqlite3 limitations
- **Case Sensitivity**: String comparisons in queries are case-insensitive by default (SQLite behavior)
- **Concurrent Writes**: SQLite has significant limitations with concurrent write operations. Multiple connections attempting to write to the same database file simultaneously can lead to locks, timeouts, or even database corruption. It's strongly recommended to use a single connection for all write operations to a given database file.
- **Complex Regex**: Only basic regex patterns are fully supported in queries
- **Schema Changes**: Changing collection schemas requires careful migration planning
- **Nullable Fields and Dev Mode**: When using the relational storage adapter with nullable fields (using multi-type arrays like `{ type: ['string', 'null'] }`), you must disable RxDB's dev mode. The built-in validators in dev mode cannot properly handle these field types.
- **Autoincrement Fields**: RxDB is fundamentally incompatible with autoincrement primary keys. RxDB's architecture is designed around client-generated IDs that are known at insertion time, which conflicts with database-generated autoincrement IDs. This is due to RxDB's offline-first design where clients need to generate IDs locally without server coordination. Instead, use client-generated IDs like UUIDs or composite keys based on your business logic.
