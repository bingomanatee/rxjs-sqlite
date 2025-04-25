/**
 * Simple server implementation for RxDB SQLite adapter demo
 * This is a JavaScript implementation to avoid TypeScript compilation issues
 */
const express = require("express");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");
const cors = require("cors");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const Database = require("better-sqlite3");

// Create Express app
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Enable CORS
app.use(cors());
app.use(express.json());

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, "../../dist")));

// Set up CORS options
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Create an in-memory SQLite database
const db = new Database(":memory:");

// Initialize the database
function initDatabase() {
  console.log("Initializing SQLite database...");

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

    CREATE INDEX IF NOT EXISTS idx_readings_station_id ON readings(station_id);
    CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings(timestamp);
  `);

  // Check if we have any stations
  const stationsCount = db
    .prepare("SELECT COUNT(*) as count FROM stations")
    .get().count;

  if (stationsCount === 0) {
    console.log("Inserting initial weather stations...");

    // Insert initial stations
    const insertStation = db.prepare(`
      INSERT INTO stations (id, name, latitude, longitude, elevation, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertStation.run("station-1", "Downtown", 37.7749, -122.4194, 52, 1);
    insertStation.run("station-2", "Airport", 37.6213, -122.379, 4, 1);
    insertStation.run("station-3", "Coastal", 37.8199, -122.4783, 5, 1);

    console.log("Initial weather stations inserted");
  }
}

// Helper function to emit data updates
function emitDataUpdates() {
  // Emit stations
  const stations = db.prepare("SELECT * FROM stations").all();
  io.emit("stations", stations);

  // Emit readings
  const readings = db
    .prepare(
      `
    SELECT * FROM readings
    ORDER BY timestamp DESC
    LIMIT 20
  `
    )
    .all();

  io.emit("readings", readings);
}

// API Routes

// Get all stations
app.get("/api/stations", (req, res) => {
  try {
    const stations = db.prepare("SELECT * FROM stations").all();
    res.json(stations);
  } catch (error) {
    console.error("Error fetching stations:", error);
    res.status(500).json({ error: "Failed to fetch stations" });
  }
});

// Get a specific station
app.get("/api/stations/:id", (req, res) => {
  try {
    const station = db
      .prepare("SELECT * FROM stations WHERE id = ?")
      .get(req.params.id);

    if (!station) {
      return res.status(404).json({ error: "Station not found" });
    }

    res.json(station);
  } catch (error) {
    console.error("Error fetching station:", error);
    res.status(500).json({ error: "Failed to fetch station" });
  }
});

