/**
 * Script to start the server
 */
import { exec } from 'child_process';
import path from 'path';

// Build the project first
console.log('Building the project...');
exec('npm run build', (error, stdout, stderr) => {
  if (error) {
    console.error('Build failed:', error);
    console.error(stderr);
    process.exit(1);
  }
  
  console.log(stdout);
  console.log('Build completed successfully');
  
  // Start the server
  console.log('Starting the server...');
  
  // Use ts-node to run the server
  const serverPath = path.join(__dirname, 'index.ts');
  const tsNode = require.resolve('ts-node/dist/bin.js');
  
  const server = exec(`node ${tsNode} ${serverPath}`, {
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });
  
  server.stdout?.on('data', (data) => {
    console.log(data.toString());
  });
  
  server.stderr?.on('data', (data) => {
    console.error(data.toString());
  });
  
  server.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Stopping server...');
    server.kill();
    process.exit(0);
  });
});
