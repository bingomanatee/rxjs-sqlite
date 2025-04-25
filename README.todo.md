# TODO: Potential Enhancements to atmo-db

This document outlines potential enhancements to the [@wonderlandlabs/atmo-db](https://www.npmjs.com/package/@wonderlandlabs/atmo-db) package to support some edge case operators for RxDB integration.

## Current Status

The atmo-db package already handles the vast majority of common query operators excellently, including:

- **Logical operators**: AND, OR, NOT
- **Comparison operators**: =, !=, >, >=, <, <=
- **Array operators**: IN, NOT IN
- **String operators**: LIKE, NOT LIKE

These cover most query needs and work well with RxDB's query system. The operators listed below are only needed for more specialized use cases.

## Operators to Contribute

Based on our implementation of the RxDB SQLite adapter, we identified several operators and features that could be contributed back to atmo-db:

### 1. $exists Operator

The `$exists` operator checks if a field exists (is not null) or doesn't exist (is null).

```javascript
// Add to queryNodeFactories.js
export function exists(field, doesExist = true) {
  return {
    field,
    op: doesExist ? 'IS NOT NULL' : 'IS NULL'
  };
}

// Update parseNode to handle IS NULL/IS NOT NULL without value
function parseComparison(node, params) {
  // Add special handling for IS NULL / IS NOT NULL
  if (node.op === 'IS NULL' || node.op === 'IS NOT NULL') {
    return `${node.field} ${node.op}`;
  }

  // Existing code for other operators...
}
```

### 2. $regex Operator

The `$regex` operator allows for pattern matching using regular expressions, which can be translated to SQL LIKE patterns.

```javascript
// Add to queryNodeFactories.js
export function regex(field, pattern) {
  // Convert regex pattern to SQL LIKE pattern
  let likePattern = pattern;
  if (typeof pattern === 'object' && pattern instanceof RegExp) {
    likePattern = pattern.source;
  }
  // Basic conversion - can be enhanced for more complex patterns
  likePattern = `%${likePattern.replace(/^\^/, '').replace(/\$$/, '')}%`;

  return {
    field,
    op: 'LIKE',
    value: likePattern
  };
}
```

### 3. $nor Operator

The `$nor` operator is a logical NOR (NOT OR) that selects documents where all specified conditions are false.

```javascript
// Add to queryNodeFactories.js
export function nor(...args) {
  return {
    op: 'NOT',
    args: [{
      op: 'OR',
      args
    }]
  };
}
```

### 4. JSON Field Access

Support for accessing nested fields in JSON documents stored in SQLite.

```javascript
// Add to query-builder.js
export function jsonField(field, path) {
  return `JSON_EXTRACT(${field}, '$.${path}')`;
}

// Add support for JSON fields in sorting
function buildOrderByClause(sortFields, jsonFieldPaths = {}) {
  return sortFields.map(field => {
    const [fieldName, direction] = Object.entries(field)[0];
    const dir = direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Check if this is a JSON field that needs extraction
    if (jsonFieldPaths[fieldName]) {
      return `JSON_EXTRACT(${jsonFieldPaths[fieldName]}, '$.${fieldName}') ${dir}`;
    }

    return `${fieldName} ${dir}`;
  }).join(', ');
}
```

### 5. NULL Value Handling

Improved handling of NULL values in comparisons.

```javascript
// Add to queryNodeFactories.js
export function isNull(field) {
  return {
    field,
    op: 'IS NULL'
  };
}

export function isNotNull(field) {
  return {
    field,
    op: 'IS NOT NULL'
  };
}
```

## Implementation Notes

These additions would make atmo-db more comprehensive for handling RxDB-style queries and would reduce the amount of custom code needed in our adapter.

When implementing these features, consider:

1. Maintaining backward compatibility with existing atmo-db code
2. Adding appropriate TypeScript type definitions
3. Writing tests for each new operator
4. Documenting the new features in the README

## Next Steps

- Create a fork of the atmo-db repository
- Implement these features in a new branch
- Add tests for the new functionality
- Submit a pull request to the original repository
