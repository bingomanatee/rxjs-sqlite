/**
 * Unit test for nullable fields in RxDB SQLite adapter
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
const DB_FILE = path.join(
  __dirname,
  "test_nullable_fields_" + Date.now() + ".sqlite"
);

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
    nullableNumber: { type: ["number", "null"] },
    nullableBoolean: { type: ["boolean", "null"] },
    nullableArray: {
      type: ["array", "null"],
      items: { type: "string" },
    },
    nullableObject: {
      type: ["object", "null"],
      properties: {
        nestedField: { type: "string" },
      },
    },
  },
  required: ["id", "requiredString"],
};

// Test documents
const testDocs = [
  {
    id: "doc1",
    requiredString: "This is required",
    nullableString: "This is not null",
    nullableNumber: 42,
    nullableBoolean: true,
    nullableArray: ["item1", "item2"],
    nullableObject: { nestedField: "nested value" },
  },
  {
    id: "doc2",
    requiredString: "This is also required",
    nullableString: null,
    nullableNumber: null,
    nullableBoolean: null,
    nullableArray: null,
    nullableObject: null,
  },
];

async function runTest() {
  console.log("Starting nullable fields test...");

  // Create RxDB database with SQLite adapter
  const db = await createRxDatabase({
    name: "testdb_" + Date.now(),
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
  for (const doc of testDocs) {
    try {
      await collections.test.insert(doc);
      console.log(`Successfully inserted document with id: ${doc.id}`);
    } catch (error) {
      console.error(`Error inserting document with id: ${doc.id}`, error);
      process.exit(1);
    }
  }

  // Retrieve and validate documents
  console.log("Retrieving and validating documents...");

  // Test document with non-null values
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
  assert.strictEqual(
    doc1.get("nullableNumber"),
    42,
    "Non-null number should match"
  );
  assert.strictEqual(
    doc1.get("nullableBoolean"),
    true,
    "Non-null boolean should match"
  );
  assert.deepStrictEqual(
    doc1.get("nullableArray"),
    ["item1", "item2"],
    "Non-null array should match"
  );
  assert.deepStrictEqual(
    doc1.get("nullableObject"),
    { nestedField: "nested value" },
    "Non-null object should match"
  );

  // Test document with null values
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
  assert.strictEqual(
    doc2.get("nullableNumber"),
    null,
    "Null number should be null"
  );
  assert.strictEqual(
    doc2.get("nullableBoolean"),
    null,
    "Null boolean should be null"
  );
  assert.strictEqual(
    doc2.get("nullableArray"),
    null,
    "Null array should be null"
  );
  assert.strictEqual(
    doc2.get("nullableObject"),
    null,
    "Null object should be null"
  );

  // Test querying for documents with null values
  const nullStringDocs = await collections.test
    .find({
      selector: {
        id: "doc2",
        nullableString: null,
      },
    })
    .exec();

  assert.strictEqual(
    nullStringDocs.length,
    1,
    "Should find one document with null string"
  );
  assert.strictEqual(
    nullStringDocs[0].get("id"),
    "doc2",
    "Document with null string should be doc2"
  );

  // Test querying for documents with non-null values
  const nonNullStringDocs = await collections.test
    .find({
      selector: {
        id: "doc1",
        nullableString: { $ne: null },
      },
    })
    .exec();

  assert.strictEqual(
    nonNullStringDocs.length,
    1,
    "Should find one document with non-null string"
  );
  assert.strictEqual(
    nonNullStringDocs[0].get("id"),
    "doc1",
    "Document with non-null string should be doc1"
  );

  // Close the database
  await db.destroy();

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
