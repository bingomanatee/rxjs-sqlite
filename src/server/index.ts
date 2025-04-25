/**
 * Server implementation for RxDB SQLite adapter demo
 * This server exposes a REST API and WebSocket connection for the frontend
 */
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageSQLite } from '../lib/rxdb-adapter';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { v4 as uuidv4 } from 'uuid';

// Add the dev mode plugin for better error messages
addRxPlugin(RxDBDevModePlugin);

// Create Express app
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Enable CORS
app.use(cors());
app.use(express.json());

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../../dist')));

// Database and collections
let db: any;
let stationsCollection: any;
let readingsCollection: any;

// Initialize the database
async function initDatabase() {
  console.log('Initializing RxDB with SQLite adapter...');
  
  // Create a database using our SQLite adapter
  db = await createRxDatabase({
    name: 'weatherdb',
    storage: getRxStorageSQLite()
  });

  console.log('Database created:', db.name);

  // Define schemas for our collections
  const stationSchema = {
    title: 'Weather Station schema',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        maxLength: 100
      },
      name: {
        type: 'string'
      },
      latitude: {
        type: 'number'
      },
      longitude: {
        type: 'number'
      },
      elevation: {
        type: 'number'
      },
      active: {
        type: 'boolean',
        default: true
      }
    },
    required: ['id', 'name', 'latitude', 'longitude']
  };

  const readingSchema = {
    title: 'Weather Reading schema',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        maxLength: 100
      },
      stationId: {
        type: 'string',
        ref: 'stations'
      },
      timestamp: {
        type: 'string', // ISO date string
        format: 'date-time'
      },
      temperature: {
        type: 'number'
      },
      humidity: {
        type: 'number'
      },
      pressure: {
        type: 'number'
      },
      windSpeed: {
        type: 'number'
      },
      windDirection: {
        type: 'number'
      },
      precipitation: {
        type: 'number'
      }
    },
    required: ['id', 'stationId', 'timestamp', 'temperature']
  };

  console.log('Creating collections...');
  
  // Create collections
  stationsCollection = await db.addCollection({
    name: 'stations',
    schema: stationSchema
  });

  readingsCollection = await db.addCollection({
    name: 'readings',
    schema: readingSchema
  });

  console.log('Collections created');

  // Set up subscriptions to emit changes via WebSockets
  stationsCollection.find().$.subscribe((stations: any) => {
    io.emit('stations', stations.map((station: any) => station.toJSON()));
  });

  readingsCollection.find().$.subscribe((readings: any) => {
    io.emit('readings', readings.map((reading: any) => reading.toJSON()));
  });

  // Insert initial data if collections are empty
  const stationsCount = await stationsCollection.count().exec();
  
  if (stationsCount === 0) {
    console.log('Inserting initial weather stations...');
    
    // Insert weather stations
    await Promise.all([
      stationsCollection.insert({
        id: 'station-1',
        name: 'Downtown',
        latitude: 37.7749,
        longitude: -122.4194,
        elevation: 52,
        active: true
      }),
      stationsCollection.insert({
        id: 'station-2',
        name: 'Airport',
        latitude: 37.6213,
        longitude: -122.3790,
        elevation: 4,
        active: true
      }),
      stationsCollection.insert({
        id: 'station-3',
        name: 'Coastal',
        latitude: 37.8199,
        longitude: -122.4783,
        elevation: 5,
        active: true
      })
    ]);

    console.log('Initial weather stations inserted');
  }
}

// API Routes

// Get all stations
app.get('/api/stations', async (req, res) => {
  try {
    const stations = await stationsCollection.find().exec();
    res.json(stations.map((station: any) => station.toJSON()));
  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

// Get a specific station
app.get('/api/stations/:id', async (req, res) => {
  try {
    const station = await stationsCollection.findOne(req.params.id).exec();
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    res.json(station.toJSON());
  } catch (error) {
    console.error('Error fetching station:', error);
    res.status(500).json({ error: 'Failed to fetch station' });
  }
});

// Create a new station
app.post('/api/stations', async (req, res) => {
  try {
    const stationData = {
      id: req.body.id || `station-${uuidv4()}`,
      ...req.body
    };
    
    const station = await stationsCollection.insert(stationData);
    res.status(201).json(station.toJSON());
  } catch (error) {
    console.error('Error creating station:', error);
    res.status(500).json({ error: 'Failed to create station' });
  }
});

// Update a station
app.put('/api/stations/:id', async (req, res) => {
  try {
    const station = await stationsCollection.findOne(req.params.id).exec();
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    await station.update({
      $set: req.body
    });
    
    res.json(station.toJSON());
  } catch (error) {
    console.error('Error updating station:', error);
    res.status(500).json({ error: 'Failed to update station' });
  }
});

// Delete a station
app.delete('/api/stations/:id', async (req, res) => {
  try {
    const station = await stationsCollection.findOne(req.params.id).exec();
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    await station.remove();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting station:', error);
    res.status(500).json({ error: 'Failed to delete station' });
  }
});

// Get all readings
app.get('/api/readings', async (req, res) => {
  try {
    const query = readingsCollection.find();
    
    // Apply filters
    if (req.query.stationId) {
      query.where('stationId').equals(req.query.stationId);
    }
    
    // Apply sorting
    query.sort({ timestamp: 'desc' });
    
    // Apply limit
    if (req.query.limit) {
      query.limit(parseInt(req.query.limit as string, 10));
    }
    
    const readings = await query.exec();
    res.json(readings.map((reading: any) => reading.toJSON()));
  } catch (error) {
    console.error('Error fetching readings:', error);
    res.status(500).json({ error: 'Failed to fetch readings' });
  }
});

// Get a specific reading
app.get('/api/readings/:id', async (req, res) => {
  try {
    const reading = await readingsCollection.findOne(req.params.id).exec();
    
    if (!reading) {
      return res.status(404).json({ error: 'Reading not found' });
    }
    
    res.json(reading.toJSON());
  } catch (error) {
    console.error('Error fetching reading:', error);
    res.status(500).json({ error: 'Failed to fetch reading' });
  }
});

// Create a new reading
app.post('/api/readings', async (req, res) => {
  try {
    const readingData = {
      id: req.body.id || `reading-${uuidv4()}`,
      timestamp: req.body.timestamp || new Date().toISOString(),
      ...req.body
    };
    
    const reading = await readingsCollection.insert(readingData);
    res.status(201).json(reading.toJSON());
  } catch (error) {
    console.error('Error creating reading:', error);
    res.status(500).json({ error: 'Failed to create reading' });
  }
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Send initial data to the client
  stationsCollection.find().exec().then((stations: any) => {
    socket.emit('stations', stations.map((station: any) => station.toJSON()));
  });
  
  readingsCollection.find().sort({ timestamp: 'desc' }).limit(10).exec().then((readings: any) => {
    socket.emit('readings', readings.map((reading: any) => reading.toJSON()));
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Catch-all route to serve the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;

// Initialize the database and start the server
initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  
  if (db) {
    await db.destroy();
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
