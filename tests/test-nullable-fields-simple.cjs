/**
 * Simplified unit test for nullable fields in RxDB SQLite adapter
 */
const assert = require("assert");
const { createRxDatabase, addRxPlugin } = require("rxdb");
const { RxDBDevModePlugin } = require("rxdb/plugins/dev-mode");
const { wrappedValidateAjvStorage } = require("rxdb/plugins/validate-ajv");
const fs = require("fs");
const path = require("path");

// Import the SQLite adapter
const { getRxStorageSQLite } = require("./recipe-server.cjs");

// Add the dev-mode plugin
addRxPlugin(RxDBDevModePlugin);

// Test database file path
const timestamp = Date.now();
const DB_FILE = path.join(__dirname, `test_nullable_${timestamp}.sqlite`);

// Clean up any existing test database
if (fs.existsSync(DB_FILE)) {
  fs.unlinkSync(DB_FILE);
}

// Schema with nullable fields
const testSchema = {
  title: "test schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    requiredString: { type: "string" },
    nullableString: { type: ["string", "null"] },
  },
  required: ["id", "requiredString"],
};

async function runTest() {
  console.log("Starting simplified nullable fields test...");

  // Create RxDB database with SQLite adapter
  const db = await createRxDatabase({
    name: `testdb_${timestamp}`,
    storage: wrappedValidateAjvStorage({
      storage: getRxStorageSQLite({
        filename: DB_FILE,
      }),
    }),
  });

  // Create collection with the test schema
  const collections = await db.addCollections({
    test: { schema: testSchema },
  });

  // Insert test documents
  console.log("Inserting test documents...");

  // Document with non-null value
  await collections.test.insert({
    id: "doc1",
    requiredString: "This is required",
    nullableString: "This is not null",
  });
  console.log("Successfully inserted document with id: doc1");

  // Document with null value
  await collections.test.insert({
    id: "doc2",
    requiredString: "This is also required",
    nullableString: null,
  });
  console.log("Successfully inserted document with id: doc2");

  // Retrieve and validate documents
  console.log("Retrieving and validating documents...");

  // Test document with non-null value
  const doc1 = await collections.test.findOne("doc1").exec();
  assert.strictEqual(doc1.get("id"), "doc1", "ID should match");
  assert.strictEqual(
    doc1.get("requiredString"),
    "This is required",
    "Required string should match"
  );
  assert.strictEqual(
    doc1.get("nullableString"),
    "This is not null",
    "Non-null string should match"
  );

  // Test document with null value
  const doc2 = await collections.test.findOne("doc2").exec();
  assert.strictEqual(doc2.get("id"), "doc2", "ID should match");
  assert.strictEqual(
    doc2.get("requiredString"),
    "This is also required",
    "Required string should match"
  );
  assert.strictEqual(
    doc2.get("nullableString"),
    null,
    "Null string should be null"
  );

  // Skip database removal
  console.log("All tests passed!");
}

// Run the test
runTest()
  .then(() => {
    console.log("Test completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
