# RxJS SQLite Adapter

![Coverage](./coverage-badge.svg)

A reactive adapter for SQLite using RxJS, providing a reactive programming model
for SQLite databases. This project includes both a standalone RxJS-based SQLite
adapter and an RxDB adapter for SQLite that works in Node.js environments.

 **⚠️ ALPHA STATUS WARNING**

 This project is currently in alpha stage and has not been tested in a full
 production environment yet. While the core functionality is implemented and
 working, you may encounter bugs or limitations. Use at your own risk in
 production systems. We welcome feedback, bug reports, and contributions to help
 improve stability and feature completeness.

## Installation

```bash
npm install rxjs-sqlite
```

## Green Path Setup

The simplest way to use this adapter is with RxDB:

```typescript
import { createRxDatabase } from 'rxdb';
import { getRxStorageSQLite } from 'rxjs-sqlite/rxdb-adapter';

// Create a database with the SQLite adapter
const db = await createRxDatabase({
  name: 'mydb',
  storage: getRxStorageSQLite(),
  // Recommended for alpha release
  ignoreDuplicate: true,
  // Dev mode provides helpful warnings but requires validation strategy
  // for nullable fields
  devMode: true,
  // Configure validation strategy to handle nullable fields properly
  validationStrategy: {
    validateBeforeInsert: true,
    validateBeforeSave: false,
    validateOnQuery: false
  }
});

// Define a schema for your collection
const taskSchema = {
  title: 'Task schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    completed: { type: 'boolean', default: false },
    // Nullable field using multi-type array
    dueDate: { type: ['string', 'null'], default: null },
    // Another nullable field example
    notes: { type: ['string', 'null'], default: null }
  },
  required: ['id', 'title']
};

// Add a collection
const tasks = await db.addCollection({
  name: 'tasks',
  schema: taskSchema
});

// Insert a document
await tasks.insert({
  id: '1',
  title: 'Complete project',
  dueDate: '2023-12-31',
  notes: null
});

// Query documents
const allTasks = await tasks.find().exec();
console.log('All tasks:', allTasks);

// Create a reactive query
const incompleteTasks$ = tasks.find({
  selector: { completed: false }
}).$;

// Subscribe to changes
const subscription = incompleteTasks$.subscribe(tasks => {
  console.log('Incomplete tasks updated:', tasks);
});

// Later, update a document
await tasks.findOne('1').update({ $set: { completed: true } });

// Clean up
subscription.unsubscribe();
await db.remove();
```

> **Important Note**: The validation strategy shown above is recommended even if
> you're not using dev mode. It ensures proper handling of nullable fields and
> provides better error messages when validation fails. If you don't use
> nullable
> fields (with multi-type arrays like `{ type: ['string', 'null'] }`), you can
> omit the validation strategy configuration.

Once set up, the adapter is transparent - you use the standard RxDB API for all
operations, and the SQLite storage is handled automatically.

## Features

- **Reactive Queries**: Get real-time updates when data changes
- **RxJS Integration**: Leverage the power of RxJS operators
- **TypeScript Support**: Full TypeScript support with type definitions
- **High Performance**: Built on top of better-sqlite3 for optimal performance
- **Transaction Support**: Full support for SQLite transactions
- **Minimal Dependencies**: Only depends on RxJS and better-sqlite3
- **RxDB Compatibility**: Can be used as a storage adapter for RxDB

## Important Notes

### Nullable Fields

When using nullable fields, use multi-type arrays and configure validation
properly:

```typescript
// Define nullable fields like this:
{
  optionalField: {
    type: ['string', 'null'],
    default: null
  }
}

// Always use a validation strategy (recommended even without dev mode)
validationStrategy: {
  validateBeforeInsert: true,  // Validate before inserting new documents
  validateBeforeSave: false, // Skip validation on updates for better perf
  validateOnQuery: false   // Skip validation on queries for better perf
}

// If you don't need dev mode warnings, you can also disable it entirely
// devMode: false
```

The validation strategy is recommended even if you're not using dev mode. It
provides better error messages and ensures proper handling of nullable fields.
Without it, you might encounter cryptic errors or unexpected behavior when
working with null values.

See [README.validation.md](./README.validation.md) for detailed explanation.

### Autoincrement Fields

RxDB is incompatible with autoincrement primary keys. Use client-generated IDs
like UUIDs instead.

See [README.about.md](./README.about.md) for more details.

## Direct SQLite Access

You can access the underlying SQLite database directly:

```typescript
// Get the SQLite database instance
const sqliteDb = getRxStorageSQLite.getDBByName('mydb');

// Execute raw SQL queries
const results = sqliteDb.prepare(`
  SELECT * FROM mydb_tasks WHERE completed = 0
`).all();
```

## Documentation

- [API Reference](./README.api.md) - Detailed API documentation
- [Database Management](./README.database-management.md) - How DB instances
  are managed
- [Capabilities & Limitations](./README.capabilities.md) - What's supported and
  what's not
- [Examples](./README.examples.md) - More usage examples
- [Development Guide](./README.development.md) - For contributors

## Fully Working Example

For a complete, real-world implementation, check out the included Recipe App:

- [Recipe App Instructions](./README.recipe.md) - A fully functional recipe
  management application that demonstrates how to use the SQLite adapter in a
  practical scenario.

The Recipe App showcases:
- Using the SQLite adapter in a Node.js backend
- Implementing a REST API with Express
- Handling complex data relationships
- Implementing search functionality
- Managing nullable fields properly

This example follows the "dogfood principle" by using the adapter in a real
application, proving its capabilities in a practical context.

## License

MIT
