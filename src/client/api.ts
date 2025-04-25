/**
 * API client for communicating with the server
 */
import { io } from 'socket.io-client';

// API base URL
const API_BASE_URL = 'http://localhost:3000/api';

// Socket.io connection
export const socket = io('http://localhost:3000');

// Types
export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  active: boolean;
}

export interface Reading {
  id: string;
  stationId: string;
  timestamp: string;
  temperature: number;
  humidity?: number;
  pressure?: number;
  windSpeed?: number;
  windDirection?: number;
  precipitation?: number;
}

// API functions

// Stations
export async function getStations(): Promise<Station[]> {
  const response = await fetch(`${API_BASE_URL}/stations`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch stations: ${response.statusText}`);
  }
  
  return response.json();
}

export async function getStation(id: string): Promise<Station> {
  const response = await fetch(`${API_BASE_URL}/stations/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch station: ${response.statusText}`);
  }
  
  return response.json();
}

export async function createStation(station: Omit<Station, 'id'>): Promise<Station> {
  const response = await fetch(`${API_BASE_URL}/stations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(station)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create station: ${response.statusText}`);
  }
  
  return response.json();
}

export async function updateStation(id: string, station: Partial<Station>): Promise<Station> {
  const response = await fetch(`${API_BASE_URL}/stations/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(station)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update station: ${response.statusText}`);
  }
  
  return response.json();
}

export async function deleteStation(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/stations/${id}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete station: ${response.statusText}`);
  }
}

// Readings
export async function getReadings(options?: { stationId?: string; limit?: number }): Promise<Reading[]> {
  let url = `${API_BASE_URL}/readings`;
  
  if (options) {
    const params = new URLSearchParams();
    
    if (options.stationId) {
      params.append('stationId', options.stationId);
    }
    
    if (options.limit) {
      params.append('limit', options.limit.toString());
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
  }
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch readings: ${response.statusText}`);
  }
  
  return response.json();
}

export async function getReading(id: string): Promise<Reading> {
  const response = await fetch(`${API_BASE_URL}/readings/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch reading: ${response.statusText}`);
  }
  
  return response.json();
}

export async function createReading(reading: Omit<Reading, 'id' | 'timestamp'>): Promise<Reading> {
  const response = await fetch(`${API_BASE_URL}/readings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(reading)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create reading: ${response.statusText}`);
  }
  
  return response.json();
}

// WebSocket events
export function onStationsUpdate(callback: (stations: Station[]) => void): () => void {
  socket.on('stations', callback);
  
  return () => {
    socket.off('stations', callback);
  };
}

export function onReadingsUpdate(callback: (readings: Reading[]) => void): () => void {
  socket.on('readings', callback);
  
  return () => {
    socket.off('readings', callback);
  };
}
