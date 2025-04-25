const { createRxDatabase } = require("rxdb");
const {
  getRxStorageSQLite,
  getRelationalRxStorageSQLite,
} = require("../dist/rxdb-adapter.cjs");
const { strict: assert } = require("assert");
const path = require("path");
const fs = require("fs");
const os = require("os");

describe("RxDB Mixed SQLite Adapters Test", () => {
  let tempDir;
  let standardDbPath;
  let relationalDbPath;
  let standardDb;
  let relationalDb;

  beforeEach(async () => {
    // Create a temporary directory for the test databases
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rxdb-test-"));
    standardDbPath = path.join(tempDir, "standard-db.sqlite");
    relationalDbPath = path.join(tempDir, "relational-db.sqlite");

    // Clean up any existing database files
    if (fs.existsSync(standardDbPath)) {
      fs.unlinkSync(standardDbPath);
    }
    if (fs.existsSync(relationalDbPath)) {
      fs.unlinkSync(relationalDbPath);
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (standardDb) {
      await standardDb.destroy();
      standardDb = null;
    }
    if (relationalDb) {
      await relationalDb.destroy();
      relationalDb = null;
    }

    // Remove the temporary database files
    if (fs.existsSync(standardDbPath)) {
      fs.unlinkSync(standardDbPath);
    }
    if (fs.existsSync(relationalDbPath)) {
      fs.unlinkSync(relationalDbPath);
    }

    // Remove the temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  });

  it("should maintain separate database instances for different adapter types", async () => {
    // Define schemas for our test collections
    const userSchema = {
      title: "user schema",
      version: 0,
      primaryKey: "id",
      type: "object",
      properties: {
        id: { type: "string", maxLength: 100 },
        name: { type: "string" },
        email: { type: "string" },
      },
      required: ["id", "name", "email"],
    };

    const productSchema = {
      title: "product schema",
      version: 0,
      primaryKey: "id",
      type: "object",
      properties: {
        id: { type: "string", maxLength: 100 },
        name: { type: "string" },
        price: { type: "number" },
      },
      required: ["id", "name", "price"],
    };

    // Create a database with the standard adapter
    standardDb = await createRxDatabase({
      name: "standard-db",
      storage: getRxStorageSQLite({
        filename: standardDbPath,
      }),
    });

    // Create a database with the relational adapter
    relationalDb = await createRxDatabase({
      name: "relational-db",
      storage: getRelationalRxStorageSQLite({
        filename: relationalDbPath,
      }),
      // Disable dev mode for relational adapter
      devMode: false,
    });

    // Get the SQLite instances
    const standardSqliteDb = getRxStorageSQLite.getDBByName("standard-db");
    const relationalSqliteDb =
      getRelationalRxStorageSQLite.getDBByName("relational-db");

    // Verify we have two different database instances
    assert.ok(standardSqliteDb, "Should get standard-db from the map");
    assert.ok(relationalSqliteDb, "Should get relational-db from the map");
    assert.notStrictEqual(
      standardSqliteDb,
      relationalSqliteDb,
      "Should have different database instances"
    );

    // Add collections to both databases
    await standardDb.addCollection({
      name: "users",
      schema: userSchema,
    });

    await relationalDb.addCollection({
      name: "products",
      schema: productSchema,
    });

    // Verify we can still get the correct database instances
    const standardSqliteDbAgain = getRxStorageSQLite.getDBByName("standard-db");
    const relationalSqliteDbAgain =
      getRelationalRxStorageSQLite.getDBByName("relational-db");

    assert.strictEqual(
      standardSqliteDb,
      standardSqliteDbAgain,
      "Should get the same standard-db instance"
    );
    assert.strictEqual(
      relationalSqliteDb,
      relationalSqliteDbAgain,
      "Should get the same relational-db instance"
    );

    // Check that each adapter's database map contains the correct database
    const standardDatabases = getRxStorageSQLite.getAvailableDatabases();
    const relationalDatabases =
      getRelationalRxStorageSQLite.getAvailableDatabases();

    assert.ok(
      standardDatabases.includes("standard-db"),
      "Standard databases should include standard-db"
    );
    assert.ok(
      relationalDatabases.includes("relational-db"),
      "Relational databases should include relational-db"
    );

    // Verify that the databases don't cross-contaminate
    assert.ok(
      !standardDatabases.includes("relational-db"),
      "Standard databases should not include relational-db"
    );
    assert.ok(
      !relationalDatabases.includes("standard-db"),
      "Relational databases should not include standard-db"
    );

    // Insert data into each database
    await standardDb.users.insert({
      id: "user1",
      name: "John Doe",
      email: "john@example.com",
    });

    await relationalDb.products.insert({
      id: "product1",
      name: "Test Product",
      price: 99.99,
    });

    // Use raw SQL to verify the data in each database
    const standardUsers = standardSqliteDb
      .prepare("SELECT * FROM standard-db_users")
      .all();
    const relationalProducts = relationalSqliteDb
      .prepare("SELECT * FROM relational-db_products")
      .all();

    assert.strictEqual(
      standardUsers.length,
      1,
      "standard-db should have 1 user"
    );
    assert.strictEqual(
      relationalProducts.length,
      1,
      "relational-db should have 1 product"
    );

    // Verify the table structure differences between standard and relational adapters

    // For standard adapter, data is stored as JSON in a 'data' column
    const standardTableInfo = standardSqliteDb
      .prepare("PRAGMA table_info(standard-db_users)")
      .all();
    const standardDataColumn = standardTableInfo.find(
      (col) => col.name === "data"
    );
    assert.ok(standardDataColumn, "Standard adapter should have a data column");

    // For relational adapter, each field should be a separate column
    const relationalTableInfo = relationalSqliteDb
      .prepare("PRAGMA table_info(relational-db_products)")
      .all();
    const relationalColumns = relationalTableInfo.map((col) => col.name);

    // The relational adapter should have columns for each field in the schema
    assert.ok(
      relationalColumns.includes("id"),
      "Relational adapter should have an id column"
    );
    assert.ok(
      relationalColumns.includes("name"),
      "Relational adapter should have a name column"
    );
    assert.ok(
      relationalColumns.includes("price"),
      "Relational adapter should have a price column"
    );

    // The relational adapter should NOT have a data column (data is stored in individual columns)
    assert.ok(
      !relationalColumns.includes("data"),
      "Relational adapter should not have a data column"
    );

    // Verify we can get the database instances by name
    const standardDbAgain = getRxStorageSQLite.getDBByName("standard-db");
    const relationalDbAgain =
      getRelationalRxStorageSQLite.getDBByName("relational-db");

    assert.strictEqual(
      standardDbAgain,
      standardSqliteDb,
      "Should get the same standard-db instance"
    );
    assert.strictEqual(
      relationalDbAgain,
      relationalSqliteDb,
      "Should get the same relational-db instance"
    );
  });
});
