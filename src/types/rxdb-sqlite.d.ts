declare module 'rxdb/dist/types/plugins/storage-sqlite/sqlite-types' {
  export interface SQLiteBasics {
    open: (filename: string) => Promise<any>;
    journalMode?: string;
    setPragma: (db: any, pragma: string, value: string) => Promise<void>;
  }

  export interface SQLiteQueryWithParams {
    sql: string;
    params: any[];
  }

  export interface SQLiteDatabaseClass {
    prepare: (sql: string) => any;
    exec: (sql: string) => void;
    transaction: (fn: () => void) => void;
    close: () => void;
  }
}
