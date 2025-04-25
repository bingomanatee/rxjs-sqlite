/**
 * Tests for SQLite utility functions
 */
import { describe, it, expect } from 'vitest';
import { 
  rowToObject, 
  rowsToObjects, 
  createTableSchema, 
  createInsertStatement, 
  createUpdateStatement 
} from './sqlite-utils';

describe('SQLite Utilities', () => {
  describe('rowToObject', () => {
    it('should convert a row to an object', () => {
      // Arrange
      const row = {
        id: 1,
        name: 'John',
        email: 'john@example.com'
      };
      
      // Act
      const result = rowToObject(row);
      
      // Assert
      expect(result).toEqual({
        id: 1,
        name: 'John',
        email: 'john@example.com'
      });
    });
    
    it('should handle empty objects', () => {
      // Arrange
      const row = {};
      
      // Act
      const result = rowToObject(row);
      
      // Assert
      expect(result).toEqual({});
    });
    
    it('should handle null values', () => {
      // Arrange
      const row = {
        id: 1,
        name: null,
        email: 'john@example.com'
      };
      
      // Act
      const result = rowToObject(row);
      
      // Assert
      expect(result).toEqual({
        id: 1,
        name: null,
        email: 'john@example.com'
      });
    });
  });
  
  describe('rowsToObjects', () => {
    it('should convert an array of rows to objects', () => {
      // Arrange
      const rows = [
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' }
      ];
      
      // Act
      const result = rowsToObjects(rows);
      
      // Assert
      expect(result).toEqual([
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' }
      ]);
    });
    
    it('should handle an empty array', () => {
      // Arrange
      const rows: any[] = [];
      
      // Act
      const result = rowsToObjects(rows);
      
      // Assert
      expect(result).toEqual([]);
    });
  });
  
  describe('createTableSchema', () => {
    it('should create a table schema without primary key', () => {
      // Arrange
      const tableName = 'users';
      const schema = {
        id: 'INTEGER',
        name: 'TEXT',
        email: 'TEXT'
      };
      
      // Act
      const result = createTableSchema(tableName, schema);
      
      // Assert
      expect(result).toBe('CREATE TABLE IF NOT EXISTS users (id INTEGER, name TEXT, email TEXT)');
    });
    
    it('should create a table schema with primary key', () => {
      // Arrange
      const tableName = 'users';
      const schema = {
        id: 'INTEGER',
        name: 'TEXT',
        email: 'TEXT'
      };
      
      // Act
      const result = createTableSchema(tableName, schema, 'id');
      
      // Assert
      expect(result).toBe('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)');
    });
  });
  
  describe('createInsertStatement', () => {
    it('should create an insert statement', () => {
      // Arrange
      const tableName = 'users';
      const columns = ['id', 'name', 'email'];
      
      // Act
      const result = createInsertStatement(tableName, columns);
      
      // Assert
      expect(result).toBe('INSERT INTO users (id, name, email) VALUES (?, ?, ?)');
    });
    
    it('should handle a single column', () => {
      // Arrange
      const tableName = 'users';
      const columns = ['id'];
      
      // Act
      const result = createInsertStatement(tableName, columns);
      
      // Assert
      expect(result).toBe('INSERT INTO users (id) VALUES (?)');
    });
  });
  
  describe('createUpdateStatement', () => {
    it('should create an update statement', () => {
      // Arrange
      const tableName = 'users';
      const columns = ['name', 'email'];
      const whereColumns = ['id'];
      
      // Act
      const result = createUpdateStatement(tableName, columns, whereColumns);
      
      // Assert
      expect(result).toBe('UPDATE users SET name = ?, email = ? WHERE id = ?');
    });
    
    it('should handle multiple where conditions', () => {
      // Arrange
      const tableName = 'users';
      const columns = ['name'];
      const whereColumns = ['id', 'email'];
      
      // Act
      const result = createUpdateStatement(tableName, columns, whereColumns);
      
      // Assert
      expect(result).toBe('UPDATE users SET name = ? WHERE id = ? AND email = ?');
    });
  });
});
