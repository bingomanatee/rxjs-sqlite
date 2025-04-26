# The Making of RxJS SQLite Adapter

In a related project the atmo-monorepo I developed a need for an RxDB adapter.
In the absense of one, I developed a system in conjunction with Augment AI.

The goal was simple: create an adapter that lets RxDB work with SQLite databases
in Node.js environments. We wanted server-side applications to benefit from
RxDB's reactive capabilities while using SQLite's proven reliability and
performance. Given that the target is posgres-sqlite, the current system will
work only with node/server side, but with a little work it could probably work
with a client side memory based sqlite as well.

## The Hard Parts

### RxDB's Architecture - A Rabbit Hole

RxDB is MASSIVELY GREAT but its architecture is complex.
It's designed with a plugin-based system and has specific expectations for
storage adapters. We had to understand:

- How RxDB interacts with storage adapters
- The lifecycle of documents in RxDB
- How queries are translated from RxDB's query language to the underlying store
- How RxDB handles replication and change detection

This meant diving deep into RxDB's source code and documentation, and
experimenting with existing adapters.
It was a rabbit hole, but a necessary one.

Also, RxDB is inherently designed to be a key-value based store, so there are a
log of edge cases that need to be allowed for in making it adapt to a SQL Store
system.

### SQLite Integration

Integrating SQLite was like trying to fit a square peg into a round hole:

SQLite (via better-sqlite3) only works in Node.js environments, not browsers.
This forced us to design a server-client architecture where the SQLite adapter
runs on the server while providing a reactive experience to browser clients.

RxDB follows a document-oriented model, while SQLite is relational.
We considered two possible approaches:
- A blob-style storage that would store documents as JSON in a single column
  (simpler but less efficient)
- A relational storage that maps document fields to individual columns (what we
  ultimately implemented)

Translating RxDB's Mango queries to SQL was complex.
We leveraged code from the atmo-db package to handle common operators and query
patterns. Specifically a sibling library, @wonderlandlabs/atmo-db I wrote for a
fully SQL based system to manage SQLite queries.

### Validation

One of the most significant challenges was handling validation, particularly with
nullable fields:

RxDB's built-in validators in dev mode couldn't properly handle fields with
multi-type arrays like `{ type: ['string', 'null'] }`. This was a MASSIVE PAIN.

We explored different validation strategies:
- **The Easy Way Out**: Don't use nullable fields at all! If you avoid nullable
  fields in your schema, you can use any validator you like without issues.
  This is the simplest approach if your data model allows it.
- Disabling dev mode entirely (simple but loses benefits)
- Implementing custom validators (more work but more control)
- Using validation strategies to control when validation occurs (fine-grained
  control)

The solution we opted for was a custom validator designed specifically for
multi-type fields. NOTE: this may be useful for other scenarios with multi-type
fields. Our validator is tuned to allow optional/nullable fields to exist and be
validated, meaning you can use dev mode for your SQLite based RxDB stores.

We created comprehensive tests to verify that different validation strategies
worked correctly with nullable fields. This was crucial for ensuring the adapter
worked reliably.

### Autoincrement  Primary Keys

We discovered that RxDB is fundamentally incompatible with autoincrement primary
keys. RxDB expects documents to have known primary keys at insertion time, which
conflicts with database-generated autoincrement IDs.

RxDB is designed for offline-first applications where clients generate IDs
locally, which doesn't work with server-generated autoincrement IDs.

Instead, we documented alternative approaches for ID generation that work well
with RxDB's architecture.

This is not a problem we found a solution for; it's something you will have to
engineer around in your application.

## Technical Decisions and Trade-offs

### Storage Approach - The Relational Path

After evaluating our options, we chose to implement a relational storage
approach:

**Relational Storage**:
- Better performance for field-specific queries
- More efficient storage and indexing
- Allows for proper SQL constraints and types
- More complex implementation, requires mapping between document and relational
  models

We considered but ultimately rejected a blob-style storage approach (storing
documents as JSON in a single column) because while it would be simpler to
implement, it would sacrifice many of the benefits of using SQLite in the first
place.

#### Raw query / Database Exposure

