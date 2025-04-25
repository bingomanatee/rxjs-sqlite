/**
 * Weather data example for the RxJS SQLite adapter
 * This example demonstrates how to use the adapter with a larger dataset
 * and more complex queries.
 */
import { createSQLiteAdapter, createTableSchema } from '../lib';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

// Define types for our data
interface WeatherStation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

interface WeatherReading {
  id: number;
  station_id: number;
  temperature: number;
  humidity: number;
  pressure: number;
  timestamp: string;
}

interface WeatherStationWithReadings extends WeatherStation {
  readings: WeatherReading[];
}

async function runWeatherExample() {
  // Create an in-memory database
  const db = createSQLiteAdapter(':memory:');
  
  try {
    // Create tables
    const stationSchema = {
      id: 'INTEGER',
      name: 'TEXT',
      latitude: 'REAL',
      longitude: 'REAL'
    };
    
    const readingSchema = {
      id: 'INTEGER',
      station_id: 'INTEGER',
      temperature: 'REAL',
      humidity: 'REAL',
      pressure: 'REAL',
      timestamp: 'TEXT'
    };
    
    // Create tables in a transaction
    const transaction = db.transaction();
    
    transaction.execute(createTableSchema('weather_stations', stationSchema, 'id'));
    transaction.execute(createTableSchema('weather_readings', readingSchema, 'id'));
    
    // Add indexes for better performance
    transaction.execute('CREATE INDEX idx_readings_station_id ON weather_readings(station_id)');
    transaction.execute('CREATE INDEX idx_readings_timestamp ON weather_readings(timestamp)');
    
    // Commit the transaction
    transaction.commit();
    
    console.log('Tables created successfully');
    
    // Insert some weather stations
    db.execute(`
      INSERT INTO weather_stations (id, name, latitude, longitude)
      VALUES 
        (1, 'Downtown', 37.7749, -122.4194),
        (2, 'Airport', 37.6213, -122.3790),
        (3, 'Coastal', 37.8199, -122.4783)
    `);
    
    // Insert some weather readings
    const now = new Date();
    const readings = [];
    
    // Generate 100 readings per station over the last 24 hours
    for (let stationId = 1; stationId <= 3; stationId++) {
      for (let i = 0; i < 100; i++) {
        const timestamp = new Date(now.getTime() - i * 15 * 60 * 1000); // Every 15 minutes
        
        readings.push({
          id: (stationId - 1) * 100 + i + 1,
          station_id: stationId,
          temperature: 15 + Math.random() * 15, // 15-30°C
          humidity: 30 + Math.random() * 50,    // 30-80%
          pressure: 1000 + Math.random() * 30,  // 1000-1030 hPa
          timestamp: timestamp.toISOString()
        });
      }
    }
    
    // Insert readings in batches using transactions
    const batchSize = 50;
    for (let i = 0; i < readings.length; i += batchSize) {
      const batch = readings.slice(i, i + batchSize);
      const batchTransaction = db.transaction();
      
      for (const reading of batch) {
        batchTransaction.execute(`
          INSERT INTO weather_readings (id, station_id, temperature, humidity, pressure, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          reading.id,
          reading.station_id,
          reading.temperature,
          reading.humidity,
          reading.pressure,
          reading.timestamp
        ]);
      }
      
      batchTransaction.commit();
    }
    
    console.log(`Inserted ${readings.length} weather readings`);
    
    // Query the latest reading for each station
    const latestReadings$ = db.query<WeatherReading>(`
      SELECT r.*
      FROM weather_readings r
      JOIN (
        SELECT station_id, MAX(timestamp) as max_timestamp
        FROM weather_readings
        GROUP BY station_id
      ) latest ON r.station_id = latest.station_id AND r.timestamp = latest.max_timestamp
    `);
    
    const latestReadings = await firstValueFrom(latestReadings$);
    console.log('Latest readings:', latestReadings);
    
    // Create a reactive query for temperature averages
    const avgTemperature$ = db.reactiveQuery<{ station_id: number, avg_temp: number }>(`
      SELECT station_id, AVG(temperature) as avg_temp
      FROM weather_readings
      GROUP BY station_id
    `);
    
    // Subscribe to the reactive query
    const subscription = avgTemperature$.subscribe(averages => {
      console.log('Average temperatures updated:', averages);
    });
    
    // Add a new reading (this will trigger the reactive query)
    setTimeout(() => {
      const newReading = {
        id: readings.length + 1,
        station_id: 1,
        temperature: 35, // Unusually high temperature
        humidity: 40,
        pressure: 1015,
        timestamp: new Date().toISOString()
      };
      
      db.execute(`
        INSERT INTO weather_readings (id, station_id, temperature, humidity, pressure, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `, {
        params: [
          newReading.id,
          newReading.station_id,
          newReading.temperature,
          newReading.humidity,
          newReading.pressure,
          newReading.timestamp
        ]
      });
      
      console.log('Added a new reading with high temperature');
      
      // Query stations with their readings
      setTimeout(async () => {
        // Complex query joining stations with their readings
        const stationsWithReadings$ = db.query<WeatherStation>(`
          SELECT * FROM weather_stations
        `).pipe(
          map(async (stations) => {
            // For each station, get its readings
            const stationsWithReadings: WeatherStationWithReadings[] = [];
            
            for (const station of stations) {
              const readings$ = db.query<WeatherReading>(`
                SELECT * FROM weather_readings
                WHERE station_id = ?
                ORDER BY timestamp DESC
                LIMIT 5
              `, { params: [station.id] });
              
              const readings = await firstValueFrom(readings$);
              
              stationsWithReadings.push({
                ...station,
                readings
              });
            }
            
            return stationsWithReadings;
          })
        );
        
        const stationsWithReadings = await firstValueFrom(stationsWithReadings$);
        const result = await stationsWithReadings;
        
        console.log('Stations with their 5 most recent readings:');
        for (const station of result) {
          console.log(`Station: ${station.name}`);
          console.log(`Recent readings: ${station.readings.length}`);
          console.log('---');
        }
        
        // Clean up
        subscription.unsubscribe();
        db.close();
        console.log('Weather example completed');
      }, 1000);
    }, 1000);
  } catch (error) {
    console.error('Error:', error);
    db.close();
  }
}

// Run the example
runWeatherExample().catch(console.error);
