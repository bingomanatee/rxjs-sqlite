/**
 * RxDB SQLite Adapter
 * This adapter allows RxDB to use SQLite as a storage engine
 */
const Database = require("better-sqlite3");

/**
 * SQLite basics implementation using better-sqlite3
 */
function getSQLiteBasicsBetterSQLite(options = {}) {
  return {
    open: async (name) => {
      // Create a new database connection
      const db = new Database(name, options);

      // Enable WAL mode for better performance
      db.pragma("journal_mode = WAL");

      return db;
    },

    setPragma: async (db, key, value) => {
      db.pragma(`${key} = ${value}`);
    },

    journalMode: "WAL",
  };
}

/**
 * RxStorage implementation for SQLite using better-sqlite3
 */
class RxStorageSQLite {
  constructor(settings) {
    this.name = "sqlite";
    this.settings = settings;
  }

  /**
   * Create a storage instance for a collection
   */
  async createStorageInstance(params) {
    // Create a database connection
    const databaseName = params.databaseName;
    const dbPath = `${
      this.settings.databaseNamePrefix || ""
    }${databaseName}.sqlite`;

    // Create the database connection
    const db = await this.settings.sqliteBasics.open(dbPath);

    // Set up the database with WAL mode for better performance
    if (this.settings.sqliteBasics.journalMode) {
      await this.settings.sqliteBasics.setPragma(
        db,
        "journal_mode",
        this.settings.sqliteBasics.journalMode
      );
    }

    // Store the database instance in the static property
    getRxStorageSQLite.lastDB = db;

    // Create the table for the collection if it doesn't exist
    const tableName = `${databaseName}_${params.collectionName}`;
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        _deleted INTEGER DEFAULT 0,
        _rev TEXT NOT NULL
      )
    `);

    // Create a storage instance
    const storageInstance = {
      databaseName: params.databaseName,
      collectionName: params.collectionName,
      schema: params.schema,
      internals: { databasePromise: Promise.resolve(db), sqlite: db },

      // Initialize the storage instance
      initialize: async () => {},

      // Write documents
      bulkWrite: async (documentWrites) => {
        const response = {
          success: [],
          error: [],
        };

        for (const writeRow of documentWrites) {
          try {
            const document = writeRow.document;
            const id = document.id;
            const documentJson = JSON.stringify(document);

            // Check if document exists
            const existingDoc = db
              .prepare(`SELECT id FROM ${tableName} WHERE id = ?`)
              .get(id);

            if (existingDoc) {
              // Update existing document
              db.prepare(
                `
                UPDATE ${tableName}
                SET data = ?, _deleted = ?, _rev = ?
                WHERE id = ?
              `
              ).run(documentJson, document._deleted ? 1 : 0, document._rev, id);
            } else {
              // Insert new document
              db.prepare(
                `
                INSERT INTO ${tableName} (id, data, _deleted, _rev)
                VALUES (?, ?, ?, ?)
              `
              ).run(id, documentJson, document._deleted ? 1 : 0, document._rev);
            }

            response.success.push(document);
          } catch (error) {
            console.error("Error writing document:", error);
            response.error.push({
              documentId: writeRow.document.id,
              error,
            });
          }
        }

        return response;
      },

      // Find documents by ID
      findDocumentsById: async (ids, withDeleted = false) => {
        if (ids.length === 0) {
          return [];
        }

        const placeholders = ids.map(() => "?").join(",");
        let query = `SELECT data FROM ${tableName} WHERE id IN (${placeholders})`;

        if (!withDeleted) {
          query += " AND _deleted = 0";
        }

        const rows = db.prepare(query).all(ids);

        return rows.map((row) => JSON.parse(row.data));
      },

      // Query documents
      query: async (preparedQuery) => {
        // Simple implementation that returns all documents
        const rows = db
          .prepare(`SELECT data FROM ${tableName} WHERE _deleted = 0`)
          .all();

        return {
          documents: rows.map((row) => JSON.parse(row.data)),
        };
      },

      // Count documents
      count: async () => {
        const count = db
          .prepare(
            `SELECT COUNT(*) as count FROM ${tableName} WHERE _deleted = 0`
          )
          .get().count;

        return {
          count,
          mode: "fast",
        };
      },

      // Get attachment data
      getAttachmentData: async () => "",

      // Get changed documents
      getChangedDocumentsSince: async () => ({
        documents: [],
        checkpoint: {},
      }),

      // Change stream
      changeStream: () => {
        const stream = {
          subscribe: () => ({
            unsubscribe: () => {},
          }),
          pipe: (...operators) => {
            // Return a new observable that has the operators applied
            return {
              subscribe: (observer) => {
                // Apply the operators to the observer
                return { unsubscribe: () => {} };
              },
            };
          },
        };
        return stream;
      },

      // Clean up deleted documents
      cleanup: async () => true,

      // Close the storage instance
      close: async () => {
        // Close the database connection
        if (db) {
          db.close();
        }
      },
    };

    return storageInstance;
  }
}

/**
 * Factory function to create a SQLite storage adapter
 */
function getRxStorageSQLite(options = {}) {
  const sqliteBasics = getSQLiteBasicsBetterSQLite(options);

  return new RxStorageSQLite({
    sqliteBasics,
    databaseNamePrefix: "rxdb-",
  });
}

// Add a static method to get the last created database instance
getRxStorageSQLite.getLastDB = function () {
  return getRxStorageSQLite.lastDB;
};

module.exports = {
  getRxStorageSQLite,
};
