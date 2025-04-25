# TODO: Make Recipe App Independent

This document outlines the steps needed to make the recipe-app subfolder completely independent from the parent project, allowing it to be moved outside the root folder.

## Cross-References to Parent Project

### 1. SQLite Adapter Import

The main cross-reference is the import of the SQLite adapter from the parent project:

**File: `rxdb-recipe-adapter.js`**
```javascript
// Import our SQLite adapter
const { getRxStorageSQLite } = require('../../lib/rxdb-adapter/sqlite-adapter');
```

This imports the SQLite adapter from the parent project's lib folder.

### 2. Dependent Files

The following files depend on `rxdb-recipe-adapter.js` which has the cross-reference:

- `use-rxdb-adapter.js`
- `recipe-api-server.js`
- `dumpTables.js`
- `recreateDatabase.js`

## Action Plan

To make the recipe-app subfolder independent:

### 1. Create Local Copy of SQLite Adapter

- Create a `lib` folder inside the recipe-app
- Copy the following files from the parent project:
  - `../../lib/rxdb-adapter/sqlite-adapter.ts` → `./lib/rxdb-adapter/sqlite-adapter.ts`
  - `../../lib/rxdb-adapter/sqlite-basics.ts` → `./lib/rxdb-adapter/sqlite-basics.ts`
  - `../../lib/rxdb-adapter/enhanced-query-builder.ts` → `./lib/rxdb-adapter/enhanced-query-builder.ts`
  - Any other required files from the parent project

### 2. Update Import Paths

- Update the import path in `rxdb-recipe-adapter.js`:
  ```javascript
  const { getRxStorageSQLite } = require('./lib/rxdb-adapter/sqlite-adapter');
  ```

### 3. Update Package Dependencies

- Ensure all dependencies used by the SQLite adapter are included in the recipe-app's package.json:
  ```json
  "dependencies": {
    "axios": "^1.8.4",
    "better-sqlite3": "^11.9.1",
    "rxdb": "^16.11.0",
    "rxjs": "^7.8.2",
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
  ```

### 4. Create Build Process

- Add TypeScript configuration if needed
- Add build scripts to package.json:
  ```json
  "scripts": {
    "build": "tsc",
    "prebuild": "rimraf dist",
    "prestart": "npm run build"
  }
  ```

### 5. Update README

- Update the README to mention that the SQLite adapter is a local copy
- Add instructions for building and running the project independently

## Testing Independence

After making these changes, test that the recipe-app works independently:

1. Move the recipe-app folder to a different location
2. Install dependencies: `npm install`
3. Run the app: `npm start`
4. Verify that all functionality works as expected

## Publishing Considerations

When publishing the recipe-app or the SQLite adapter to npm:

1. Ensure proper attribution and licensing
2. Update package.json with correct author, contributors, and repository information
3. Consider versioning strategy for both packages
4. Document any differences between the local copy and the original SQLite adapter

## Production Readiness Notes

Add a note to the documentation about SQLite's limitations for production multi-tenant applications:

- SQLite is not designed for high-concurrency multi-tenant applications
- It works best when accessed by a single process at a time
- Write operations should be infrequent or serialized
- For applications with multiple concurrent writers, consider a client-server database
- Recommend PostgreSQL, MySQL, or MongoDB for high-concurrency production environments

## Future Database Support

Consider extending the adapter to support other SQL databases:

1. The current implementation uses standard SQL that could be adapted to work with PostgreSQL or MySQL
2. The query builder and core functionality are largely database-agnostic
3. Potential approach:
   - Create an abstract database interface
   - Implement concrete adapters for different databases (SQLite, PostgreSQL, MySQL)
   - Allow users to choose which adapter to use
4. This would make the adapter more versatile for different production environments
