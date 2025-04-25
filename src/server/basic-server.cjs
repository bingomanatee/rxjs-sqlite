/**
 * Basic server implementation for RxJS SQLite adapter demo
 */
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

// Create Express app
const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());
app.use(express.json());

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../../dist')));

// Create an in-memory SQLite database
const db = new Database(':memory:');

// Initialize the database
function initDatabase() {
  console.log('Initializing SQLite database...');
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL,
      active INTEGER DEFAULT 1
    );
    
    CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      temperature REAL NOT NULL,
      humidity REAL,
      pressure REAL,
      wind_speed REAL,
      wind_direction REAL,
      precipitation REAL,
      FOREIGN KEY (station_id) REFERENCES stations(id)
    );
  `);
  
  // Insert initial data
  const stationsCount = db.prepare('SELECT COUNT(*) as count FROM stations').get().count;
  
  if (stationsCount === 0) {
    console.log('Inserting initial weather stations...');
    
    // Insert initial stations
    const insertStation = db.prepare(`
      INSERT INTO stations (id, name, latitude, longitude, elevation, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    insertStation.run('station-1', 'Downtown', 37.7749, -122.4194, 52, 1);
    insertStation.run('station-2', 'Airport', 37.6213, -122.3790, 4, 1);
    insertStation.run('station-3', 'Coastal', 37.8199, -122.4783, 5, 1);
    
    console.log('Initial weather stations inserted');
  }
}

// API Routes

// Get all stations
app.get('/api/stations', (req, res) => {
  try {
    const stations = db.prepare('SELECT * FROM stations').all();
    res.json(stations);
  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

// Get all readings
app.get('/api/readings', (req, res) => {
  try {
    const readings = db.prepare('SELECT * FROM readings ORDER BY timestamp DESC LIMIT 20').all();
    res.json(readings);
  } catch (error) {
    console.error('Error fetching readings:', error);
    res.status(500).json({ error: 'Failed to fetch readings' });
  }
});

// Catch-all route to serve the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// Initialize the database
initDatabase();

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  
  if (db) {
    db.close();
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