// Create a new station
app.post("/api/stations", (req, res) => {
  try {
    const stationData = {
      id: req.body.id || `station-${uuidv4()}`,
      name: req.body.name,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      elevation: req.body.elevation || null,
      active: req.body.active !== undefined ? (req.body.active ? 1 : 0) : 1,
    };

    const insertStation = db.prepare(`
      INSERT INTO stations (id, name, latitude, longitude, elevation, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertStation.run(
      stationData.id,
      stationData.name,
      stationData.latitude,
      stationData.longitude,
      stationData.elevation,
      stationData.active
    );

    const station = db
      .prepare("SELECT * FROM stations WHERE id = ?")
      .get(stationData.id);

    res.status(201).json(station);

    // Emit updates
    emitDataUpdates();
  } catch (error) {
    console.error("Error creating station:", error);
    res.status(500).json({ error: "Failed to create station" });
  }
});

// Update a station
app.put("/api/stations/:id", (req, res) => {
  try {
    const station = db
      .prepare("SELECT * FROM stations WHERE id = ?")
      .get(req.params.id);

    if (!station) {
      return res.status(404).json({ error: "Station not found" });
    }

    const updateStation = db.prepare(`
      UPDATE stations
      SET name = ?, latitude = ?, longitude = ?, elevation = ?, active = ?
      WHERE id = ?
    `);

    updateStation.run(
      req.body.name || station.name,
      req.body.latitude || station.latitude,
      req.body.longitude || station.longitude,
      req.body.elevation !== undefined ? req.body.elevation : station.elevation,
      req.body.active !== undefined
        ? req.body.active
          ? 1
          : 0
        : station.active,
      req.params.id
    );

    const updatedStation = db
      .prepare("SELECT * FROM stations WHERE id = ?")
      .get(req.params.id);

    res.json(updatedStation);

    // Emit updates
    emitDataUpdates();
  } catch (error) {
    console.error("Error updating station:", error);
    res.status(500).json({ error: "Failed to update station" });
  }
});

// Delete a station
app.delete("/api/stations/:id", (req, res) => {
  try {
    const station = db
      .prepare("SELECT * FROM stations WHERE id = ?")
      .get(req.params.id);

    if (!station) {
      return res.status(404).json({ error: "Station not found" });
    }

    // Delete associated readings first
    db.prepare("DELETE FROM readings WHERE station_id = ?").run(req.params.id);

    // Delete the station
    db.prepare("DELETE FROM stations WHERE id = ?").run(req.params.id);

    res.status(204).send();

    // Emit updates
    emitDataUpdates();
  } catch (error) {
    console.error("Error deleting station:", error);
    res.status(500).json({ error: "Failed to delete station" });
  }
});

// Get all readings
app.get("/api/readings", (req, res) => {
  try {
    let query = "SELECT * FROM readings";
    const params = [];

    // Apply filters
    if (req.query.stationId) {
      query += " WHERE station_id = ?";
      params.push(req.query.stationId);
    }

    // Apply sorting
    query += " ORDER BY timestamp DESC";

    // Apply limit
    if (req.query.limit) {
      query += " LIMIT ?";
      params.push(parseInt(req.query.limit, 10));
    } else {
      query += " LIMIT 100"; // Default limit
    }

    const readings = db.prepare(query).all(...params);
    res.json(readings);
  } catch (error) {
    console.error("Error fetching readings:", error);
    res.status(500).json({ error: "Failed to fetch readings" });
  }
});

// Get a specific reading
app.get("/api/readings/:id", (req, res) => {
  try {
    const reading = db
      .prepare("SELECT * FROM readings WHERE id = ?")
      .get(req.params.id);

    if (!reading) {
      return res.status(404).json({ error: "Reading not found" });
    }

    res.json(reading);
  } catch (error) {
    console.error("Error fetching reading:", error);
    res.status(500).json({ error: "Failed to fetch reading" });
  }
});

// Create a new reading
app.post("/api/readings", (req, res) => {
  try {
    const readingData = {
      id: req.body.id || `reading-${uuidv4()}`,
      station_id: req.body.stationId,
      timestamp: req.body.timestamp || new Date().toISOString(),
      temperature: req.body.temperature,
      humidity: req.body.humidity || null,
      pressure: req.body.pressure || null,
      wind_speed: req.body.windSpeed || null,
      wind_direction: req.body.windDirection || null,
      precipitation: req.body.precipitation || null,
    };

    // Check if the station exists
    const station = db
      .prepare("SELECT * FROM stations WHERE id = ?")
      .get(readingData.station_id);

    if (!station) {
      return res.status(400).json({ error: "Station not found" });
    }

    const insertReading = db.prepare(`
      INSERT INTO readings (id, station_id, timestamp, temperature, humidity, pressure, wind_speed, wind_direction, precipitation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertReading.run(
      readingData.id,
      readingData.station_id,
      readingData.timestamp,
      readingData.temperature,
      readingData.humidity,
      readingData.pressure,
      readingData.wind_speed,
      readingData.wind_direction,
      readingData.precipitation
    );

    const reading = db
      .prepare("SELECT * FROM readings WHERE id = ?")
      .get(readingData.id);

    res.status(201).json(reading);

    // Emit updates
    emitDataUpdates();
  } catch (error) {
    console.error("Error creating reading:", error);
    res.status(500).json({ error: "Failed to create reading" });
  }
});

// WebSocket connection
io.on("connection", (socket) => {
  console.log("Client connected");

  // Send initial data to the client
  const stations = db.prepare("SELECT * FROM stations").all();
  socket.emit("stations", stations);

  const readings = db
    .prepare(
      `
    SELECT * FROM readings
    ORDER BY timestamp DESC
    LIMIT 20
  `
    )
    .all();

  socket.emit("readings", readings);

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Catch-all route to serve the SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../dist/index.html"));
});

// Initialize the database
initDatabase();

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down...");

  if (db) {
    db.close();
  }

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
