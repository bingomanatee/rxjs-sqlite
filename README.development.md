# Development Guide

This document provides information for developers who want to contribute to or modify the RxJS SQLite Adapter.

## Project Structure

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

## Future Database Support

While this adapter currently supports SQLite, the underlying architecture uses standard SQL that could be adapted to work with other SQL databases like PostgreSQL or MySQL with relatively modest changes. The query builder and core functionality are database-agnostic, making it feasible to extend support to other SQL databases in the future.

If you're interested in contributing support for additional databases, please open an issue or pull request.

## Production Readiness Note

> **Note for Beginners**: SQLite is an excellent embedded database for many use cases, but it has limitations for production multi-tenant applications with high concurrency requirements. Before using SQLite in a production environment with multiple users or services accessing the same database, consider using a full-featured database system like PostgreSQL, MySQL, or MongoDB that is designed for concurrent access patterns. SQLite works best when:
>
> - The database is primarily accessed by a single process at a time
> - Write operations are infrequent or can be serialized
> - The database size is moderate (typically under a few GB)
> - Simplicity and zero configuration are priorities
>
> For applications with multiple concurrent writers, high throughput requirements, or very large datasets, a client-server database would be more appropriate.
