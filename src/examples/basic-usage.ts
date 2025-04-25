/**
 * Basic usage example for the RxJS SQLite adapter
 */
import { createSQLiteAdapter, createTableSchema } from '../lib';
import { firstValueFrom } from 'rxjs';

// Define a type for our data
interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

async function runExample() {
  // Create an in-memory database
  const db = createSQLiteAdapter(':memory:');
  
  try {
    // Create a table
    const userSchema = {
      id: 'INTEGER',
      name: 'TEXT',
      email: 'TEXT',
      created_at: 'TEXT'
    };
    
    const createTableSQL = createTableSchema('users', userSchema, 'id');
    db.execute(createTableSQL);
    
    console.log('Table created successfully');
    
    // Insert some data
    db.execute(`
      INSERT INTO users (id, name, email, created_at)
      VALUES 
        (1, 'John Doe', 'john@example.com', datetime('now')),
        (2, 'Jane Smith', 'jane@example.com', datetime('now')),
        (3, 'Bob Johnson', 'bob@example.com', datetime('now'))
    `);
    
    console.log('Data inserted successfully');
    
    // Query the data
    const users$ = db.query<User>('SELECT * FROM users');
    const users = await firstValueFrom(users$);
    
    console.log('Users:', users);
    
    // Query a single user
    const user$ = db.queryOne<User>('SELECT * FROM users WHERE id = ?', { params: [1] });
    const user = await firstValueFrom(user$);
    
    console.log('User with ID 1:', user);
    
    // Create a reactive query
    const reactiveUsers$ = db.reactiveQuery<User>('SELECT * FROM users');
    
    // Subscribe to changes
    const subscription = reactiveUsers$.subscribe(users => {
      console.log('Reactive query - users updated:', users);
    });
    
    // Insert a new user (this will trigger the reactive query)
    setTimeout(() => {
      db.execute(`
        INSERT INTO users (id, name, email, created_at)
        VALUES (4, 'Alice Williams', 'alice@example.com', datetime('now'))
      `);
      
      console.log('Added a new user');
      
      // Clean up after a short delay
      setTimeout(() => {
        subscription.unsubscribe();
        db.close();
        console.log('Example completed');
      }, 1000);
    }, 1000);
  } catch (error) {
    console.error('Error:', error);
    db.close();
  }
}

// Run the example
runExample().catch(console.error);
