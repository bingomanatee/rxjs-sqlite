/**
 * Build script for the server
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create the dist/server directory if it doesn't exist
const serverDistDir = path.join(__dirname, 'dist', 'server');
if (!fs.existsSync(serverDistDir)) {
  fs.mkdirSync(serverDistDir, { recursive: true });
}

// Compile the TypeScript files
console.log('Compiling server TypeScript files...');
try {
  execSync('tsc --project tsconfig.server.json', { stdio: 'inherit' });
  console.log('Server compilation successful');
} catch (error) {
  console.error('Server compilation failed:', error);
  process.exit(1);
}

// Copy the package.json to the dist directory
console.log('Copying package.json to dist directory...');
const packageJson = require('./package.json');

// Modify the package.json for the server
const serverPackageJson = {
  name: packageJson.name + '-server',
  version: packageJson.version,
  description: packageJson.description + ' (Server)',
  main: 'server/index.js',
  scripts: {
    start: 'node server/index.js'
  },
  dependencies: {
    express: packageJson.dependencies.express,
    cors: packageJson.dependencies.cors,
    'socket.io': packageJson.dependencies['socket.io'],
    rxdb: packageJson.dependencies.rxdb,
    'better-sqlite3': packageJson.dependencies['better-sqlite3'],
    rxjs: packageJson.dependencies.rxjs,
    uuid: packageJson.dependencies.uuid
  }
};

fs.writeFileSync(
  path.join(__dirname, 'dist', 'package.json'),
  JSON.stringify(serverPackageJson, null, 2)
);

console.log('Server build completed successfully');
