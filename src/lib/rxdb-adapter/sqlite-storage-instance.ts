/**
 * RxDB SQLite Storage Instance Implementation
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

/**
 * RxDB SQLite Storage Instance
 */
export class RxStorageInstanceSQLite<RxDocType> implements RxStorageInstance<
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
  }

  /**
   * Initialize the storage instance by creating the necessary tables
   */
  async initialize(): Promise<void> {
    const db = await this.internals.databasePromise;

    // Create the main document table
    const createTableQuery: SQLiteQueryWithParams = {
      query: `
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          _deleted INTEGER DEFAULT 0,
          _rev TEXT NOT NULL,
          _meta TEXT
        )
      `,
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
      // Prepare the statement and run it with parameters
      const stmt = db.prepare(query.query);
      await stmt.run(query.params || []);
    } catch (error) {
      console.error('Error running query:', error);
      console.error('Query:', query.query);
      console.error('Params:', query.params);
      throw error;
    }
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

        // Prepare document data
        const documentJson = JSON.stringify(document);

        if (exists) {
          // Update existing document
          const updateQuery: SQLiteQueryWithParams = {
            query: `
              UPDATE ${this.tableName}
              SET data = ?, _deleted = ?, _rev = ?, _meta = ?
              WHERE id = ?
            `,
            params: [
              documentJson,
              document._deleted ? 1 : 0,
              document._rev,
              document._meta ? JSON.stringify(document._meta) : null,
              id
            ],
            context: { method: 'bulkWrite', data: { id } }
          };

          await this.runQuery(db, updateQuery);
        } else {
          // Insert new document
          const insertQuery: SQLiteQueryWithParams = {
            query: `
              INSERT INTO ${this.tableName} (id, data, _deleted, _rev, _meta)
              VALUES (?, ?, ?, ?, ?)
            `,
            params: [
              id,
              documentJson,
              document._deleted ? 1 : 0,
              document._rev,
              document._meta ? JSON.stringify(document._meta) : null
            ],
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
      SELECT id, data, _deleted, _rev, _meta
      FROM ${this.tableName}
      WHERE id IN (${placeholders})
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
    const stmt = db.prepare(queryWithParams.query);
    const rows = await stmt.all(queryWithParams.params || []);

    // Parse the results
    return rows.map(row => {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      return data as RxDocumentData<RxDocType>;
    });
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
    const stmt = db.prepare(queryWithParams.query);
    const rows = await stmt.all(queryWithParams.params || []);

    // Parse the results
    const documents = rows.map(row => {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      return data as RxDocumentData<RxDocType>;
    });

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
    const stmt = db.prepare(queryWithParams.query);
    const rows = await stmt.all(queryWithParams.params || []);

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
      SELECT id, data, _deleted, _rev, _meta
      FROM ${this.tableName}
    `;

    const params: any[] = [];

    // Add checkpoint filter if provided
    if (checkpoint) {
      query += ` WHERE (id > ? OR (id = ? AND _rev > ?))`;
      params.push(checkpoint.id, checkpoint.id, checkpoint.id);
    }

    // Add order and limit
    query += ` ORDER BY id ASC LIMIT ?`;
    params.push(limit);

    const queryWithParams: SQLiteQueryWithParams = {
      query,
      params,
      context: { method: 'getChangedDocumentsSince', data: { checkpoint } }
    };

    // Execute the query
    const stmt = db.prepare(queryWithParams.query);
    const rows = await stmt.all(queryWithParams.params || []);

    // Parse the results
    const documents = rows.map(row => {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      return data as RxDocumentData<RxDocType>;
    });

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
        SELECT id
        FROM ${this.tableName}
        WHERE _deleted = 1
        AND json_extract(data, '$._meta.lwt') < ?
        LIMIT 100
      `,
      params: [cutoffTime],
      context: { method: 'cleanup', data: { minimumDeletedTime } }
    };

    // Execute the query
    const stmt = db.prepare(findQuery.query);
    const rows = await stmt.all(findQuery.params || []);

    if (rows.length === 0) {
      // No documents to clean up
      return true;
    }

    // Delete the documents
    const ids = rows.map(row => row.id);
    const placeholders = ids.map(() => '?').join(',');

    const deleteQuery: SQLiteQueryWithParams = {
      query: `
        DELETE FROM ${this.tableName}
        WHERE id IN (${placeholders})
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
