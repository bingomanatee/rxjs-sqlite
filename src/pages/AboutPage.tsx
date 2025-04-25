import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  Link,
  Container,
  Chip,
  Button
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { GitHub as GitHubIcon, Code as CodeIcon, Storage as StorageIcon } from '@mui/icons-material';

const AboutPage = () => {
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4, textAlign: 'left' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          RxDB SQLite Adapter
        </Typography>

        <Typography variant="body1" paragraph>
          A custom storage adapter for RxDB that enables SQLite support in Node.js environments. This recipe app demonstrates the adapter in a real-world application.
        </Typography>

        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Adapter Features
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <List>
            <ListItem>
              <ListItemText
                primary="Node.js Compatible"
                secondary="Works in server-side environments using better-sqlite3"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Full CRUD Support"
                secondary="Implements all RxDB storage operations (create, read, update, delete)"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Query Support"
                secondary="Translates RxDB queries to efficient SQLite operations"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Indexing"
                secondary="Properly handles RxDB indexes for optimized performance"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="JSON Schema Support"
                secondary="Handles complex schema types including nullable fields"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Raw Query Access"
                secondary="Provides access to the underlying SQLite database for direct queries"
              />
            </ListItem>
          </List>
        </Paper>

        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Using the Adapter
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Typography variant="h6" gutterBottom>
            Installation
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, fontFamily: 'monospace', bgcolor: 'rgba(0, 0, 0, 0.04)', p: 2, borderRadius: 1 }}>
            npm install @wonderlandlabs/rxdb-sqlite better-sqlite3
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Basic Usage
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, fontFamily: 'monospace', bgcolor: 'rgba(0, 0, 0, 0.04)', p: 2, borderRadius: 1, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
{`import { createRxDatabase } from 'rxdb';
import { getRxStorageSQLite } from '@wonderlandlabs/rxdb-sqlite';

// Create a database with SQLite storage
const db = await createRxDatabase({
  name: 'mydb',
  storage: getRxStorageSQLite({
    filename: './data/mydb.sqlite', // Path to SQLite file
  })
});

// Add collections
const collections = await db.addCollections({
  heroes: {
    schema: {
      title: 'hero schema',
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        power: { type: ['string', 'null'], default: null },
        age: { type: 'number' }
      },
      required: ['id'],
      indexes: ['name', 'age']
    }
  }
});

// Insert a document
await collections.heroes.insert({
  id: 'hero1',
  name: 'Captain SQL',
  power: 'Database Manipulation',
  age: 35
});

// Query documents
const heroes = await collections.heroes.find().exec();
console.log(heroes.map(h => h.toJSON()));`}
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Raw Query Access
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, fontFamily: 'monospace', bgcolor: 'rgba(0, 0, 0, 0.04)', p: 2, borderRadius: 1, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
{`// Get the underlying SQLite database instance
const sqliteDb = getRxStorageSQLite.getLastDb();

// Run a raw SQL query
const results = sqliteDb.prepare('SELECT * FROM heroes WHERE age > ?').all(30);
console.log(results);`}
          </Typography>
        </Paper>

        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Implementation Details
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Typography variant="h6" gutterBottom>
            Adapter Architecture
          </Typography>
          <Typography variant="body2" paragraph>
            The SQLite adapter implements RxDB's storage interface by:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="1. Creating SQLite tables for each RxDB collection" />
            </ListItem>
            <ListItem>
              <ListItemText primary="2. Translating RxDB operations to SQLite queries" />
            </ListItem>
            <ListItem>
              <ListItemText primary="3. Handling document serialization/deserialization" />
            </ListItem>
            <ListItem>
              <ListItemText primary="4. Managing indexes for optimized queries" />
            </ListItem>
            <ListItem>
              <ListItemText primary="5. Providing transaction support" />
            </ListItem>
          </List>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Schema Handling
          </Typography>
          <Typography variant="body2" paragraph>
            The adapter supports RxDB's JSON schema format with special handling for:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="Nullable Fields"
                secondary="Using multi-type syntax: { type: ['string', 'null'] }"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Indexed Fields"
                secondary="String fields used in indexes must have maxLength defined"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Complex Objects"
                secondary="Nested objects are stored as JSON strings in SQLite"
              />
            </ListItem>
          </List>
        </Paper>

        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Current Status & Roadmap
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Typography variant="body1" paragraph>
            This adapter is currently in alpha status and has been tested with basic CRUD operations and queries.
          </Typography>

          <Typography variant="h6" gutterBottom>
            Implemented Features
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="✅ Basic CRUD operations" />
            </ListItem>
            <ListItem>
              <ListItemText primary="✅ Simple queries (equality, range, etc.)" />
            </ListItem>
            <ListItem>
              <ListItemText primary="✅ Indexing" />
            </ListItem>
            <ListItem>
              <ListItemText primary="✅ Transactions" />
            </ListItem>
            <ListItem>
              <ListItemText primary="✅ Raw query access" />
            </ListItem>
          </List>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Planned Features
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="⏳ Advanced query operators" />
            </ListItem>
            <ListItem>
              <ListItemText primary="⏳ Migration support" />
            </ListItem>
            <ListItem>
              <ListItemText primary="⏳ Performance optimizations" />
            </ListItem>
            <ListItem>
              <ListItemText primary="⏳ Support for other SQL databases (PostgreSQL, MySQL)" />
            </ListItem>
          </List>
        </Paper>

        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Troubleshooting
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Typography variant="h6" gutterBottom>
            Common Issues
          </Typography>

          <Typography variant="subtitle1" gutterBottom>
            Schema Validation Errors
          </Typography>
          <Typography variant="body2" paragraph>
            If you encounter schema validation errors (e.g., SC34), ensure that:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• All string fields used in indexes have maxLength defined" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Nullable fields use the multi-type syntax: { type: ['string', 'null'] }" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Consider disabling validation in dev mode if needed" />
            </ListItem>
          </List>

          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            Connection Issues
          </Typography>
          <Typography variant="body2" paragraph>
            If the app fails to connect to the database:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• Ensure the SQLite file path is correct and accessible" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Check that better-sqlite3 is properly installed" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Verify the server is running (node server/recipe-server.cjs)" />
            </ListItem>
          </List>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 4, flexWrap: 'wrap' }}>
          <Chip
            icon={<StorageIcon />}
            label="RxDB Documentation"
            component="a"
            href="https://rxdb.info/"
            target="_blank"
            rel="noopener noreferrer"
            clickable
          />
          <Chip
            icon={<CodeIcon />}
            label="atmo-db Package"
            component="a"
            href="https://www.npmjs.com/package/@wonderlandlabs/atmo-db"
            target="_blank"
            rel="noopener noreferrer"
            clickable
          />
          <Chip
            icon={<GitHubIcon />}
            label="GitHub"
            component="a"
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            clickable
          />
        </Box>

        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="body2" color="text.secondary">
            Created by <Link href="mailto:dave@wonderlandlabs.com">David Edelhart</Link> at Wonderland Labs
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default AboutPage;
