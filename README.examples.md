# Examples

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

## Advanced Usage Example

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

## Example with Nullable Fields

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