Given the nature and design of RxDB, it's not really easy to access the Database
instance it uses. Because of this we added a "pure hack" to allow access to the
database instance.

## Working with NULL Values in SQL Queries

SQL handles NULL values differently than most programming languages, which can
lead to unexpected behavior when querying for NULL values in a database.

### The NULL Value Challenge

In our development of the RxDB SQLite adapter, we encountered a significant
challenge with NULL values in SQL queries. The issue stems from a fundamental
difference in how SQL treats NULL values compared to most programming languages:

- In JavaScript, you can check if a value is null using equality operators:
  `value === null`
- In SQL, you **cannot** use the equality operator with NULL: `field = NULL`
  will not work as expected
- Instead, SQL requires special syntax: `field IS NULL` or `field IS NOT NULL`

This difference caused our initial implementation to fail when querying for
documents with NULL field values.

### The Solution: Special NULL Handling

To address this issue, we implemented a special handling mechanism for NULL values
in our query builder:

1. When a query includes a direct NULL comparison (`field: null` in the selector),
   we detect this case and generate an `IS NULL` condition in the SQL query
   instead of using the equality operator.

2. For the `$exists: false` operator (which checks if a field is NULL or doesn't
   exist), we also generate an `IS NULL` condition.

3. We use a marker approach with a special placeholder value (`<<null>>`) that
   gets replaced with the proper SQL syntax during query generation.

### Best Practices for Querying NULL Values

When working with the RxDB SQLite adapter, use these approaches to query for NULL
values:

1. **Direct NULL comparison** - Works for simple equality checks:
   ```typescript
   // Finds documents where categoryId is NULL
   const results = await collection.find({
     selector: {
       categoryId: null
     }
   }).exec();
   ```

2. **Using $exists operator** - More explicit approach:
   ```typescript
   // Finds documents where categoryId is NULL or doesn't exist
   const results = await collection.find({
     selector: {
       categoryId: {
         $exists: false
       }
     }
   }).exec();
   ```

3. **Using $ne for non-NULL values** - Find documents where a field is not NULL:
   ```typescript
   // Finds documents where categoryId is NOT NULL
   const results = await collection.find({
     selector: {
       categoryId: {
         $ne: null
       }
     }
   }).exec();
   ```

### Technical Implementation Details

For those interested in the technical details, our adapter:

1. Detects NULL values in query selectors
2. Replaces them with a special marker value (`<<null>>`)
3. Generates SQL with placeholders
4. Post-processes the SQL to replace `field = ?` with `field IS NULL` when the
   parameter is NULL
5. Adjusts the parameter array accordingly

This approach ensures that NULL value queries work correctly while maintaining
the security benefits of parameterized queries.

## What We Learned

**Document vs. Relational Models**: Bridging document-oriented and relational
database paradigms requires careful design and trade-offs.

**Validation Complexity**: Schema validation is more complex than it initially
appears, especially when dealing with nullable fields and custom types.

**SQL NULL Handling**: SQL's special treatment of NULL values requires careful
handling in query translation to avoid subtle bugs.

**Testing is Essential**: Comprehensive testing was crucial for identifying edge
cases and ensuring the adapter worked correctly in various scenarios.

**Architecture Limitations**: Some features (like autoincrement IDs) are
fundamentally incompatible with RxDB's architecture, requiring alternative
approaches.

**Documentation Importance**: Clear documentation of limitations, workarounds, and
best practices is essential for users to successfully implement the adapter.

## Where We're Going

The RxDB SQLite adapter is currently in alpha stage, with several potential future
enhancements:

- Support for other SQL databases like PostgreSQL
- Performance optimizations for query translation and execution
- Robust schema migration support
- Enhanced query capabilities for more complex patterns and operators

## The Bottom Line

Developing the RxJS SQLite Adapter has been a journey of learning and discovery.
We've navigated the challenges of bridging different database paradigms, handling
validation complexities, and working within the constraints of RxDB's architecture.

The result is a functional adapter that enables using SQLite with RxDB in Node.js
environments, providing a foundation for building reactive server-side applications
with the reliability of SQLite.

The project demonstrates that with careful design and a deep understanding of the
underlying technologies, it's possible to create bridges between different
database paradigms that leverage the strengths of each.
