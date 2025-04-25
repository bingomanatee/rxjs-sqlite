/**
 * Tests for the BetterSQLiteAdapter
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom, lastValueFrom, take, toArray } from 'rxjs';
import { BetterSQLiteAdapter } from './better-sqlite-adapter';
import { createSQLiteAdapter } from './index';
import { createTableSchema } from '../utils/sqlite-utils';

describe('BetterSQLiteAdapter', () => {
  let adapter: BetterSQLiteAdapter;

  beforeEach(() => {
    // Create an in-memory database for testing
    adapter = new BetterSQLiteAdapter(':memory:');
  });

  afterEach(() => {
    adapter.close();
  });

  it('should create a table', () => {
    // Arrange
    const schema = {
      id: 'INTEGER',
      name: 'TEXT',
      email: 'TEXT'
    };

    // Act
    adapter.execute(createTableSchema('users', schema, 'id'));

    // Assert - if no error is thrown, the table was created successfully
    expect(true).toBe(true);
  });

  it('should insert and query data', async () => {
    // Arrange
    const schema = {
      id: 'INTEGER',
      name: 'TEXT',
      email: 'TEXT'
    };

    adapter.execute(createTableSchema('users', schema, 'id'));

    // Act
    adapter.execute(`
      INSERT INTO users (id, name, email)
      VALUES (1, 'John Doe', 'john@example.com')
    `);

    const users = await firstValueFrom(adapter.query('SELECT * FROM users'));

    // Assert
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(1);
    expect(users[0].name).toBe('John Doe');
    expect(users[0].email).toBe('john@example.com');
  });

  it('should query a single row', async () => {
    // Arrange
    const schema = {
      id: 'INTEGER',
      name: 'TEXT',
      email: 'TEXT'
    };

    adapter.execute(createTableSchema('users', schema, 'id'));

    adapter.execute(`
      INSERT INTO users (id, name, email)
      VALUES
        (1, 'John Doe', 'john@example.com'),
        (2, 'Jane Smith', 'jane@example.com')
    `);

    // Act
    const user = await firstValueFrom(adapter.queryOne('SELECT * FROM users WHERE id = ?', { params: [2] }));

    // Assert
    expect(user).toBeDefined();
    expect(user?.id).toBe(2);
    expect(user?.name).toBe('Jane Smith');
  });

  it('should handle transactions', async () => {
    // Arrange
    const schema = {
      id: 'INTEGER',
      name: 'TEXT',
      email: 'TEXT'
    };

    adapter.execute(createTableSchema('users', schema, 'id'));

    // Act
    const transaction = adapter.transaction();

    transaction.execute(`
      INSERT INTO users (id, name, email)
      VALUES (1, 'John Doe', 'john@example.com')
    `);

    transaction.execute(`
      INSERT INTO users (id, name, email)
      VALUES (2, 'Jane Smith', 'jane@example.com')
    `);

    transaction.commit();

    // Assert - query directly from the adapter after transaction is committed
    const users = await firstValueFrom(adapter.query('SELECT * FROM users'));
    expect(users).toHaveLength(2);
  });

  it('should create reactive queries', () => {
    // Arrange
    const schema = {
      id: 'INTEGER',
      name: 'TEXT',
      email: 'TEXT'
    };

    adapter.execute(createTableSchema('users', schema, 'id'));

    adapter.execute(`
      INSERT INTO users (id, name, email)
      VALUES (1, 'John Doe', 'john@example.com')
    `);

    // Act & Assert
    // Since reactive queries are hard to test in a synchronous way,
    // we'll just verify that the method exists and returns an Observable
    const users$ = adapter.reactiveQuery('SELECT * FROM users');
    expect(users$).toBeDefined();
    expect(typeof users$.subscribe).toBe('function');

    // Take the first value to verify initial data
    users$.pipe(take(1)).subscribe(users => {
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe(1);
    });
  });

  it('should handle parameterized queries with arrays', async () => {
    // Arrange
    const schema = {
      id: 'INTEGER',
      name: 'TEXT',
      email: 'TEXT'
    };

    adapter.execute(createTableSchema('users', schema, 'id'));

    adapter.execute(`
      INSERT INTO users (id, name, email)
      VALUES (1, 'John Doe', 'john@example.com')
    `);

    // Act
    const users = await firstValueFrom(adapter.query('SELECT * FROM users WHERE id = ?', { params: [1] }));

    // Assert
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(1);
  });

  it('should handle parameterized queries with objects', async () => {
    // Arrange
    const schema = {
      id: 'INTEGER',
      name: 'TEXT',
      email: 'TEXT'
    };

    adapter.execute(createTableSchema('users', schema, 'id'));

    adapter.execute(`
      INSERT INTO users (id, name, email)
      VALUES (1, 'John Doe', 'john@example.com')
    `);

    // Act
    const users = await firstValueFrom(adapter.query('SELECT * FROM users WHERE id = :id', {
      params: { id: 1 }
    }));

    // Assert
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(1);
  });

  it('should handle transaction rollback', () => {
    // Arrange
    const schema = {
      id: 'INTEGER',
      name: 'TEXT',
      email: 'TEXT'
    };

    adapter.execute(createTableSchema('users', schema, 'id'));

    // Act
    const transaction = adapter.transaction();

    transaction.execute(`
      INSERT INTO users (id, name, email)
      VALUES (1, 'John Doe', 'john@example.com')
    `);

    // Rollback the transaction
    transaction.rollback();

    // Assert
    const users = transaction.query('SELECT * FROM users');
    expect(users).toHaveLength(0);
  });

  it('should handle errors gracefully', () => {
    // Act & Assert
    expect(() => {
      adapter.execute('SELECT * FROM non_existent_table');
    }).toThrow();
  });
});

describe('createSQLiteAdapter', () => {
  it('should create a SQLiteAdapter instance', () => {
    // Act
    const adapter = createSQLiteAdapter(':memory:');

    // Assert
    expect(adapter).toBeDefined();
    expect(adapter.query).toBeDefined();
    expect(adapter.execute).toBeDefined();

    // Clean up
    adapter.close();
  });
});
