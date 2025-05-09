/**
 * RxDB Relational SQLite Storage Instance Implementation
 */
import type {
  BulkWriteRow,
  EventBulk,
  FilledMangoQuery,
  PreparedQuery,
  RxDocumentData,
  RxJsonSchema,
  RxStorage,
  RxStorageBulkWriteResponse,
  RxStorageChangeEvent,
  RxStorageCountResult,
  RxStorageInstance,
  RxStorageInstanceCreationParams,
  RxStorageQueryResult
} from 'rxdb';

import type {
  SQLiteInternals,
  SQLiteInstanceCreationOptions,
  SQLiteQueryWithParams,
  SQLiteChangesCheckpoint
} from 'rxdb/dist/types/plugins/storage-sqlite/sqlite-types';

import { Observable, Subject } from 'rxjs';
import type { SQLiteDatabaseClass } from 'rxdb/dist/types/plugins/storage-sqlite/sqlite-types';
import { getSQLiteQueryBuilderFromMangoQuery } from './enhanced-query-builder';
import type { createTableSchema } from '@wonderlandlabs/atmo-db';

/**
 * RxDB Relational SQLite Storage Instance
 */
export class RelationalStorageInstanceSQLite<RxDocType> implements RxStorageInstance<
  RxDocType,
  SQLiteInternals,
  SQLiteInstanceCreationOptions,
  SQLiteChangesCheckpoint
