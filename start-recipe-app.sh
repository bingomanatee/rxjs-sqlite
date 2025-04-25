#!/bin/bash

# Start the server
echo "Starting Recipe Server..."
cd server && node recipe-server.cjs &
SERVER_PID=$!

# Wait for the server to start
sleep 2

# Start the client
echo "Starting Recipe UI..."
cd recipe-ui && npm run dev &
CLIENT_PID=$!

# Function to handle script termination
cleanup() {
  echo "Stopping Recipe App..."
  kill $SERVER_PID
  kill $CLIENT_PID
  exit 0
}

# Register the cleanup function for when the script is terminated
trap cleanup SIGINT SIGTERM

# Keep the script running
echo "Recipe App is running. Press Ctrl+C to stop."
wait
