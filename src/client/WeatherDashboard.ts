/**
 * Weather Dashboard Component
 * Displays weather stations and readings
 */
import { Station, Reading, getStations, getReadings, createReading, onStationsUpdate, onReadingsUpdate } from './api';

export class WeatherDashboard {
  private container: HTMLElement;
  private stations: Station[] = [];
  private readings: Reading[] = [];
  private selectedStationId: string | null = null;
  
  // Cleanup functions for event listeners
  private cleanup: (() => void)[] = [];
  
  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    
    if (!container) {
      throw new Error(`Container element with ID "${containerId}" not found`);
    }
    
    this.container = container;
    this.init();
  }
  
  private async init() {
    // Create the UI structure
    this.createUI();
    
    // Load initial data
    try {
      this.stations = await getStations();
      this.readings = await getReadings({ limit: 10 });
      
      // Render the data
      this.renderStations();
      this.renderReadings();
      
      // Set up WebSocket listeners
      this.setupWebSocketListeners();
      
      // Set up event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize dashboard:', error);
      this.showError('Failed to load data. Please try again later.');
    }
  }
  
  private createUI() {
    this.container.innerHTML = `
      <div class="weather-dashboard">
        <div class="dashboard-header">
          <h2>Weather Dashboard</h2>
          <p>Real-time weather data using RxDB with SQLite</p>
        </div>
        
        <div class="dashboard-content">
          <div class="stations-panel">
            <h3>Weather Stations</h3>
            <div class="stations-list" id="stations-list"></div>
          </div>
          
          <div class="readings-panel">
            <div class="readings-header">
              <h3>Latest Readings</h3>
              <button id="add-reading-btn" class="btn">Add Reading</button>
            </div>
            <div class="readings-list" id="readings-list"></div>
          </div>
        </div>
        
        <div id="add-reading-form" class="form-container" style="display: none;">
          <h3>Add New Reading</h3>
          <form id="reading-form">
            <div class="form-group">
              <label for="station-select">Station</label>
              <select id="station-select" required></select>
            </div>
            <div class="form-group">
              <label for="temperature-input">Temperature (°C)</label>
              <input type="number" id="temperature-input" step="0.1" required>
            </div>
            <div class="form-group">
              <label for="humidity-input">Humidity (%)</label>
              <input type="number" id="humidity-input" min="0" max="100">
            </div>
            <div class="form-group">
              <label for="pressure-input">Pressure (hPa)</label>
              <input type="number" id="pressure-input" step="0.1">
            </div>
            <div class="form-group">
              <label for="wind-speed-input">Wind Speed (m/s)</label>
              <input type="number" id="wind-speed-input" step="0.1" min="0">
            </div>
            <div class="form-group">
              <label for="wind-direction-input">Wind Direction (°)</label>
              <input type="number" id="wind-direction-input" min="0" max="360">
            </div>
            <div class="form-group">
              <label for="precipitation-input">Precipitation (mm)</label>
              <input type="number" id="precipitation-input" step="0.1" min="0">
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Save</button>
              <button type="button" id="cancel-btn" class="btn">Cancel</button>
            </div>
          </form>
        </div>
        
        <div id="error-message" class="error-message" style="display: none;"></div>
      </div>
    `;
    
    // Add some basic styles
    const style = document.createElement('style');
    style.textContent = `
      .weather-dashboard {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      
      .dashboard-header {
        margin-bottom: 20px;
        text-align: center;
      }
      
      .dashboard-content {
        display: flex;
        gap: 20px;
      }
      
      .stations-panel, .readings-panel {
        flex: 1;
        background-color: #f5f5f5;
        border-radius: 8px;
        padding: 15px;
      }
      
      .readings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      
      .station-item, .reading-item {
        background-color: white;
        border-radius: 4px;
        padding: 10px;
        margin-bottom: 10px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .station-item:hover, .reading-item:hover {
        background-color: #f0f0f0;
      }
      
      .station-item.selected {
        background-color: #e0e0ff;
        border-left: 4px solid #4040ff;
      }
      
      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        background-color: #e0e0e0;
        cursor: pointer;
      }
      
      .btn-primary {
        background-color: #4040ff;
        color: white;
      }
      
      .form-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        max-width: 500px;
        width: 100%;
      }
      
      .form-group {
        margin-bottom: 15px;
      }
      
      .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
      }
      
      .form-group input, .form-group select {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
      }
      
      .error-message {
        background-color: #ffebee;
        color: #c62828;
        padding: 10px;
        border-radius: 4px;
        margin-top: 20px;
      }
      
      @media (max-width: 768px) {
        .dashboard-content {
          flex-direction: column;
        }
      }
    `;
    
    document.head.appendChild(style);
  }
  
  private renderStations() {
    const stationsList = document.getElementById('stations-list');
    
    if (!stationsList) return;
    
    stationsList.innerHTML = '';
    
    if (this.stations.length === 0) {
      stationsList.innerHTML = '<p>No stations available</p>';
      return;
    }
    
    this.stations.forEach(station => {
      const stationElement = document.createElement('div');
      stationElement.className = `station-item ${station.id === this.selectedStationId ? 'selected' : ''}`;
      stationElement.dataset.id = station.id;
      
      stationElement.innerHTML = `
        <h4>${station.name}</h4>
        <p>Lat: ${station.latitude.toFixed(4)}, Lon: ${station.longitude.toFixed(4)}</p>
        <p>Status: ${station.active ? 'Active' : 'Inactive'}</p>
      `;
      
      stationElement.addEventListener('click', () => {
        this.selectStation(station.id);
      });
      
      stationsList.appendChild(stationElement);
    });
    
    // Also update the station select in the form
    const stationSelect = document.getElementById('station-select') as HTMLSelectElement;
    
    if (stationSelect) {
      stationSelect.innerHTML = '';
      
      this.stations.forEach(station => {
        const option = document.createElement('option');
        option.value = station.id;
        option.textContent = station.name;
        stationSelect.appendChild(option);
      });
      
      if (this.selectedStationId) {
        stationSelect.value = this.selectedStationId;
      }
    }
  }
  
  private renderReadings() {
    const readingsList = document.getElementById('readings-list');
    
    if (!readingsList) return;
    
    readingsList.innerHTML = '';
    
    if (this.readings.length === 0) {
      readingsList.innerHTML = '<p>No readings available</p>';
      return;
    }
    
    // Filter readings by selected station if needed
    const filteredReadings = this.selectedStationId
      ? this.readings.filter(reading => reading.stationId === this.selectedStationId)
      : this.readings;
    
    if (filteredReadings.length === 0) {
      readingsList.innerHTML = '<p>No readings available for the selected station</p>';
      return;
    }
    
    filteredReadings.forEach(reading => {
      const station = this.stations.find(s => s.id === reading.stationId);
      const readingElement = document.createElement('div');
      readingElement.className = 'reading-item';
      
      const timestamp = new Date(reading.timestamp);
      
      readingElement.innerHTML = `
        <div class="reading-header">
          <h4>${station?.name || 'Unknown Station'}</h4>
          <span>${timestamp.toLocaleString()}</span>
        </div>
        <div class="reading-data">
          <p>Temperature: ${reading.temperature.toFixed(1)} °C</p>
          ${reading.humidity !== undefined ? `<p>Humidity: ${reading.humidity.toFixed(1)}%</p>` : ''}
          ${reading.pressure !== undefined ? `<p>Pressure: ${reading.pressure.toFixed(1)} hPa</p>` : ''}
          ${reading.windSpeed !== undefined ? `<p>Wind: ${reading.windSpeed.toFixed(1)} m/s${reading.windDirection !== undefined ? ` at ${reading.windDirection.toFixed(0)}°` : ''}</p>` : ''}
          ${reading.precipitation !== undefined ? `<p>Precipitation: ${reading.precipitation.toFixed(1)} mm</p>` : ''}
        </div>
      `;
      
      readingsList.appendChild(readingElement);
    });
  }
  
  private selectStation(stationId: string) {
    this.selectedStationId = stationId;
    this.renderStations();
    this.renderReadings();
  }
  
  private setupWebSocketListeners() {
    // Listen for station updates
    const stationsUnsubscribe = onStationsUpdate(stations => {
      this.stations = stations;
      this.renderStations();
    });
    
    // Listen for reading updates
    const readingsUnsubscribe = onReadingsUpdate(readings => {
      this.readings = readings;
      this.renderReadings();
    });
    
    // Add cleanup functions
    this.cleanup.push(stationsUnsubscribe, readingsUnsubscribe);
  }
  
  private setupEventListeners() {
    // Add reading button
    const addReadingBtn = document.getElementById('add-reading-btn');
    if (addReadingBtn) {
      addReadingBtn.addEventListener('click', () => {
        this.showAddReadingForm();
      });
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.hideAddReadingForm();
      });
    }
    
    // Form submission
    const readingForm = document.getElementById('reading-form') as HTMLFormElement;
    if (readingForm) {
      readingForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await this.submitReadingForm();
      });
    }
  }
  
  private showAddReadingForm() {
    const form = document.getElementById('add-reading-form');
    if (form) {
      form.style.display = 'block';
    }
  }
  
  private hideAddReadingForm() {
    const form = document.getElementById('add-reading-form');
    if (form) {
      form.style.display = 'none';
      
      // Reset the form
      const readingForm = document.getElementById('reading-form') as HTMLFormElement;
      if (readingForm) {
        readingForm.reset();
      }
    }
  }
  
  private async submitReadingForm() {
    try {
      const stationSelect = document.getElementById('station-select') as HTMLSelectElement;
      const temperatureInput = document.getElementById('temperature-input') as HTMLInputElement;
      const humidityInput = document.getElementById('humidity-input') as HTMLInputElement;
      const pressureInput = document.getElementById('pressure-input') as HTMLInputElement;
      const windSpeedInput = document.getElementById('wind-speed-input') as HTMLInputElement;
      const windDirectionInput = document.getElementById('wind-direction-input') as HTMLInputElement;
      const precipitationInput = document.getElementById('precipitation-input') as HTMLInputElement;
      
      const reading: Omit<Reading, 'id' | 'timestamp'> = {
        stationId: stationSelect.value,
        temperature: parseFloat(temperatureInput.value)
      };
      
      if (humidityInput.value) {
        reading.humidity = parseFloat(humidityInput.value);
      }
      
      if (pressureInput.value) {
        reading.pressure = parseFloat(pressureInput.value);
      }
      
      if (windSpeedInput.value) {
        reading.windSpeed = parseFloat(windSpeedInput.value);
      }
      
      if (windDirectionInput.value) {
        reading.windDirection = parseFloat(windDirectionInput.value);
      }
      
      if (precipitationInput.value) {
        reading.precipitation = parseFloat(precipitationInput.value);
      }
      
      await createReading(reading);
      this.hideAddReadingForm();
    } catch (error) {
      console.error('Failed to submit reading:', error);
      this.showError('Failed to submit reading. Please try again.');
    }
  }
  
  private showError(message: string) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      
      // Hide after 5 seconds
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 5000);
    }
  }
  
  public destroy() {
    // Clean up event listeners
    this.cleanup.forEach(cleanup => cleanup());
  }
}
