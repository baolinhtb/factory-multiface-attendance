#!/bin/bash
# Script to Check and Convert models to RKNN in Docker
# Run this on your PC/Mac (x86_64 host), NOT on the Orange Pi itself unless it has full rknn-toolkit2 installed.

# Configuration
MODEL_SRC="yolov8n.pt" # Default model
MODEL_DEST="backend/models/yolov8n.rknn"
DOCKER_IMAGE="rockchip/rknn-toolkit2:latest-cp38"

echo "=============================================="
echo "      RKNN Conversion Wrapper Script          "
echo "=============================================="

# 1. Check if destination RKNN model already exists
if [ -f "$MODEL_DEST" ]; then
    echo "✅ RKNN Model already exists at: $MODEL_DEST"
    echo "Do you want to re-convert/overwrite it? (y/n)"
    read answer
    if [ "$answer" != "y" ]; then
        echo "Skipping conversion."
        exit 0
    fi
fi

# 2. Check if Source Model exists
if [ ! -f "$MODEL_SRC" ]; then
    if [ -f "backend/models/yolo26n.pt" ]; then
        MODEL_SRC="backend/models/yolo26n.pt"
    elif [ -f "yolo26n.pt" ]; then
        MODEL_SRC="yolo26n.pt"
    else
        echo "❌ Source model ($MODEL_SRC) not found!"
        echo "Please place yolov8n.pt or yolo26n.pt in the current directory."
        exit 1
    fi
fi

echo "Source Model: $MODEL_SRC"
echo "Target Path: $MODEL_DEST"

# 3. Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. You need Docker to run the conversion tool safely."
    echo "Please install Docker Desktop or run 'convert_models.py' manually in a suitable environment."
    exit 1
fi

# 4. Run Conversion inside Docker
echo "🚀 Starting Conversion in Docker ($DOCKER_IMAGE)..."
echo "This might take a minute..."

# We mount the current directory to /workspace and run the python script
docker run --rm -v "$(pwd):/workspace" "$DOCKER_IMAGE" \
    /bin/bash -c "cd /workspace && python3 backend/scripts/convert_models.py --model $MODEL_SRC"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    # Move the output content if the python script saved it alongside the source
    # The python script saves as [modelname].rknn. We ensure it's in backend/models
    BASENAME=$(basename "$MODEL_SRC" .pt)
    GENERATED_FILE="$BASENAME.rknn"
    
    if [ -f "$GENERATED_FILE" ]; then
        mkdir -p backend/models
        mv "$GENERATED_FILE" "$MODEL_DEST"
        echo "✅ Conversion Successful!"
        echo "📂 Model saved to: $MODEL_DEST"
    elif [ -f "backend/models/$GENERATED_FILE" ]; then
        echo "✅ Conversion Successful! File is already in place."
    fi
else
    echo "❌ Conversion Failed. Check the docker logs above."
    echo "Make sure you have pulled the docker image: docker pull rockchip/rknn-toolkit2:latest-cp38"
fi
