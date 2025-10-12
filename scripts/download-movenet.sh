#!/bin/bash

# Download MoveNet model files and host them locally
# This avoids ALL CDN and CORS issues

MODEL_DIR="public/models/movenet"
mkdir -p "$MODEL_DIR"

echo "📦 Downloading MoveNet Lightning model files..."
echo "📁 Target: $MODEL_DIR"
echo ""

# The actual working model URL from TensorFlow.js models repository
BASE_URL="https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4"

cd "$MODEL_DIR"

# Download model.json
echo "⬇️  Downloading model.json..."
curl -L "${BASE_URL}/model.json?tfjs-format=file" -o model.json

# Check if it's valid JSON (not HTML error page)
if grep -q "<!DOCTYPE\|<html" model.json 2>/dev/null; then
    echo "❌ Got HTML instead of JSON - trying alternative source..."
    rm model.json
    
    # Try jsdelivr GitHub mirror as fallback
    curl -L "https://cdn.jsdelivr.net/gh/tensorflow/tfjs-models@master/pose-detection/demos/upload_video/movenet/model.json" -o model.json 2>/dev/null
    
    if [ ! -s model.json ] || grep -q "<!DOCTYPE\|<html" model.json 2>/dev/null; then
        echo "❌ Cannot download model from CDN"
        echo "ℹ️  Will use fallback CNN models instead"
        rm -f model.json
        cd ../../..
        exit 0
    fi
fi

if [ -f model.json ] && [ -s model.json ]; then
    echo "✅ Downloaded model.json ($(wc -c < model.json) bytes)"
    
    # Download weight files (shard files)
    # MoveNet Lightning has 2 shards
    echo "⬇️  Downloading weight files..."
    for i in {1..2}; do
        SHARD="group1-shard${i}of2.bin"
        curl -L "${BASE_URL}/${SHARD}?tfjs-format=file" -o "$SHARD" 2>/dev/null
        
        if [ -f "$SHARD" ] && [ -s "$SHARD" ]; then
            SIZE=$(wc -c < "$SHARD")
            echo "   ✅ $SHARD ($SIZE bytes)"
        else
            rm -f "$SHARD"
        fi
    done
    
    echo ""
    echo "🎉 MoveNet model downloaded!"
    echo "📁 Files:"
    ls -lh
else
    echo "❌ Failed to download valid model.json"
    echo "ℹ️  App will use fallback CNN models"
fi

cd ../../..

