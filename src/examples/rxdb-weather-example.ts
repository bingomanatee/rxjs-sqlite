/**
 * Example of using RxDB with our SQLite adapter for weather data
 */
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageSQLite } from '../lib/rxdb-adapter';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';

// Add the dev mode plugin for better error messages
addRxPlugin(RxDBDevModePlugin);

async function runRxDBWeatherExample() {
  try {
    console.log('Creating RxDB database with SQLite adapter for weather data...');
    
    // Create a database using our SQLite adapter
    const db = await createRxDatabase({
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
    const stationsCollection = await db.addCollection({
      name: 'stations',
      schema: stationSchema
    });

    const readingsCollection = await db.addCollection({
      name: 'readings',
      schema: readingSchema
    });

    console.log('Collections created');

    console.log('Inserting weather stations...');
    
    // Insert weather stations
    const stations = await Promise.all([
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

    console.log(`Inserted ${stations.length} weather stations`);

    console.log('Inserting weather readings...');
    
    // Generate and insert weather readings
    const now = new Date();
    const readings = [];
    
    // Generate 10 readings per station over the last 24 hours
    for (let stationIndex = 0; stationIndex < stations.length; stationIndex++) {
      const station = stations[stationIndex];
      
      for (let i = 0; i < 10; i++) {
        const timestamp = new Date(now.getTime() - i * 2 * 60 * 60 * 1000); // Every 2 hours
        
        readings.push({
          id: `reading-${stationIndex + 1}-${i + 1}`,
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
    
    // Insert readings in batches
    const batchSize = 5;
    for (let i = 0; i < readings.length; i += batchSize) {
      const batch = readings.slice(i, i + batchSize);
      await Promise.all(batch.map(reading => readingsCollection.insert(reading)));
    }

    console.log(`Inserted ${readings.length} weather readings`);

    console.log('Setting up reactive queries...');
    
    // Create reactive queries
    
    // 1. Get all active stations
    const activeStationsSubscription = stationsCollection.find({
      selector: {
        active: true
      }
    }).$.subscribe(stations => {
      console.log(`Active stations: ${stations.length}`);
    });
    
    // 2. Get latest reading for each station
    const latestReadingsSubscription = readingsCollection.find({
      sort: [{ timestamp: 'desc' }],
      limit: 3
    }).$.subscribe(latestReadings => {
      console.log('Latest readings:', latestReadings.map(r => ({
        stationId: r.stationId,
        timestamp: r.timestamp,
        temperature: r.temperature
      })));
    });
    
    // 3. Get readings for a specific station
    const station1ReadingsSubscription = readingsCollection.find({
      selector: {
        stationId: 'station-1'
      },
      sort: [{ timestamp: 'desc' }]
    }).$.subscribe(readings => {
      console.log(`Station 1 has ${readings.length} readings`);
    });

    console.log('Adding a new reading...');
    
    // Add a new reading (this will trigger the reactive queries)
    setTimeout(async () => {
      const newReading = await readingsCollection.insert({
        id: `reading-new-${Date.now()}`,
        stationId: 'station-1',
        timestamp: new Date().toISOString(),
        temperature: 25.5,
        humidity: 45,
        pressure: 1015,
        windSpeed: 5.5,
        windDirection: 180,
        precipitation: 0
      });

      console.log('New reading added:', newReading.toJSON());

      // Clean up
      setTimeout(() => {
        console.log('Cleaning up...');
        
        activeStationsSubscription.unsubscribe();
        latestReadingsSubscription.unsubscribe();
        station1ReadingsSubscription.unsubscribe();
        
        db.destroy();
        console.log('Weather example completed');
      }, 2000);
    }, 2000);
  } catch (error) {
    console.error('Error:', error);
    console.error('Error details:', error.stack);
  }
}

// Run the example
console.log('Starting RxDB SQLite adapter weather example...');
runRxDBWeatherExample().catch(error => {
  console.error('Unhandled error in weather example:', error);
  console.error('Error details:', error.stack);
});
