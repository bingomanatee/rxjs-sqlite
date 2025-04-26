declare module 'rxdb/dist/types/plugins/storage-sqlite/sqlite-types' {
  import type { RxDocumentData, RxStorageChangeEvent, RxStorageDefaultCheckpoint } from 'rxdb';

  export interface SQLiteBasics {
    open: (filename: string) => Promise<any>;
    journalMode?: string;
    setPragma: (db: any, pragma: string, value: string) => Promise<void>;
  }

  export interface SQLiteQueryWithParams {
    query: string;
    params: any[];
    context?: {
      method: string;
      data: any
    };
  }

  export interface SQLiteDatabaseClass {
    prepare: (sql: string) => any;
    exec: (sql: string) => void;
    transaction: (fn: () => void) => void;
    close: () => void;
  }

  export interface SQLiteChangesCheckpoint extends RxStorageDefaultCheckpoint {
    id: string;
    lwt: number;
  }

  export interface EventBulk<RxStorageChangeEvent, SQLiteChangesCheckpoint> {
    id: string;
    events: RxStorageChangeEvent[];
    checkpoint: SQLiteChangesCheckpoint;
    context: string;
  }

  export interface RxStorageBulkWriteResponse<RxDocType> {
    success: RxDocumentData<RxDocType>[];
    error: RxStorageWriteError<RxDocType>[];
  }

  export interface RxStorageWriteError<RxDocType> {
    documentId: string;
    isError: boolean;
    error: Error;
  }
}

declare module '@wonderlandlabs/atmo-db' {
  export function cmp(field: string, op: string, value: any): any;
  export function and(...conditions: any[]): any;
  export function or(...conditions: any[]): any;
  export function not(condition: any): any;
  export function parseNode(node: any): any;
  export function createTableSchema(schema: any): any;
}
