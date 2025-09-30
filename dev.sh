#!/bin/bash

echo "Starting Basketball Quick Stats development server..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies first..."
    npm install
fi

echo "Starting Next.js development server..."
npm run dev
