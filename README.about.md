# The Making of RxJS SQLite Adapter

This is the story of how we built the RxJS SQLite Adapter - a project that emerged from a need to have a reliable, reactive database solution that leverages SQLite while maintaining RxDB's reactive programming model.

## Why We Built This

The vision was simple: create an adapter that lets RxDB work with SQLite databases in Node.js environments. We wanted server-side applications to benefit from RxDB's reactive capabilities while using SQLite's proven reliability and performance.

## The Hard Parts

### RxDB's Architecture - A Rabbit Hole

RxDB is MASSIVELY GREAT but its architecture is complex. It's designed with a plugin-based system and has specific expectations for storage adapters. We had to understand:

- How RxDB interacts with storage adapters
- The lifecycle of documents in RxDB
- How queries are translated from RxDB's query language to the underlying storage
- How RxDB handles replication and change detection

This meant diving deep into RxDB's source code and documentation, and experimenting with existing adapters. It was a rabbit hole, but a necessary one.

### SQLite Integration - Square Peg, Round Hole

Integrating SQLite was like trying to fit a square peg into a round hole:

SQLite (via better-sqlite3) only works in Node.js environments, not browsers. This forced us to design a server-client architecture where the SQLite adapter runs on the server while providing a reactive experience to browser clients.

RxDB follows a document-oriented model, while SQLite is relational. We implemented two approaches:
- A blob-style storage that stores documents as JSON in a single column
- A relational storage that maps document fields to individual columns

Translating RxDB's Mango queries to SQL was complex. We leveraged code from the atmo-db package to handle common operators and query patterns.

### Validation - The Unexpected Boss Battle

One of the most significant challenges was handling validation, particularly with nullable fields:

RxDB's built-in validators in dev mode couldn't properly handle fields with multi-type arrays like `{ type: ['string', 'null'] }`. This was a MASSIVE PAIN.

We explored different validation strategies:
- Disabling dev mode entirely (simple but loses benefits)
- Implementing custom validators (more work but more control)
- Using validation strategies to control when validation occurs (fine-grained control)

We created comprehensive tests to verify that different validation strategies worked correctly with nullable fields. This was crucial for ensuring the adapter worked reliably.

### Autoincrement - The Impossible Dream

We discovered that RxDB is fundamentally incompatible with autoincrement primary keys:

RxDB expects documents to have known primary keys at insertion time, which conflicts with database-generated autoincrement IDs.

RxDB is designed for offline-first applications where clients generate IDs locally, which doesn't work with server-generated autoincrement IDs.

Instead, we documented alternative approaches for ID generation that work well with RxDB's architecture.

## Technical Decisions and Trade-offs

### Storage Approach - Two Paths

We implemented two storage approaches:

**Blob-Style Storage**:
- Simple implementation, maintains compatibility with other RxDB adapters
- Less efficient for querying specific fields

**Relational Storage**:
- Better performance for field-specific queries, more efficient storage
- More complex implementation, requires mapping between document and relational models

### Validation Strategy - Choose Your Poison

For handling validation, especially with nullable fields, we provided multiple options:

**Custom Validator**:
- Maintains dev mode benefits, properly handles nullable fields
- Requires additional code and maintenance

**Validation Strategy Control**:
- Fine-grained control over when validation occurs
- May miss validation at certain points in the document lifecycle

**Disabling Dev Mode**:
- Simple solution
- Loses the benefits of dev mode for catching other issues

### Raw Query Access - Power with Responsibility

We implemented a method to access the underlying SQLite database directly:

- Provides flexibility for complex queries and operations not supported by RxDB
- Allows leveraging SQLite's full capabilities
- Bypasses RxDB's abstractions, which could lead to inconsistencies if not used carefully
- SQLite has limitations with concurrent write operations

## What We Learned

**Document vs. Relational Models**: Bridging document-oriented and relational database paradigms requires careful design and trade-offs.

**Validation Complexity**: Schema validation is more complex than it initially appears, especially when dealing with nullable fields and custom types.

**Testing is Essential**: Comprehensive testing was crucial for identifying edge cases and ensuring the adapter worked correctly in various scenarios.

**Architecture Limitations**: Some features (like autoincrement IDs) are fundamentally incompatible with RxDB's architecture, requiring alternative approaches.

**Documentation Importance**: Clear documentation of limitations, workarounds, and best practices is essential for users to successfully implement the adapter.

## Where We're Going

The RxDB SQLite adapter is currently in alpha stage, with several potential future enhancements:

- Support for other SQL databases like PostgreSQL
- Performance optimizations for query translation and execution
- Robust schema migration support
- Enhanced query capabilities for more complex patterns and operators

## The Bottom Line

Developing the RxJS SQLite Adapter has been a journey of learning and discovery. We've navigated the challenges of bridging different database paradigms, handling validation complexities, and working within the constraints of RxDB's architecture.

The result is a functional adapter that enables using SQLite with RxDB in Node.js environments, providing a foundation for building reactive server-side applications with the reliability of SQLite.

The project demonstrates that with careful design and a deep understanding of the underlying technologies, it's possible to create bridges between different database paradigms that leverage the strengths of each.
