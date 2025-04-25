/**
 * Simple HTTP server for serving static files
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, "../../dist");

// MIME types for different file extensions
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// In-memory data store for our demo
let stations = [
  {
    id: "station-1",
    name: "Downtown",
    latitude: 37.7749,
    longitude: -122.4194,
    elevation: 52,
    active: 1,
  },
  {
    id: "station-2",
    name: "Airport",
    latitude: 37.6213,
    longitude: -122.379,
    elevation: 4,
    active: 1,
  },
  {
    id: "station-3",
    name: "Coastal",
    latitude: 37.8199,
    longitude: -122.4783,
    elevation: 5,
    active: 1,
  },
];

let readings = [];

// Generate initial readings
function generateReadings() {
  const now = new Date();
  const newReadings = [];

  for (const station of stations) {
    if (station.active) {
      const readingId = `reading-${station.id}-${Date.now()}`;

      newReadings.push({
        id: readingId,
        station_id: station.id,
        timestamp: now.toISOString(),
        temperature: 15 + Math.random() * 15, // 15-30°C
        humidity: 30 + Math.random() * 50, // 30-80%
        pressure: 1000 + Math.random() * 30, // 1000-1030 hPa
        wind_speed: Math.random() * 20, // 0-20 m/s
        wind_direction: Math.random() * 360, // 0-360 degrees
        precipitation: Math.random() * 5, // 0-5 mm
      });
    }
  }

  // Add new readings to the beginning of the array
  readings = [...newReadings, ...readings];

  // Keep only the latest 100 readings
  if (readings.length > 100) {
    readings = readings.slice(0, 100);
  }

  console.log(
    `Generated ${newReadings.length} new readings at ${now.toISOString()}`
  );
  return newReadings;
}

// Generate initial readings
generateReadings();

// Set up periodic data generation (every 10 seconds)
const dataGenerationInterval = setInterval(generateReadings, 10000);

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Handle API requests
  if (req.url.startsWith("/api/")) {
    return handleApiRequest(req, res);
  }

  // Serve static files
  let filePath = path.join(DIST_DIR, req.url === "/" ? "index.html" : req.url);

  // If the path doesn't have an extension, assume it's a route and serve index.html
  if (!path.extname(filePath)) {
    filePath = path.join(DIST_DIR, "index.html");
  }

  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || "application/octet-stream";

  // Read the file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        // File not found
        console.error(`File not found: ${filePath}`);
        res.writeHead(404);
        res.end("404 Not Found");
      } else {
        // Server error
        console.error(`Server error: ${err.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

// Handle API requests
function handleApiRequest(req, res) {
  const url = req.url;

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle API endpoints
  if (url === "/api/stations" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stations));
    return;
  }

  if (url.startsWith("/api/readings") && req.method === "GET") {
    // Parse query parameters
    const queryString = url.split("?")[1] || "";
    const params = new URLSearchParams(queryString);
    const limit = parseInt(params.get("limit") || "20", 10);
    const stationId = params.get("stationId");

    // Filter readings if stationId is provided
    let filteredReadings = stationId
      ? readings.filter((reading) => reading.station_id === stationId)
      : readings;

    // Limit the number of readings
    filteredReadings = filteredReadings.slice(0, limit);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(filteredReadings));
    return;
  }

  // Add a new reading (for testing purposes)
  if (url === "/api/readings" && req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const data = JSON.parse(body);

        // Validate required fields
        if (!data.stationId || !data.temperature) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ error: "stationId and temperature are required" })
          );
          return;
        }

        // Check if station exists
        const station = stations.find((s) => s.id === data.stationId);
        if (!station) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Station not found" }));
          return;
        }

        // Create a new reading
        const newReading = {
          id: `reading-${data.stationId}-${Date.now()}`,
          station_id: data.stationId,
          timestamp: new Date().toISOString(),
          temperature: data.temperature,
          humidity: data.humidity || null,
          pressure: data.pressure || null,
          wind_speed: data.windSpeed || null,
          wind_direction: data.windDirection || null,
          precipitation: data.precipitation || null,
        };

        // Add to readings
        readings.unshift(newReading);

        // Keep only the latest 100 readings
        if (readings.length > 100) {
          readings = readings.slice(0, 100);
        }

        console.log(`Added new reading: ${JSON.stringify(newReading)}`);

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify(newReading));
      } catch (error) {
        console.error("Error parsing request body:", error);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });

    return;
  }

  // API endpoint not found
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "API endpoint not found" }));
}

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");

  // Clear the data generation interval
  clearInterval(dataGenerationInterval);

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
