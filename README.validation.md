# RxDB Validation with SQLite Adapter

This document provides a detailed explanation of validation issues and solutions when using the RxDB SQLite adapter, particularly with nullable fields.

## The Challenge with Nullable Fields

RxDB uses JSON Schema for validation, and while JSON Schema supports nullable fields through the use of multi-type arrays (e.g., `{ type: ['string', 'null'] }`), there are some challenges when using these with RxDB's built-in validators, especially in dev mode.

### Why This Matters

In SQL databases like SQLite, the concept of `NULL` is important and distinct from empty strings or zero values. When building a proper relational database adapter for RxDB, we need to properly handle nullable fields to maintain data integrity and follow SQL best practices.

## The Problem with RxDB Dev Mode

RxDB's dev mode includes strict validation that can cause issues with nullable fields defined using multi-type arrays. Specifically:

1. **DVM1 Errors**: When dev mode is enabled, RxDB performs additional validation checks that can reject documents with null values in fields defined with multi-type arrays.

2. **Validation Timing**: The validation occurs at different points (insert, update, query) and can be inconsistent with how it handles nullable fields.

3. **Schema Interpretation**: The built-in validator doesn't always correctly interpret the `{ type: ['string', 'null'] }` syntax, especially when combined with other schema features.

## Solutions

There are three main approaches to solving this issue:

### 1. Disable Dev Mode (Simplest)

The simplest solution is to disable RxDB's dev mode when using the SQLite adapter with nullable fields:

```javascript
const db = await createRxDatabase({
  name: 'mydb',
  storage: getRxStorageSQLite({
    filename: 'path/to/database.sqlite'
  }),
  // Disable dev mode to avoid validation issues with nullable fields
  devMode: false
});
```

**Pros:**
- Simple, one-line change
- No additional dependencies

**Cons:**
- Loses the benefits of dev mode for catching other issues
- Not ideal for development environments

### 2. Use a Custom Validator (Recommended)

A better approach is to use a custom validator that properly handles nullable fields:

```javascript
const db = await createRxDatabase({
  name: 'mydb',
  storage: getRxStorageSQLite({
    filename: 'path/to/database.sqlite'
  }),
  // Keep dev mode enabled
  devMode: true,
  // Use a custom validator that handles nullable fields
  validationStrategy: {
    validateBeforeInsert: false,
    validateBeforeSave: false,
    validateOnQuery: false
  }
});
```

**Pros:**
- Maintains dev mode benefits for other features
- More precise control over validation
- Better for development environments

**Cons:**
- Requires more configuration
- May need to implement custom validation logic if needed

### 3. Use a Different Schema Approach

If you're building a new schema from scratch, you can design it to avoid the need for nullable fields:

```javascript
// Instead of this:
{
  properties: {
    optionalField: { type: ['string', 'null'], default: null }
  }
}

// Consider this:
{
  properties: {
    optionalField: { type: 'string' }
  },
  required: ['requiredField1', 'requiredField2'] // Don't include optionalField
}
```

**Pros:**
- Avoids the issue entirely
- Simpler schema

**Cons:**
- Not always possible with existing data models
- Doesn't distinguish between "field not present" and "field explicitly set to null"
- Less precise for SQL mapping

## Technical Details

### How RxDB Validation Works

RxDB uses a validation pipeline that includes:

1. **JSON Schema Validation**: Basic validation against the JSON Schema
2. **Custom Validators**: Additional validators can be added
3. **Dev Mode Checks**: Extra checks when dev mode is enabled

The issue occurs primarily in the dev mode checks, which use a different validation approach than the standard JSON Schema validation.

### Why Multi-type Arrays Cause Problems

In JSON Schema, a field that can be either a string or null is defined as:

```json
{ "type": ["string", "null"] }
```

This is valid JSON Schema, but RxDB's dev mode validator doesn't handle this correctly in all cases, particularly when:

- The field is set to `null`
- The field is missing and should default to `null`
- The field is part of a complex query

### SQLite Adapter Implementation

Our SQLite adapter maps RxDB documents to SQLite tables in two ways:

1. **Blob Storage**: Stores the entire document as a JSON blob
2. **Relational Storage**: Maps each field to a separate column

The relational storage approach benefits greatly from proper handling of nullable fields, as it allows SQLite to use proper `NULL` values in the database.

## Best Practices

When using the RxDB SQLite adapter, we recommend:

1. **Always use array notation for nullable types**:
   ```javascript
   { type: ['string', 'null'], default: null }
   ```
   
2. **Set explicit defaults for nullable fields**:
   ```javascript
   { type: ['string', 'null'], default: null }
   ```

3. **Use a custom validator or disable dev mode**:
   ```javascript
   validationStrategy: {
     validateBeforeInsert: false,
     validateBeforeSave: false,
     validateOnQuery: false
   }
   ```

4. **Be consistent with your approach** across all collections

## Example Implementation

Here's a complete example showing how to properly handle nullable fields with the SQLite adapter:

```javascript
const { createRxDatabase } = require('rxdb');
const { getRxStorageSQLite } = require('rxjs-sqlite/rxdb-adapter');

// Create RxDB database with proper validation settings
const db = await createRxDatabase({
  name: 'mydb',
  storage: getRxStorageSQLite({
    filename: 'path/to/database.sqlite'
  }),
  // Keep dev mode for helpful warnings
  devMode: true,
  // But disable the problematic validators
  validationStrategy: {
    validateBeforeInsert: false,
    validateBeforeSave: false,
    validateOnQuery: false
  }
});

// Define schema with nullable fields
const userSchema = {
  title: 'user schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    email: { type: 'string' },
    // Nullable fields with proper definition
    bio: { type: ['string', 'null'], default: null },
    address: { 
      type: ['object', 'null'], 
      default: null,
      properties: {
        street: { type: 'string' },
        city: { type: 'string' }
      }
    },
    phoneNumber: { type: ['string', 'null'], default: null }
  },
  required: ['id', 'name', 'email']
};

// Add collection
const users = await db.addCollection({
  name: 'users',
  schema: userSchema
});

// Insert with null values works correctly
await users.insert({
  id: 'user1',
  name: 'John Doe',
  email: 'john@example.com',
  bio: null,
  address: {
    street: '123 Main St',
    city: 'Anytown'
  },
  phoneNumber: '555-1234'
});

// Insert with missing fields (defaults to null) works correctly
await users.insert({
  id: 'user2',
  name: 'Jane Smith',
  email: 'jane@example.com'
  // bio, address, and phoneNumber will default to null
});

// Queries with null conditions work correctly
const usersWithNoBio = await users.find({
  selector: {
    bio: null
  }
}).exec();

console.log('Users with no bio:', usersWithNoBio.length);
```

## Conclusion

Handling nullable fields properly is essential for building robust applications with the RxDB SQLite adapter. By understanding the validation challenges and implementing the recommended solutions, you can ensure your application works correctly while maintaining data integrity.

If you encounter specific validation issues not covered in this document, please open an issue on the GitHub repository with details about your schema and the error you're experiencing.
