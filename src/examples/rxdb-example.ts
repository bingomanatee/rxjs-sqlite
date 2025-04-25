/**
 * Example of using RxDB with our SQLite adapter
 */
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageSQLite } from '../lib/rxdb-adapter';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';

// Add the dev mode plugin for better error messages
addRxPlugin(RxDBDevModePlugin);

async function runRxDBExample() {
  try {
    console.log('Creating RxDB database with SQLite adapter...');

    // Create a database using our SQLite adapter
    const db = await createRxDatabase({
      name: 'exampledb',
      storage: getRxStorageSQLite({
        // SQLite options
        verbose: console.log
      })
    });

    console.log('Database created:', db.name);

    // Define a schema for a collection
    const userSchema = {
      title: 'User schema',
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: {
          type: 'string',
          maxLength: 100
        },
        name: {
          type: 'string'
        },
        email: {
          type: 'string'
        },
        age: {
          type: 'integer',
          minimum: 0,
          maximum: 150
        }
      },
      required: ['id', 'name', 'email']
    };

    console.log('Creating collection...');

    // Create a collection
    const usersCollection = await db.addCollection({
      name: 'users',
      schema: userSchema
    });

    console.log('Collection created:', usersCollection.name);

    console.log('Inserting document...');

    // Insert a document
    const user = await usersCollection.insert({
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    });

    console.log('User inserted:', user.toJSON());

    console.log('Querying collection...');

    // Query the collection
    const users = await usersCollection.find().exec();
    console.log('Users found:', users.map(u => u.toJSON()));

    console.log('Setting up reactive query...');

    // Create a reactive query
    const subscription = usersCollection.find().$.subscribe(users => {
      console.log('Reactive query - users updated:', users.map(u => u.toJSON()));
    });

    // Insert another user (this will trigger the reactive query)
    setTimeout(async () => {
      console.log('Inserting second document...');

      await usersCollection.insert({
        id: '2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        age: 25
      });

      console.log('Second user inserted');

      // Clean up
      setTimeout(() => {
        console.log('Cleaning up...');

        subscription.unsubscribe();
        db.destroy();
        console.log('Example completed');
      }, 1000);
    }, 1000);
  } catch (error) {
    console.error('Error:', error);
    console.error('Error details:', error.stack);
  }
}

// Run the example
console.log('Starting RxDB SQLite adapter example...');
runRxDBExample().catch(error => {
  console.error('Unhandled error in example:', error);
  console.error('Error details:', error.stack);
});
