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

    // Create a schema object for atmo-db's createTableSchema function
    const schemaObj: Record<string, string> = {
      [this.primaryKey]: 'TEXT PRIMARY KEY',
      _deleted: 'INTEGER DEFAULT 0',
      _rev: 'TEXT NOT NULL'
    };

    // Add columns for each field in the schema
    for (const field of this.schemaFields) {
      // Skip fields we've already added
      if (field === this.primaryKey || field === '_deleted' || field === '_rev') {
        continue;
      }

      const property = this.schema.properties?.[field];
      const sqlType = this.getSqlType(property);

      // Handle nullable fields
      const isNullable = Array.isArray(property?.type) && property.type.includes('null');
      const nullConstraint = isNullable ? '' : 'NOT NULL';

      schemaObj[field] = `${sqlType} ${nullConstraint}`;
    }

    // Use atmo-db's createTableSchema function to generate the CREATE TABLE statement
    // @ts-ignore - Import from @wonderlandlabs/atmo-db
    const { createTableSchema } = require('@wonderlandlabs/atmo-db');

    let createTableSql: string;
    try {
      createTableSql = createTableSchema(this.tableName, schemaObj);
    } catch (error) {
      console.error('Error creating table schema:', error);
      // Fallback to a simple CREATE TABLE statement
      const columns = Object.entries(schemaObj)
        .map(([column, type]) => `${column} ${type}`)
        .join(', ');
      createTableSql = `CREATE TABLE IF NOT EXISTS ${this.tableName} (${columns})`;
    }

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
      // @ts-ignore - SQLite database methods may vary between implementations
      if (typeof db.run === 'function') {
        await db.run(query.query, query.params);
      } else if (typeof db.exec === 'function') {
        await db.exec(query.query, query.params);
      } else if (typeof db.prepare === 'function') {
        const stmt = db.prepare(query.query);
        if (typeof stmt.run === 'function') {
          await stmt.run(query.params);
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
      throw error;
    }
  }

  /**
   * Convert a document to a row for insertion/update
   */
  private documentToRow(document: RxDocumentData<RxDocType>): Record<string, any> {
    const row: Record<string, any> = {
      [this.primaryKey]: document.id,
      _deleted: document._deleted ? 1 : 0,
      _rev: document._rev
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
      } else {
        row[field] = value;
      }
    }

    return row;
  }

  /**
   * Convert a row from the database to a document
   */
  private rowToDocument(row: Record<string, any>): RxDocumentData<RxDocType> {
    const document: any = {
      id: row[this.primaryKey],
      _deleted: Boolean(row._deleted),
      _rev: row._rev
    };

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
      } else {
        document[field] = row[field];
      }
    }

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

    // Process each document write
    for (const writeRow of documentWrites) {
      try {
        const document = writeRow.document;
        const id = document.id as string;

        // Check if document exists and handle conflicts
        const existingDoc = await this.findDocumentsById([id], true);
        const exists = existingDoc.length > 0;

        if (exists && writeRow.previous && existingDoc[0]._rev !== writeRow.previous._rev) {
          // Conflict - document has been modified
          response.error.push({
            documentId: id,
            error: new Error(`Conflict: Document with id ${id} has been modified`)
          });
          continue;
        }

        // Convert document to row
        const row = this.documentToRow(document);

        // Build column names and placeholders for SQL
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map(col => row[col]);

        if (exists) {
          // Update existing document
          const setClause = columns.map(col => `${col} = ?`).join(', ');

          const updateQuery: SQLiteQueryWithParams = {
            query: `
              UPDATE ${this.tableName}
              SET ${setClause}
              WHERE ${this.primaryKey} = ?
            `,
            params: [...values, id],
            context: { method: 'bulkWrite', data: { id } }
          };

          await this.runQuery(db, updateQuery);
        } else {
          // Insert new document
          const insertQuery: SQLiteQueryWithParams = {
            query: `
              INSERT INTO ${this.tableName} (${columns.join(', ')})
              VALUES (${placeholders})
            `,
            params: values,
            context: { method: 'bulkWrite', data: { id } }
          };

          await this.runQuery(db, insertQuery);
        }

        // Add to success
        response.success.push(document);
      } catch (error) {
        // Add to error
        response.error.push({
          documentId: writeRow.document.id as string,
          error: error as Error
        });
      }
    }

    // Emit change events for successful writes
    if (response.success.length > 0) {
      const changeEvents: RxStorageChangeEvent<RxDocType>[] = response.success.map(doc => ({
        documentId: doc.id as string,
        documentData: doc,
        operation: doc._deleted ? 'DELETE' : 'INSERT',
        previousDocumentData: null,
        isLocal: context.startsWith('local-')
      }));

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
      WHERE ${this.primaryKey} IN (${placeholders})
    `;

    // Add deleted filter if needed
    if (!withDeleted) {
      query += ' AND _deleted = 0';
    }

    const queryWithParams: SQLiteQueryWithParams = {
      query,
      params: [...ids],
      context: { method: 'findDocumentsById', data: { ids } }
    };

    // Execute the query
    const rows = await db.all(queryWithParams);

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

    const queryWithParams: SQLiteQueryWithParams = {
      query,
      params,
      context: { method: 'query', data: { preparedQuery } }
    };

    // Execute the query
    const rows = await db.all(queryWithParams);

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

    const queryWithParams: SQLiteQueryWithParams = {
      query,
      params,
      context: { method: 'count', data: { preparedQuery } }
    };

    // Execute the query
    const rows = await db.all(queryWithParams);

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
      query += ` WHERE (${this.primaryKey} > ? OR (${this.primaryKey} = ? AND _rev > ?))`;
      params.push(checkpoint.id, checkpoint.id, checkpoint.id);
    }

    // Add order and limit
    query += ` ORDER BY ${this.primaryKey} ASC LIMIT ?`;
    params.push(limit);

    const queryWithParams: SQLiteQueryWithParams = {
      query,
      params,
      context: { method: 'getChangedDocumentsSince', data: { checkpoint } }
    };

    // Execute the query
    const rows = await db.all(queryWithParams);

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
        SELECT ${this.primaryKey}
        FROM ${this.tableName}
        WHERE _deleted = 1
        LIMIT 100
      `,
      params: [],
      context: { method: 'cleanup', data: { minimumDeletedTime } }
    };

    // Execute the query
    const rows = await db.all(findQuery);

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
        WHERE ${this.primaryKey} IN (${placeholders})
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
