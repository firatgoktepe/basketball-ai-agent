#!/bin/bash

echo "Setting up Basketball Quick Stats project..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Create public/models directory for AI models
echo "Creating models directory..."
mkdir -p public/models

# Create placeholder model files
echo "Creating placeholder model files..."
touch public/models/coco-ssd/model.json
touch public/models/movenet/model.json

echo "Setup complete! Run 'npm run dev' to start the development server."
