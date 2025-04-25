/**
 * Example of using the RxDB SQLite adapter in a Node.js environment
 */
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageSQLite } from '../lib/rxdb-adapter/sqlite-adapter';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBValidatePlugin } from 'rxdb/plugins/validate';

// Add RxDB plugins
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBValidatePlugin);

// Define the schema for a weather station
const stationSchema = {
  title: 'weather station schema',
  version: 0,
  description: 'Weather station data',
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

// Define the schema for a weather reading
const readingSchema = {
  title: 'weather reading schema',
  version: 0,
  description: 'Weather reading data',
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
      type: 'string',
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

// Create the database and collections
async function createDatabase() {
  console.log('Creating RxDB database with SQLite adapter...');
  
  // Create the database with the SQLite adapter
  const db = await createRxDatabase({
    name: 'weatherdb',
    storage: getRxStorageSQLite({
      // Path to the SQLite database file
      // Use ':memory:' for an in-memory database
      path: ':memory:',
      // Optional: Use a custom SQLite implementation
      // sqliteBasics: customSQLiteImplementation
    })
  });
  
  console.log('Database created');
  
  // Create the collections
  await db.addCollections({
    stations: {
      schema: stationSchema
    },
    readings: {
      schema: readingSchema
    }
  });
  
  console.log('Collections created');
  
  return db;
}

// Insert initial data
async function insertInitialData(db: any) {
  console.log('Inserting initial data...');
  
  // Insert stations
  const stations = [
    {
      id: 'station-1',
      name: 'Downtown',
      latitude: 37.7749,
      longitude: -122.4194,
      elevation: 52,
      active: true
    },
    {
      id: 'station-2',
      name: 'Airport',
      latitude: 37.6213,
      longitude: -122.3790,
      elevation: 4,
      active: true
    },
    {
      id: 'station-3',
      name: 'Coastal',
      latitude: 37.8199,
      longitude: -122.4783,
      elevation: 5,
      active: true
    }
  ];
  
  for (const station of stations) {
    await db.stations.insert(station);
  }
  
  console.log('Stations inserted');
  
  // Insert readings
  const now = new Date();
  const readings = [];
  
  for (const station of stations) {
    for (let i = 0; i < 5; i++) {
      const timestamp = new Date(now.getTime() - i * 2 * 60 * 60 * 1000); // Every 2 hours
      
      readings.push({
        id: `reading-${station.id}-${i + 1}`,
        stationId: station.id,
        timestamp: timestamp.toISOString(),
        temperature: 15 + Math.random() * 15, // 15-30°C
        humidity: 30 + Math.random() * 50,    // 30-80%
        pressure: 1000 + Math.random() * 30,  // 1000-1030 hPa
        windSpeed: Math.random() * 20,        // 0-20 m/s
        windDirection: Math.random() * 360,   // 0-360 degrees
        precipitation: Math.random() * 5      // 0-5 mm
      });
    }
  }
  
  for (const reading of readings) {
    await db.readings.insert(reading);
  }
  
  console.log('Readings inserted');
}

// Query the database
async function queryDatabase(db: any) {
  console.log('\nQuerying the database...');
  
  // Get all stations
  const allStations = await db.stations.find().exec();
  console.log(`Found ${allStations.length} stations`);
  
  // Get active stations
  const activeStations = await db.stations.find({
    selector: {
      active: true
    }
  }).exec();
  console.log(`Found ${activeStations.length} active stations`);
  
  // Get stations with complex query
  const complexQuery = await db.stations.find({
    selector: {
      $and: [
        {
          latitude: {
            $gt: 37.7
          }
        },
        {
          $or: [
            {
              name: {
                $eq: 'Downtown'
              }
            },
            {
              name: {
                $eq: 'Coastal'
              }
            }
          ]
        }
      ]
    }
  }).exec();
  console.log(`Found ${complexQuery.length} stations with complex query`);
  
  // Get readings for a specific station
  const stationReadings = await db.readings.find({
    selector: {
      stationId: 'station-1'
    },
    sort: [
      {
        timestamp: 'desc'
      }
    ],
    limit: 3
  }).exec();
  console.log(`Found ${stationReadings.length} readings for station-1`);
  
  // Get readings with temperature above 20°C
  const highTempReadings = await db.readings.find({
    selector: {
      temperature: {
        $gt: 20
      }
    }
  }).exec();
  console.log(`Found ${highTempReadings.length} readings with temperature > 20°C`);
}

// Subscribe to changes
function subscribeToChanges(db: any) {
  console.log('\nSubscribing to changes...');
  
  // Subscribe to all station changes
  const stationSubscription = db.stations.$.subscribe(change => {
    console.log('Station collection changed:', change);
  });
  
  // Subscribe to all reading changes
  const readingSubscription = db.readings.$.subscribe(change => {
    console.log('Reading collection changed:', change);
  });
  
  // Subscribe to a specific station's readings
  const station1Readings = db.readings.find({
    selector: {
      stationId: 'station-1'
    }
  }).$.subscribe(readings => {
    console.log(`Station-1 has ${readings.length} readings`);
  });
  
  return {
    stationSubscription,
    readingSubscription,
    station1Readings
  };
}

// Add a new reading
async function addNewReading(db: any) {
  console.log('\nAdding a new reading...');
  
  const newReading = {
    id: `reading-station-1-${Date.now()}`,
    stationId: 'station-1',
    timestamp: new Date().toISOString(),
    temperature: 25.5,
    humidity: 65,
    pressure: 1015,
    windSpeed: 5.5,
    windDirection: 180,
    precipitation: 0
  };
  
  await db.readings.insert(newReading);
  console.log('New reading added');
}

// Main function
async function main() {
  try {
    // Create the database and collections
    const db = await createDatabase();
    
    // Insert initial data
    await insertInitialData(db);
    
    // Query the database
    await queryDatabase(db);
    
    // Subscribe to changes
    const subscriptions = subscribeToChanges(db);
    
    // Add a new reading (this will trigger the subscriptions)
    await addNewReading(db);
    
    // Wait a bit to see the subscription notifications
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Clean up subscriptions
    subscriptions.stationSubscription.unsubscribe();
    subscriptions.readingSubscription.unsubscribe();
    subscriptions.station1Readings.unsubscribe();
    
    // Close the database
    await db.destroy();
    console.log('\nDatabase closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
main();
