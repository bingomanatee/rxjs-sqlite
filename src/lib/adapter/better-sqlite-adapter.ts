/**
 * RxJS adapter for better-sqlite3
 */
import Database from 'better-sqlite3';
import { Observable, Subject, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { SQLiteAdapter, SQLiteQueryOptions, SQLiteRow, SQLiteTransaction, SQLiteValue } from '../types';
import { rowsToObjects } from '../utils/sqlite-utils';

/**
 * Implementation of SQLiteTransaction using better-sqlite3
 */
class BetterSQLiteTransaction implements SQLiteTransaction {
  private transaction: Database.Transaction;
  private statements: { sql: string; params: SQLiteValue[] | Record<string, SQLiteValue> }[] = [];

  constructor(private db: Database.Database) {
    this.transaction = db.transaction((stmts) => {
      for (const stmt of stmts) {
        this.db.prepare(stmt.sql).run(stmt.params);
      }
    });
  }

  execute(sql: string, params: SQLiteValue[] | Record<string, SQLiteValue> = []): void {
    // Store the statement for later execution
    this.statements.push({ sql, params });
  }

  query<T = SQLiteRow>(sql: string, params: SQLiteValue[] | Record<string, SQLiteValue> = []): T[] {
    // For queries, execute directly
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(params);
    return rowsToObjects<T>(rows);
  }

  commit(): void {
    // Execute all stored statements in a transaction
    this.transaction(this.statements);
    this.statements = [];
  }

  rollback(): void {
    // Clear the statements without executing them
    this.statements = [];
  }
}

/**
 * RxJS adapter for better-sqlite3
 */
export class BetterSQLiteAdapter implements SQLiteAdapter {
  private db: Database.Database;
  private changeSubject = new Subject<void>();
  private change$ = this.changeSubject.asObservable().pipe(shareReplay(1));

  constructor(dbPath: string, options?: Database.Options) {
    this.db = new Database(dbPath, options);

    // Set up change tracking
    this.db.function('notify_change', () => {
      this.changeSubject.next();
      return true;
    });
  }

  execute(sql: string, options: SQLiteQueryOptions = {}): void {
    const stmt = this.db.prepare(sql);
    stmt.run(options.params || []);

    // Notify about changes for reactive queries
    if (sql.trim().toUpperCase().startsWith('INSERT') ||
        sql.trim().toUpperCase().startsWith('UPDATE') ||
        sql.trim().toUpperCase().startsWith('DELETE')) {
      this.changeSubject.next();
    }
  }

  query<T = SQLiteRow>(sql: string, options: SQLiteQueryOptions = {}): Observable<T[]> {
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(options.params || []);

    return of(rowsToObjects<T>(rows));
  }

  queryOne<T = SQLiteRow>(sql: string, options: SQLiteQueryOptions = {}): Observable<T | undefined> {
    return this.query<T>(sql, options).pipe(
      map(rows => rows[0])
    );
  }

  transaction(): SQLiteTransaction {
    return new BetterSQLiteTransaction(this.db);
  }

  reactiveQuery<T = SQLiteRow>(sql: string, options: SQLiteQueryOptions = {}): Observable<T[]> {
    // Execute the initial query and set up reactive updates
    return this.change$.pipe(
      // Map to query results whenever a change is detected
      map(() => {
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(options.params || []);
        return rowsToObjects<T>(rows);
      }),
      // Share the latest result with new subscribers
      shareReplay(1)
    );
  }

  close(): void {
    this.db.close();
  }
}
