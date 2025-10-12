#!/bin/bash

# Download MoveNet model and host it locally
# This avoids ALL CORS and CDN issues

echo "📦 Downloading MoveNet Lightning model..."

MODEL_DIR="public/models/movenet"
mkdir -p "$MODEL_DIR"

# Download from a working mirror (uses wget/curl)
MODEL_URL="https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4"

echo "📁 Target directory: $MODEL_DIR"
echo "🌐 Downloading from TensorFlow Hub..."

# Use curl to download with redirects
cd "$MODEL_DIR"

# Download model.json
curl -L "${MODEL_URL}/model.json?tfjs-format=file" -o model.json 2>/dev/null

if [ $? -eq 0 ] && [ -f model.json ]; then
    echo "✅ Downloaded model.json"
    
    # Parse model.json to find weight files
    # For simplicity, try common weight file names
    for i in {1..6}; do
        WEIGHT_FILE="group1-shard${i}of6.bin"
        curl -L "${MODEL_URL}/${WEIGHT_FILE}?tfjs-format=file" -o "$WEIGHT_FILE" 2>/dev/null
        if [ $? -eq 0 ] && [ -s "$WEIGHT_FILE" ]; then
            echo "✅ Downloaded $WEIGHT_FILE"
        fi
    done
    
    echo ""
    echo "🎉 MoveNet model downloaded successfully!"
    echo "📁 Location: $MODEL_DIR"
    ls -lh
else
    echo "❌ Failed to download model.json"
    echo "⚠️  Will use fallback strategy in code"
fi