> {
  public readonly databaseName: string;
  public readonly collectionName: string;
  public readonly schema: RxJsonSchema<RxDocumentData<RxDocType>>;
  public readonly internals: SQLiteInternals;
  public readonly options: SQLiteInstanceCreationOptions;

  private readonly changeEventSubject = new Subject<EventBulk<RxStorageChangeEvent<RxDocType>, SQLiteChangesCheckpoint>>();
  private closed = false;
  private readonly tableName: string;
  private schemaFields: string[] = [];
  private primaryKey: string = 'id';

  constructor(
    params: RxStorageInstanceCreationParams<RxDocType, SQLiteInstanceCreationOptions>,
    internals: SQLiteInternals
  ) {
    this.databaseName = params.databaseName;
    this.collectionName = params.collectionName;
    this.schema = params.schema;
    this.internals = internals;
    this.options = params.options || {};
    this.tableName = `${this.databaseName}_${this.collectionName}`;

    // Extract primary key from schema
    if (this.schema.primaryKey) {
      this.primaryKey = this.schema.primaryKey;
    }

    // Extract fields from schema
    this.extractSchemaFields();
  }

  /**
   * Extract fields from the schema to create table columns
   */
  private extractSchemaFields(): void {
    if (!this.schema.properties) {
      return;
    }

    // Always include RxDB internal fields
    this.schemaFields = ['_deleted', '_rev'];

    // Add schema properties as fields
    for (const [key, prop] of Object.entries(this.schema.properties)) {
      // Skip the primary key as it's handled separately
      if (key === this.primaryKey) {
        continue;
      }

      // Add the field to our list
      this.schemaFields.push(key);
    }
  }

  /**
   * Get the SQL type for a schema property
   */
  private getSqlType(property: any, isKey: boolean = false): string {
    if (!property || !property.type) {
      return 'TEXT';
    }

    // Handle array of types (e.g., ["string", "null"])
    const type = Array.isArray(property.type) ? property.type[0] : property.type;

    // Check for autoincrement primary key
    if (isKey && type === 'integer' && property.autoIncrement) {
      return 'INTEGER PRIMARY KEY AUTOINCREMENT';
    }

    switch (type) {
      case 'string':
        return 'TEXT';
      case 'number':
      case 'integer':
        return 'INTEGER'; // Use INTEGER instead of REAL for integer types
      case 'boolean':
        return 'INTEGER';
      case 'object':
      case 'array':
        return 'TEXT'; // Store as JSON
      default:
        return 'TEXT';
    }
  }

  /**
   * Check if a field is an autoincrement primary key
   */
  private isAutoIncrementField(field: string): boolean {
    if (field !== this.primaryKey) {
      return false;
    }

    const property = this.schema.properties?.[field];
    if (!property) {
      return false;
    }

    const type = Array.isArray(property.type) ? property.type[0] : property.type;
    return type === 'integer' && property.autoIncrement === true;
  }

  /**
   * Initialize the storage instance by creating the necessary tables
   */
  async initialize(): Promise<void> {
    const db = await this.internals.databasePromise;

    // Create a table name based on the database and collection names
    // Replace hyphens with underscores to avoid SQLite syntax errors
    this.tableName = `${this.databaseName.replace(/-/g, '_')}__${this.collectionName.replace(/-/g, '_')}`;

    // Special handling for RxDB internal collections
    const isRxDBInternal = this.collectionName === '_rxdb_internal';

    // Create a schema object for the table
    let schemaObj: Record<string, string>;

    if (isRxDBInternal) {
      // For RxDB internal collection, use a specific schema
      // Do NOT add NOT NULL constraints to any fields except id
      schemaObj = {
        id: 'TEXT PRIMARY KEY',
        _deleted: 'INTEGER DEFAULT 0',
        _rev: 'TEXT DEFAULT ""',
        key: 'TEXT DEFAULT ""',
        context: 'TEXT DEFAULT ""',
        data: 'TEXT DEFAULT ""',
        _attachments: 'TEXT DEFAULT "{}"',
        _meta: 'TEXT DEFAULT "{}"'
      };
    } else {
      // For regular collections
      schemaObj = {
        id: 'TEXT PRIMARY KEY',
        _deleted: 'INTEGER DEFAULT 0',
        _rev: 'TEXT DEFAULT ""',
        _attachments: 'TEXT DEFAULT "{}"',
        _meta: 'TEXT DEFAULT "{}"'
      };
    }

    // Add columns for each field in the schema
    for (const field of this.schemaFields) {
      // Skip fields we've already added
      if (field === this.primaryKey || field === '_deleted' || field === '_rev') {
        continue;
      }

      const property = this.schema.properties?.[field];
      const sqlType = this.getSqlType(property);

      // All fields should be nullable in SQLite to avoid issues
      // We'll rely on RxDB's validation to enforce required fields
      schemaObj[field] = `${sqlType}`;
    }

    // Use a simple CREATE TABLE statement instead of relying on atmo-db
    const columns = Object.entries(schemaObj)
      .map(([column, type]) => `"${String(column)}" ${type}`)
      .join(', ');
    const createTableSql = `CREATE TABLE IF NOT EXISTS ${this.tableName} (${columns})`;

    // Create the main document table
    const createTableQuery: SQLiteQueryWithParams = {
      query: createTableSql,
      params: [],
      context: {
        method: 'initialize',
        data: { tableName: this.tableName }
      }
    };

    await this.runQuery(db, createTableQuery);

    // Create indexes for better performance
    const createIndexQueries: SQLiteQueryWithParams[] = [
      {
        query: `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_deleted ON ${this.tableName} (_deleted)`,
        params: [],
        context: { method: 'initialize', data: { tableName: this.tableName } }
      }
    ];

    for (const indexQuery of createIndexQueries) {
      await this.runQuery(db, indexQuery);
    }
  }

  /**
   * Helper method to run a query
   */
  private async runQuery(db: SQLiteDatabaseClass, query: SQLiteQueryWithParams): Promise<void> {
    try {
      // Log the actual SQL query with parameters substituted
      let debugQuery = query.query;
      if (query.params && query.params.length > 0) {
        // Replace placeholders with actual values for debugging
        let paramIndex = 0;
        debugQuery = query.query.replace(/\?/g, () => {
          const param = query.params[paramIndex++];
          if (param === null) return 'NULL';
          if (typeof param === 'string') return `'${param.replace(/'/g, "''")}'`;
          return String(param);
        });
      }

      // Convert boolean values to integers for SQLite
      const convertedParams = query.params.map(param =>
        typeof param === 'boolean' ? (param ? 1 : 0) : param
      );

      // Handle better-sqlite3 (synchronous API) vs node-sqlite3 (async API)
      // @ts-ignore - SQLite database methods may vary between implementations
      if (typeof db.run === 'function') {
        // Check if the method returns a Promise
        const result = db.run(query.query, convertedParams);
        if (result instanceof Promise) {
          await result;
        }
      } else if (typeof db.exec === 'function') {
        // Check if the method returns a Promise
        const result = db.exec(query.query, convertedParams);
        if (result instanceof Promise) {
          await result;
        }
      } else if (typeof db.prepare === 'function') {
        const stmt = db.prepare(query.query);
        if (typeof stmt.run === 'function') {
          // Check if the method returns a Promise
          // For better-sqlite3, we need to use the spread operator
          const result = stmt.run(...convertedParams);
          if (result instanceof Promise) {
            await result;
          }
        } else {
          throw new Error('No suitable method found to execute the query');
        }
      } else {
        throw new Error('No suitable method found to execute the query');
      }
    } catch (error) {
      console.error('Error running query:', error);
      console.error('Query:', query.query);
      console.error('Params:', query.params);
      console.error('Collection:', this.collectionName);
      console.error('Table name:', this.tableName);
      console.error('Context:', JSON.stringify(query.context));

      // Create a more detailed error message
      const enhancedError = new Error(
        `SQLite error in collection '${this.collectionName}' (table '${this.tableName}'): ${error.message}\n` +
        `Query: ${query.query}\n` +
        `Params: ${JSON.stringify(query.params)}\n` +
        `Context: ${JSON.stringify(query.context)}`
      );

      // Preserve the original error's stack trace if possible
      if (error.stack) {
        enhancedError.stack = error.stack;
      }

      throw enhancedError;
    }
  }

  /**
   * Convert a document to a row for insertion/update
   */
  private documentToRow(document: RxDocumentData<RxDocType>): Record<string, any> {
    // Debug log the document
    console.log(`Converting document to row for collection ${this.collectionName}:`, JSON.stringify(document));

    // Special handling for RxDB internal documents
    const isRxDBInternal = this.collectionName === '_rxdb_internal';
    if (isRxDBInternal) {
      // For RxDB internal documents, we need to construct a proper ID
      const anyDoc = document as any;

      // Generate an ID if none exists - for RxDB internal, use key and context
      // This is how RxDB internally generates IDs for the _rxdb_internal collection
      let id = document.id;

      if (!id && anyDoc.key && anyDoc.context) {
        id = `${anyDoc.key}|${anyDoc.context}`;
      }

      // If we still don't have an ID, generate a random one
      // This is a fallback for cases where RxDB is inserting a document without an ID, key, or context
      if (!id) {
        id = `generated-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        console.warn(`Generated random ID for _rxdb_internal document: ${id}`);
        console.warn(`Document: ${JSON.stringify(document)}`);
      }

      // Create the row with the ID
      const row: Record<string, any> = {
        id: id,
        _deleted: document._deleted ? 1 : 0,
        _rev: document._rev || '1-initial',  // Provide a default _rev if null
        key: anyDoc.key || '',
        context: anyDoc.context || '',
        data: typeof anyDoc.data === 'object' ? JSON.stringify(anyDoc.data) : (anyDoc.data || ''),  // Only for _rxdb_internal
        _attachments: typeof anyDoc._attachments === 'object' ? JSON.stringify(anyDoc._attachments) : (anyDoc._attachments || '{}'),
        _meta: typeof anyDoc._meta === 'object' ? JSON.stringify(anyDoc._meta) : (anyDoc._meta || '{}')
      };

      console.log(`Converted _rxdb_internal row:`, JSON.stringify(row));
      return row;
    }

    // For regular documents
    // Check if the document has an ID
    if (!document.id) {
      throw new Error(`Cannot insert document without an ID. Collection: ${this.collectionName}, Document: ${JSON.stringify(document)}, Schema: ${JSON.stringify(this.schema)}`);
    }

    const row: Record<string, any> = {
      id: document.id,
      _deleted: document._deleted ? 1 : 0,  // Convert boolean to integer for SQLite
      _rev: document._rev || '1-initial'  // Provide a default _rev if null
    };

    // Add each field from the schema
    for (const field of this.schemaFields) {
      // Skip fields we've already added
      if (field === this.primaryKey || field === '_deleted' || field === '_rev') {
        continue;
      }

      const value = (document as any)[field];

      // Handle complex types (objects, arrays) by serializing to JSON
      if (typeof value === 'object' && value !== null) {
        row[field] = JSON.stringify(value);
      } else if (typeof value === 'boolean') {
        // Convert boolean values to integers for SQLite
        row[field] = value ? 1 : 0;
      } else {
        row[field] = value;
      }
    }

    // Add _attachments and _meta fields
    if (document._attachments) {
      row._attachments = typeof document._attachments === 'object' ?
        JSON.stringify(document._attachments) : document._attachments;
    }

    if (document._meta) {
      row._meta = typeof document._meta === 'object' ?
        JSON.stringify(document._meta) : document._meta;
    }

    console.log(`Converted row for document ${document.id}:`, JSON.stringify(row));
    return row;
  }

  /**
   * Convert a row from the database to a document
   */
  private rowToDocument(row: Record<string, any>): RxDocumentData<RxDocType> {
    console.log(`Converting row to document for collection ${this.collectionName}:`, JSON.stringify(row));

    const document: any = {
      id: row.id,  // Always use 'id' as the key, not this.primaryKey
      _deleted: row._deleted === 1 || Boolean(row._deleted),  // Convert SQLite integer to boolean
      _rev: row._rev || '1-initial'  // Provide a default _rev if null
    };

    // Special handling for RxDB internal documents
    const isRxDBInternal = this.collectionName === '_rxdb_internal';
    if (isRxDBInternal) {
      // Add the special fields for RxDB internal documents
      document.key = row.key || '';
      document.context = row.context || '';

      // Parse JSON fields - data field is only used for _rxdb_internal
      try {
        document.data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
      } catch (e) {
        document.data = row.data || {};
      }

      try {
        document._attachments = typeof row._attachments === 'string' ? JSON.parse(row._attachments) : (row._attachments || {});
      } catch (e) {
        document._attachments = {};
      }

      try {
        document._meta = typeof row._meta === 'string' ? JSON.parse(row._meta) : (row._meta || {});
      } catch (e) {
        document._meta = {};
      }

      console.log(`Converted _rxdb_internal document:`, JSON.stringify(document));
      return document as RxDocumentData<RxDocType>;
    }

    // Add each field from the schema
    for (const field of this.schemaFields) {
      // Skip fields we've already added
      if (field === this.primaryKey || field === '_deleted' || field === '_rev') {
        continue;
      }

      if (row[field] === undefined) {
        continue;
      }

      const property = this.schema.properties?.[field];
      const type = Array.isArray(property?.type) ? property.type[0] : property?.type;

      // Parse JSON for object and array types
      if (type === 'object' || type === 'array') {
        try {
          document[field] = typeof row[field] === 'string' ? JSON.parse(row[field]) : row[field];
        } catch (e) {
          document[field] = row[field];
        }
      } else if (type === 'boolean') {
        // Convert SQLite integer to boolean
        document[field] = row[field] === 1 || Boolean(row[field]);
      } else {
        document[field] = row[field];
      }
    }

    // Parse _attachments and _meta fields
    try {
      document._attachments = typeof row._attachments === 'string' ? JSON.parse(row._attachments) : (row._attachments || {});
    } catch (e) {
      document._attachments = {};
    }

    try {
      document._meta = typeof row._meta === 'string' ? JSON.parse(row._meta) : (row._meta || {});
    } catch (e) {
      document._meta = {};
    }

    console.log(`Converted document for row with ID ${row.id}:`, JSON.stringify(document));
    return document as RxDocumentData<RxDocType>;
  }

  /**
   * Writes multiple documents to the storage instance
   */
  async bulkWrite(
    documentWrites: BulkWriteRow<RxDocType>[],
    context: string
  ): Promise<RxStorageBulkWriteResponse<RxDocType>> {
    if (this.closed) {
      throw new Error('Storage instance is closed');
    }

    const db = await this.internals.databasePromise;
    const response: RxStorageBulkWriteResponse<RxDocType> = {
      success: [],
      error: []
    };

    // Prepare all operations first to validate them before executing any
    const operations: Array<{
      document: RxDocumentData<RxDocType>;
      exists: boolean;
      query: SQLiteQueryWithParams;
    }> = [];

    // First phase: Validate all documents and prepare operations
    for (const writeRow of documentWrites) {
      try {
        const document = writeRow.document;
        const id = document.id as string;

        // Check if document exists and handle conflicts
        const existingDoc = await this.findDocumentsById([id], true);
        const exists = existingDoc.length > 0;

        if (exists && writeRow.previous && existingDoc[0]._rev !== writeRow.previous._rev) {
          // Conflict - document has been modified
          const conflictError = new Error(`Conflict: Document with id ${id} has been modified`);
          response.error.push({
            documentId: id,
            error: conflictError
          });

          // If any document has a conflict, fail the entire operation
          return response;
        }

        // Convert document to row
        let row;
        try {
          row = this.documentToRow(document);
        } catch (err) {
          console.error(`Error converting document to row: ${err.message}`);
          console.error(`Document: ${JSON.stringify(document)}`);
          console.error(`Collection: ${this.collectionName}`);
          console.error(`Schema: ${JSON.stringify(this.schema)}`);

          // Create a more detailed error message
          const enhancedError = new Error(
            `Error converting document to row for collection '${this.collectionName}' (document ID: ${id}): ${err.message}\n` +
            `Document: ${JSON.stringify(document)}`
          );

          // Preserve the original error's stack trace if possible
          if (err.stack) {
            enhancedError.stack = err.stack;
          }

          response.error.push({
            documentId: id,
            error: enhancedError
          });

          // If any document fails validation, fail the entire operation
          return response;
        }

        // Build column names and placeholders for SQL
        // Make sure all column names are strings and properly quoted
        const columns = Object.keys(row).map(col => `"${String(col)}"`);
        const placeholders = Object.keys(row).map(() => '?').join(', ');
        const values = Object.values(row);

        console.log(`bulkWrite ${exists ? 'update' : 'insert'} for document ${id}:`, JSON.stringify(row));

        let query: SQLiteQueryWithParams;

        if (exists) {
          // Update existing document
          const setClause = columns.map(col => `${col} = ?`).join(', ');

          query = {
            query: `UPDATE ${this.tableName} SET ${setClause} WHERE "id" = ?`,
            params: [...values, id],
            context: { method: 'bulkWrite', data: { id } }
          };
        } else {
          // Insert new document
          query = {
            query: `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
            params: values,
            context: { method: 'bulkWrite', data: { id } }
          };
        }

        // Add to operations list
        operations.push({
          document,
          exists,
          query
        });
      } catch (error) {
        // Create a more detailed error message
        const documentId = writeRow.document.id as string;
        const enhancedError = new Error(
          `Error in bulkWrite preparation for collection '${this.collectionName}' (document ID: ${documentId}): ${error.message}\n` +
          `Document: ${JSON.stringify(writeRow.document)}\n` +
          `Previous: ${writeRow.previous ? JSON.stringify(writeRow.previous) : 'none'}`
        );

        // Preserve the original error's stack trace if possible
        if (error.stack) {
          enhancedError.stack = error.stack;
        }

        console.error(enhancedError.message);

        // Add to error
        response.error.push({
          documentId: documentId,
          error: enhancedError
        });

        // If any document fails preparation, fail the entire operation
        return response;
      }
    }

    // Second phase: Execute operations in a transaction
    try {
      // Start transaction
      await this.runQuery(db, {
        query: 'BEGIN TRANSACTION',
        params: [],
        context: { method: 'bulkWrite', data: { action: 'begin' } }
      });

      // Execute all operations using direct database access
      for (const op of operations) {
        try {
          // Use direct database access for better reliability
          // @ts-ignore - SQLite database methods may vary between implementations
          if (typeof db.prepare === 'function') {
            // Clean up the query by removing whitespace and newlines
            const cleanQuery = op.query.query.replace(/\s+/g, ' ').trim();
            console.log('Executing query:', cleanQuery);
            console.log('With params:', op.query.params);

            const stmt = db.prepare(cleanQuery);
            if (typeof stmt.run === 'function') {
              // For better-sqlite3, we need to use the spread operator
              const result = stmt.run(...op.query.params);
              console.log('Direct execution result:', result);
            } else {
              throw new Error('No suitable method found to execute the query');
            }
          } else if (typeof db.run === 'function') {
            // For node-sqlite3
            await db.run(op.query.query, op.query.params);
          } else {
            throw new Error('No suitable method found to execute the query');
          }

          response.success.push(op.document);
        } catch (error) {
          console.error('Error executing operation:', error);
          console.error('Query:', op.query.query);
          console.error('Params:', op.query.params);

          // Create a more detailed error message
          const enhancedError = new Error(
            `Error executing operation for document '${op.document.id}': ${error.message}\n` +
            `Query: ${op.query.query}\n` +
            `Params: ${JSON.stringify(op.query.params)}`
          );

          // Preserve the original error's stack trace if possible
          if (error.stack) {
            enhancedError.stack = error.stack;
          }

          throw enhancedError;
        }
      }

      // Commit transaction
      await this.runQuery(db, {
        query: 'COMMIT',
        params: [],
        context: { method: 'bulkWrite', data: { action: 'commit' } }
      });

      // Emit change events for successful writes
      if (response.success.length > 0) {
        const changeEvents: RxStorageChangeEvent<RxDocType>[] = response.success.map((doc, index) => {
          const operation = doc._deleted ? 'DELETE' : (operations[index].exists ? 'UPDATE' : 'INSERT');
          return {
            documentId: doc.id as string,
            documentData: doc,
            operation,
            previousDocumentData: documentWrites[index].previous || null,
            isLocal: context.startsWith('local-')
          };
        });

        const eventBulk: EventBulk<RxStorageChangeEvent<RxDocType>, SQLiteChangesCheckpoint> = {
          events: changeEvents,
          checkpoint: {
            id: changeEvents[changeEvents.length - 1].documentId,
            lwt: Date.now()
          },
          context
        };

        this.changeEventSubject.next(eventBulk);
      }
    } catch (error) {
      // If any error occurs during the transaction, roll back
      try {
        await this.runQuery(db, {
          query: 'ROLLBACK',
          params: [],
          context: { method: 'bulkWrite', data: { action: 'rollback' } }
        });
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }

      // Create a more detailed error message
      const enhancedError = new Error(
        `Error in bulkWrite transaction for collection '${this.collectionName}': ${error.message}\n` +
        `Transaction rolled back, no changes were made.`
      );

      // Preserve the original error's stack trace if possible
      if (error.stack) {
        enhancedError.stack = error.stack;
      }

      console.error(enhancedError.message);

      // Add to error - use the first document ID as the error ID
      const firstDocId = documentWrites[0]?.document?.id as string || 'transaction-error';
      response.error.push({
        documentId: firstDocId,
        error: enhancedError
      });

      // Clear any success entries since the transaction was rolled back
      response.success = [];
    }

    return response;
  }

  /**
   * Get multiple documents by their primary value
   */
  async findDocumentsById(
    ids: string[],
    withDeleted: boolean
  ): Promise<RxDocumentData<RxDocType>[]> {
    if (this.closed) {
      throw new Error('Storage instance is closed');
    }

    if (ids.length === 0) {
      return [];
    }

    const db = await this.internals.databasePromise;

    // Build placeholders for the IN clause
    const placeholders = ids.map(() => '?').join(',');

    // Build the query
    let query = `
      SELECT *
      FROM ${this.tableName}
      WHERE "id" IN (${placeholders})
    `;

    // Add deleted filter if needed
    if (!withDeleted) {
      query += ' AND "_deleted" = 0';
    }

    const queryWithParams: SQLiteQueryWithParams = {
      query,
      params: [...ids],
      context: { method: 'findDocumentsById', data: { ids } }
    };

    // Execute the query
    let rows;
    try {
      // Convert boolean values to integers for SQLite
      const convertedParams = queryWithParams.params.map(param =>
        typeof param === 'boolean' ? (param ? 1 : 0) : param
      );

      // Handle better-sqlite3 (synchronous API) vs node-sqlite3 (async API)
      // @ts-ignore - SQLite database methods may vary between implementations
      if (typeof db.all === 'function') {
        const result = db.all(queryWithParams.query, convertedParams);
        rows = result instanceof Promise ? await result : result;
      } else if (typeof db.prepare === 'function') {
        const stmt = db.prepare(queryWithParams.query);
        if (typeof stmt.all === 'function') {
          // For better-sqlite3, we need to use the spread operator
          const result = stmt.all(...convertedParams);
          rows = result instanceof Promise ? await result : result;
        } else if (typeof stmt.get === 'function') {
          // Fallback to get for single row
          // For better-sqlite3, we need to use the spread operator
          const result = stmt.get(...convertedParams);
          const singleRow = result instanceof Promise ? await result : result;
          rows = singleRow ? [singleRow] : [];
        } else {
          throw new Error('No suitable method found to execute the query');
        }
      } else {
        throw new Error('No suitable method found to execute the query');
      }
    } catch (error) {
      console.error('Error executing query:', error);
      console.error('Query:', queryWithParams.query);
      console.error('Params:', queryWithParams.params);
      rows = [];
    }

    // Convert rows to documents
    return rows.map(row => this.rowToDocument(row));
  }

  /**
   * Run a query over the storage
   */
  async query(
    preparedQuery: PreparedQuery<RxDocType>
  ): Promise<RxStorageQueryResult<RxDocType>> {
    if (this.closed) {
      throw new Error('Storage instance is closed');
    }

    const db = await this.internals.databasePromise;

    // Build the query
    const { query, params } = getSQLiteQueryBuilderFromMangoQuery(
      preparedQuery.query,
      this.tableName
    );

    // Convert boolean values to integers for SQLite
    const convertedParams = params.map(param =>
      typeof param === 'boolean' ? (param ? 1 : 0) : param
    );

    const queryWithParams: SQLiteQueryWithParams = {
      query,
      params: convertedParams,
      context: { method: 'query', data: { preparedQuery } }
    };

    // Execute the query
    let rows;
    try {
      // @ts-ignore - SQLite database methods may vary between implementations
      if (typeof db.all === 'function') {
        rows = await db.all(queryWithParams.query, queryWithParams.params);
      } else if (typeof db.prepare === 'function') {
        const stmt = db.prepare(queryWithParams.query);
        if (typeof stmt.all === 'function') {
          // For better-sqlite3, we need to use the spread operator
          rows = stmt.all(...queryWithParams.params);
        } else if (typeof stmt.get === 'function') {
          // Fallback to get for single row
          // For better-sqlite3, we need to use the spread operator
          const result = stmt.get(...queryWithParams.params);
          rows = result ? [result] : [];
        } else {
          throw new Error('No suitable method found to execute the query');
        }
      } else {
        throw new Error('No suitable method found to execute the query');
      }
    } catch (error) {
      console.error('Error executing query:', error);
      console.error('Query:', queryWithParams.query);
      console.error('Params:', queryWithParams.params);
      rows = [];
    }

    // Convert rows to documents
    const documents = rows.map(row => this.rowToDocument(row));

    return {
      documents
    };
  }

  /**
   * Count documents matching a query
   */
  async count(
    preparedQuery: PreparedQuery<RxDocType>
  ): Promise<RxStorageCountResult> {
    if (this.closed) {
      throw new Error('Storage instance is closed');
    }

    const db = await this.internals.databasePromise;

    // Build the query but modify it to be a COUNT query
    const { query, params } = getSQLiteQueryBuilderFromMangoQuery(
      preparedQuery.query,
      this.tableName,
      true
    );

    // Convert boolean values to integers for SQLite
    const convertedParams = params.map(param =>
      typeof param === 'boolean' ? (param ? 1 : 0) : param
    );

    const queryWithParams: SQLiteQueryWithParams = {
      query,
      params: convertedParams,
      context: { method: 'count', data: { preparedQuery } }
    };

    // Execute the query
    let rows;
    try {
      // @ts-ignore - SQLite database methods may vary between implementations
      if (typeof db.all === 'function') {
        rows = await db.all(queryWithParams.query, queryWithParams.params);
      } else if (typeof db.prepare === 'function') {
        const stmt = db.prepare(queryWithParams.query);
        if (typeof stmt.all === 'function') {
          // For better-sqlite3, we need to use the spread operator
          rows = stmt.all(...queryWithParams.params);
        } else if (typeof stmt.get === 'function') {
          // Fallback to get for single row
          // For better-sqlite3, we need to use the spread operator
          const result = stmt.get(...queryWithParams.params);
          rows = result ? [result] : [];
        } else {
          throw new Error('No suitable method found to execute the query');
        }
      } else {
        throw new Error('No suitable method found to execute the query');
      }
    } catch (error) {
      console.error('Error executing query:', error);
      console.error('Query:', queryWithParams.query);
      console.error('Params:', queryWithParams.params);
      rows = [];
    }

    // Parse the result
    const count = rows[0]?.count || 0;

    return {
      count,
      mode: 'fast'
    };
  }

  /**
   * Get attachment data
   */
  async getAttachmentData(
    documentId: string,
    attachmentId: string,
    digest: string
  ): Promise<string> {
    if (this.closed) {
      throw new Error('Storage instance is closed');
    }

    // For now, we'll implement a simple version that gets the document
    // and extracts the attachment data from it
    const docs = await this.findDocumentsById([documentId], true);

    if (docs.length === 0) {
      throw new Error(`Document with id ${documentId} not found`);
    }

    const doc = docs[0];

    // @ts-ignore - RxDB's attachment structure
    if (!doc._attachments || !doc._attachments[attachmentId]) {
      throw new Error(`Attachment ${attachmentId} not found in document ${documentId}`);
    }

    // @ts-ignore - RxDB's attachment structure
    const attachment = doc._attachments[attachmentId];

    if (attachment.digest !== digest) {
      throw new Error(`Digest mismatch for attachment ${attachmentId}`);
    }

    return attachment.data;
  }

  /**
   * Get changed documents since a checkpoint
   */
  async getChangedDocumentsSince(
    limit: number,
    checkpoint?: SQLiteChangesCheckpoint
  ): Promise<{
    documents: RxDocumentData<RxDocType>[];
    checkpoint: SQLiteChangesCheckpoint;
  }> {
    if (this.closed) {
      throw new Error('Storage instance is closed');
    }

    const db = await this.internals.databasePromise;

    // Build the query
    let query = `
      SELECT *
      FROM ${this.tableName}
    `;

    const params: any[] = [];

    // Add checkpoint filter if provided
    if (checkpoint) {
      query += ` WHERE ("id" > ? OR ("id" = ? AND "_rev" > ?))`;
      params.push(checkpoint.id, checkpoint.id, checkpoint.id);
    }

    // Add order and limit
    query += ` ORDER BY "id" ASC LIMIT ?`;
    params.push(limit);

    const queryWithParams: SQLiteQueryWithParams = {
      query,
      params,
      context: { method: 'getChangedDocumentsSince', data: { checkpoint } }
    };

    // Execute the query
    let rows;
    try {
      // Convert boolean values to integers for SQLite
      const convertedParams = queryWithParams.params.map(param =>
        typeof param === 'boolean' ? (param ? 1 : 0) : param
      );

      // @ts-ignore - SQLite database methods may vary between implementations
      if (typeof db.all === 'function') {
        rows = await db.all(queryWithParams.query, convertedParams);
      } else if (typeof db.prepare === 'function') {
        const stmt = db.prepare(queryWithParams.query);
        if (typeof stmt.all === 'function') {
          // For better-sqlite3, we need to use the spread operator
          rows = stmt.all(...convertedParams);
        } else if (typeof stmt.get === 'function') {
          // Fallback to get for single row
          // For better-sqlite3, we need to use the spread operator
          const result = stmt.get(...convertedParams);
          rows = result ? [result] : [];
        } else {
          throw new Error('No suitable method found to execute the query');
        }
      } else {
        throw new Error('No suitable method found to execute the query');
      }
    } catch (error) {
      console.error('Error executing query:', error);
      console.error('Query:', queryWithParams.query);
      console.error('Params:', queryWithParams.params);
      rows = [];
    }

    // Convert rows to documents
    const documents = rows.map(row => this.rowToDocument(row));

    // Create a new checkpoint
    const newCheckpoint: SQLiteChangesCheckpoint = documents.length > 0
      ? {
          id: documents[documents.length - 1].id as string,
          lwt: Date.now()
        }
      : checkpoint || { id: '', lwt: Date.now() };

    return {
      documents,
      checkpoint: newCheckpoint
    };
  }

  /**
   * Get a stream of changes
   */
  changeStream(): Observable<EventBulk<RxStorageChangeEvent<RxDocType>, SQLiteChangesCheckpoint>> {
    return this.changeEventSubject.asObservable();
  }

  /**
   * Clean up deleted documents
   */
  async cleanup(minimumDeletedTime: number): Promise<boolean> {
    if (this.closed) {
      throw new Error('Storage instance is closed');
    }

    const db = await this.internals.databasePromise;

    // Calculate the cutoff time
    const cutoffTime = Date.now() - minimumDeletedTime;

    // Build the query to find documents to clean up
    const findQuery: SQLiteQueryWithParams = {
      query: `
        SELECT "${this.primaryKey}"
        FROM ${this.tableName}
        WHERE "_deleted" = 1
        LIMIT 100
      `,
      params: [],
      context: { method: 'cleanup', data: { minimumDeletedTime } }
    };

    // Execute the query
    let rows;
    try {
      // Convert boolean values to integers for SQLite
      const convertedParams = findQuery.params.map(param =>
        typeof param === 'boolean' ? (param ? 1 : 0) : param
      );

      // @ts-ignore - SQLite database methods may vary between implementations
      if (typeof db.all === 'function') {
        rows = await db.all(findQuery.query, convertedParams);
      } else if (typeof db.prepare === 'function') {
        const stmt = db.prepare(findQuery.query);
        if (typeof stmt.all === 'function') {
          // For better-sqlite3, we need to use the spread operator
          rows = stmt.all(...convertedParams);
        } else if (typeof stmt.get === 'function') {
          // Fallback to get for single row
          // For better-sqlite3, we need to use the spread operator
          const result = stmt.get(...convertedParams);
          rows = result ? [result] : [];
        } else {
          throw new Error('No suitable method found to execute the query');
        }
      } else {
        throw new Error('No suitable method found to execute the query');
      }
    } catch (error) {
      console.error('Error executing query:', error);
      console.error('Query:', findQuery.query);
      console.error('Params:', findQuery.params);
      rows = [];
    }

    if (rows.length === 0) {
      // No documents to clean up
      return true;
    }

    // Delete the documents
    const ids = rows.map(row => row[this.primaryKey]);
    const placeholders = ids.map(() => '?').join(',');

    const deleteQuery: SQLiteQueryWithParams = {
      query: `
        DELETE FROM ${this.tableName}
        WHERE "${this.primaryKey}" IN (${placeholders})
      `,
      params: ids,
      context: { method: 'cleanup', data: { ids } }
    };

    await this.runQuery(db, deleteQuery);

    // Return false if there might be more documents to clean up
    return rows.length < 100;
  }

  /**
   * Close the storage instance
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.changeEventSubject.complete();
  }

  /**
   * Remove the storage instance
   */
  async remove(): Promise<void> {
    if (this.closed) {
      throw new Error('Storage instance is closed');
    }

    const db = await this.internals.databasePromise;

    // Drop the table
    const dropQuery: SQLiteQueryWithParams = {
      query: `DROP TABLE IF EXISTS ${this.tableName}`,
      params: [],
      context: { method: 'remove', data: { tableName: this.tableName } }
    };

    await this.runQuery(db, dropQuery);

    // Close the instance
    await this.close();
  }
}
