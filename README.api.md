# RxJS SQLite Adapter API Reference

This document provides detailed API information for the RxJS SQLite Adapter.

## Standalone SQLite Adapter

### `createSQLiteAdapter(dbPath: string, options?: any): SQLiteAdapter`

Creates a new SQLite adapter instance.

- `dbPath`: Path to the SQLite database file
- `options`: Options for better-sqlite3

### `SQLiteAdapter` Interface

- `execute(sql: string, options?: SQLiteQueryOptions): void` - Execute a SQL statement
- `query<T>(sql: string, options?: SQLiteQueryOptions): Observable<T[]>` - Execute a SQL query
- `queryOne<T>(sql: string, options?: SQLiteQueryOptions): Observable<T | undefined>` - Execute a SQL query and return the first result
- `transaction(): SQLiteTransaction` - Start a transaction
- `reactiveQuery<T>(sql: string, options?: SQLiteQueryOptions): Observable<T[]>` - Create a reactive query
- `close(): void` - Close the database connection

### `SQLiteTransaction` Interface

- `execute(sql: string, params?: SQLiteValue[] | Record<string, SQLiteValue>): void` - Execute a SQL statement in the transaction
- `query<T>(sql: string, params?: SQLiteValue[] | Record<string, SQLiteValue>): T[]` - Execute a SQL query in the transaction
- `commit(): void` - Commit the transaction
- `rollback(): void` - Rollback the transaction

## RxDB SQLite Adapter

### Storage Options

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

### `getRxStorageSQLite(options?: Database.Options): RxStorage`

Creates a new RxDB SQLite storage adapter using the blob-style storage approach.

- `options`: Options for better-sqlite3

### `getRelationalRxStorageSQLite(options?: Database.Options): RxStorage`

Creates a new RxDB SQLite storage adapter using the relational storage approach.

- `options`: Options for better-sqlite3

### `getSQLiteBasicsBetterSQLite(options?: Database.Options): SQLiteBasics`

Creates a SQLiteBasics implementation for better-sqlite3.

- `options`: Options for better-sqlite3
