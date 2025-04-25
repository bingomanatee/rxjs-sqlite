#!/bin/bash
# Skip TypeScript compilation and just run vite build
echo "Skipping TypeScript compilation and running vite build directly..."
mkdir -p dist
vite build
